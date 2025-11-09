// API server implementation with physics simulation endpoints
use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tracing::{info, Level};
use tracing_subscriber;

mod cuda;
mod gpu_stats;
mod physics;
#[cfg(test)]
mod tests;

#[derive(Clone)]
struct AppState {
    cuda_context: Arc<cuda::CudaContext>,
    boids_simulation: Arc<Mutex<physics::BoidsSimulation>>,
}

#[derive(Deserialize, Debug)]
struct SimulationRequest {
    simulation_type: String,
    num_particles: Option<usize>,
    steps: Option<usize>,
}

#[derive(Serialize)]
struct SimulationResponse {
    success: bool,
    data: Option<Vec<f32>>,
    metadata: Option<SimulationMetadata>,
    error: Option<String>,
}

#[derive(Serialize)]
struct SimulationMetadata {
    simulation_type: String,
    num_particles: usize,
    computation_time_ms: u128,
    accelerator: String,
}

async fn health() -> &'static str {
    "OK"
}

async fn gpu_info(State(state): State<AppState>) -> Result<Json<serde_json::Value>, StatusCode> {
    let device_name = state.cuda_context.device().name()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({
        "gpu": device_name,
        "status": "ready",
        "cuda_context": true
    })))
}

async fn gpu_stats(State(state): State<AppState>) -> Result<Json<gpu_stats::GpuStats>, StatusCode> {
    let device = state.cuda_context.device();
    let stats = gpu_stats::get_gpu_stats(Some(device))
        .map_err(|e| {
            tracing::warn!("Failed to get GPU stats: {:?}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    
    Ok(Json(stats))
}

async fn simulate_sph(
    State(state): State<AppState>,
    Json(request): Json<SimulationRequest>,
) -> Result<Json<SimulationResponse>, StatusCode> {
    info!("SPH simulation request: {:?}", request);
    
    // Initialize CUDA in this thread
    cuda::init_cuda_in_thread()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Create context for this thread
    let device_clone = *state.cuda_context.device().clone();
    let _ctx = rustacuda::prelude::Context::create_and_push(
        rustacuda::prelude::ContextFlags::MAP_HOST | rustacuda::prelude::ContextFlags::SCHED_AUTO,
        device_clone
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let start = std::time::Instant::now();
    
    // Create simulation
    let mut sim = physics::SphSimulation::new(&state.cuda_context)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    // Run simulation steps
    let steps = request.steps.unwrap_or(1);
    for _ in 0..steps {
        sim.step(0.016)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    
    // Get results
    let particles = sim.get_particles()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let duration = start.elapsed();
    
    Ok(Json(SimulationResponse {
        success: true,
        data: Some(particles),
        metadata: Some(SimulationMetadata {
            simulation_type: "sph".to_string(),
            num_particles: 1000,
            computation_time_ms: duration.as_millis(),
            accelerator: "cpu".to_string(),
        }),
        error: None,
    }))
}

async fn simulate_boids(
    State(state): State<AppState>,
    Json(request): Json<SimulationRequest>,
) -> Result<Json<SimulationResponse>, StatusCode> {
    info!("Boids simulation request: {:?}", request);
    
    // Initialize CUDA in this thread
    cuda::init_cuda_in_thread()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let device = *state.cuda_context.device().clone();
    let _ctx = rustacuda::prelude::Context::create_and_push(
        rustacuda::prelude::ContextFlags::MAP_HOST | rustacuda::prelude::ContextFlags::SCHED_AUTO,
        device
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let steps = request.steps.unwrap_or(1);
    
    let (boids, duration, num_boids, accelerator) = {
        let mut sim = state.boids_simulation
            .lock()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let num_boids = sim.num_boids();
        let start = std::time::Instant::now();
        for _ in 0..steps {
            sim.step(0.016)
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        }
        let boids = sim.get_boids()
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let acc = if sim.used_cuda() { "cuda" } else { "cpu" };
        (boids, start.elapsed(), num_boids, acc.to_string())
    };
    
    Ok(Json(SimulationResponse {
        success: true,
        data: Some(boids),
        metadata: Some(SimulationMetadata {
            simulation_type: "boids".to_string(),
            num_particles: num_boids,
            computation_time_ms: duration.as_millis(),
            accelerator,
        }),
        error: None,
    }))
}

async fn simulate_grayscott(
    State(state): State<AppState>,
    Json(request): Json<SimulationRequest>,
) -> Result<Json<SimulationResponse>, StatusCode> {
    info!("Gray-Scott simulation request: {:?}", request);
    
    cuda::init_cuda_in_thread()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let device_clone = *state.cuda_context.device().clone();
    let _ctx = rustacuda::prelude::Context::create_and_push(
        rustacuda::prelude::ContextFlags::MAP_HOST | rustacuda::prelude::ContextFlags::SCHED_AUTO,
        device_clone
    ).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let start = std::time::Instant::now();
    
    let mut sim = physics::GrayScottSimulation::new(&state.cuda_context, 512, 512)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let steps = request.steps.unwrap_or(1);
    for _ in 0..steps {
        sim.step(0.016)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }
    
    let field = sim.get_field()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let duration = start.elapsed();
    
    let accelerator = if cfg!(feature = "cuda-kernel") { "cuda" } else { "cpu" };
    Ok(Json(SimulationResponse {
        success: true,
        data: Some(field),
        metadata: Some(SimulationMetadata {
            simulation_type: "grayscott".to_string(),
            num_particles: 512 * 512,
            computation_time_ms: duration.as_millis(),
            accelerator: accelerator.to_string(),
        }),
        error: None,
    }))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    info!("Initializing CUDA context...");
    
    // Initialize CUDA in main thread
    cuda::init_cuda_in_thread()?;
    
    let cuda_context = Arc::new(cuda::CudaContext::new()?);
    // Create a CUDA context on this thread for initial allocations
    let device_clone = *cuda_context.device().clone();
    let _ctx = rustacuda::prelude::Context::create_and_push(
        rustacuda::prelude::ContextFlags::MAP_HOST | rustacuda::prelude::ContextFlags::SCHED_AUTO,
        device_clone
    )?;
    let boids_simulation = Arc::new(Mutex::new(
        physics::BoidsSimulation::new(&cuda_context, 1000)?
    ));
    
    let state = AppState { cuda_context, boids_simulation };

    // Build application
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/gpu-info", get(gpu_info))
        .route("/api/gpu-stats", get(gpu_stats))
        .route("/api/simulate/sph", post(simulate_sph))
        .route("/api/simulate/boids", post(simulate_boids))
        .route("/api/simulate/grayscott", post(simulate_grayscott))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3001").await?;
    info!("Physics backend server listening on http://0.0.0.0:3001");
    info!("Endpoints:");
    info!("  GET  /health");
    info!("  GET  /api/gpu-info");
    info!("  GET  /api/gpu-stats");
    info!("  POST /api/simulate/sph");
    info!("  POST /api/simulate/boids");
    info!("  POST /api/simulate/grayscott");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}
