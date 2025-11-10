// API server implementation with physics simulation endpoints
#![allow(dead_code, unused_variables)]

use axum::{
    extract::{State, ws::WebSocketUpgrade},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tokio::sync::broadcast as tokio_broadcast;
use tracing::{info, warn, Level};
use tracing_subscriber;

mod broadcast;
mod cuda;
mod gpu_stats;
mod physics;
mod simulation_engine;
#[cfg(test)]
mod tests;

#[derive(Clone)]
struct AppState {
    cuda_context: Arc<cuda::CudaContext>,
    boids_simulation: Arc<Mutex<physics::BoidsSimulation>>,
    #[allow(dead_code)]
    simulation_engine: Arc<simulation_engine::SimulationEngine>,
    broadcast_tx: tokio_broadcast::Sender<broadcast::BroadcastState>,
}

#[derive(Deserialize, Debug)]
struct SimulationRequest {
    #[allow(dead_code)]
    simulation_type: String,
    #[allow(dead_code)]
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
    #[allow(dead_code)]
    simulation_type: String,
    #[allow(dead_code)]
    num_particles: usize,
    computation_time_ms: u128,
    accelerator: String,
}

async fn health() -> &'static str {
    "OK"
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> axum::response::Response {
    let rx = state.broadcast_tx.subscribe();
    
    info!("New WebSocket connection request");
    
    ws.on_upgrade(|socket| async move {
        info!("WebSocket connection upgraded");
        handle_websocket(socket, rx).await;
        info!("WebSocket connection closed");
    })
}

async fn handle_websocket(
    socket: axum::extract::ws::WebSocket,
    mut rx: tokio_broadcast::Receiver<broadcast::BroadcastState>,
) {
    use axum::extract::ws::Message;
    use futures_util::{SinkExt, StreamExt};
    
    let (mut sender, mut receiver) = socket.split();
    
    // Spawn task to send simulation updates
    let send_task = tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(16)); // ~60 FPS
        let mut last_successful_send = std::time::Instant::now();
        let mut consecutive_empty = 0;
        
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    match rx.try_recv() {
                        Ok(state) => {
                            // Send binary data: [timestamp (u64), num_boids (u32), data...]
                            let mut message = Vec::with_capacity(12 + state.data.len());
                            message.extend_from_slice(&state.timestamp.to_le_bytes());
                            message.extend_from_slice(&(state.num_boids as u32).to_le_bytes());
                            message.extend_from_slice(&state.data);
                            
                            if sender.send(Message::Binary(message)).await.is_err() {
                                warn!("Failed to send WebSocket message, connection closed");
                                break;
                            }
                            last_successful_send = std::time::Instant::now();
                            consecutive_empty = 0;
                        }
                        Err(tokio_broadcast::error::TryRecvError::Empty) => {
                            consecutive_empty += 1;
                            // If no data for too long, send a keepalive ping
                            if consecutive_empty > 60 && last_successful_send.elapsed().as_secs() > 1 {
                                // Send a ping to keep connection alive
                                if sender.send(Message::Ping(vec![])).await.is_err() {
                                    warn!("Failed to send WebSocket ping, connection closed");
                                    break;
                                }
                                consecutive_empty = 0;
                            }
                        }
                        Err(tokio_broadcast::error::TryRecvError::Closed) => {
                            warn!("Broadcast channel closed");
                            break;
                        }
                        Err(e) => {
                            warn!("Broadcast receive error: {:?}", e);
                            break;
                        }
                    }
                }
                result = receiver.next() => {
                    match result {
                        Some(Ok(Message::Close(_))) => {
                            info!("WebSocket client closed connection");
                            break;
                        }
                        Some(Ok(Message::Ping(data))) => {
                            // Respond to ping with pong
                            if sender.send(Message::Pong(data)).await.is_err() {
                                break;
                            }
                        }
                        Some(Ok(_)) => {
                            // Ignore other incoming messages (read-only)
                        }
                        Some(Err(e)) => {
                            warn!("WebSocket receive error: {:?}", e);
                            break;
                        }
                        None => {
                            info!("WebSocket receiver closed");
                            break;
                        }
                    }
                }
            }
        }
    });
    
    send_task.await.ok();
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
    
    // Create persistent simulation engine with larger particle count
    // Try to maximize - start with 100K, fall back if needed
    let num_boids = 100_000;
    info!("Creating simulation engine with {} boids", num_boids);
    let simulation_engine = Arc::new(
        simulation_engine::SimulationEngine::new(&cuda_context, num_boids)
            .map_err(|e| {
                warn!("Failed to create simulation engine with {} boids: {:?}, falling back to 10K", num_boids, e);
                e
            })
            .or_else(|_| simulation_engine::SimulationEngine::new(&cuda_context, 10_000))?
    );
    
    // Start the persistent simulation loop
    simulation_engine.start()?;
    info!("Simulation engine started");
    
    // Create broadcast channel for WebSocket clients
    let (broadcast_tx, _) = tokio_broadcast::channel::<broadcast::BroadcastState>(100);
    
    // Spawn broadcast task
    let engine_clone = Arc::clone(&simulation_engine);
    let tx_clone = broadcast_tx.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_millis(16)); // 60 FPS broadcast
        let mut consecutive_failures = 0;
        let mut last_success = std::time::Instant::now();
        
        loop {
            interval.tick().await;
            
            // Use spawn_blocking to ensure CUDA context is available
            // CUDA contexts are thread-local, so we need a dedicated thread
            let engine_ref = Arc::clone(&engine_clone);
            let tx_ref = tx_clone.clone();
            
            match tokio::task::spawn_blocking(move || {
                // Initialize CUDA in this blocking thread
                if let Err(e) = cuda::init_cuda_in_thread() {
                    warn!("Failed to initialize CUDA in broadcast encoding thread: {:?}", e);
                }
                broadcast::BroadcastState::encode(&engine_ref)
            }).await {
                Ok(Ok(state)) => {
                    // Capture num_boids before moving state
                    let num_boids = state.num_boids;
                    // Send to all subscribers (non-blocking)
                    let _ = tx_ref.send(state);
                    consecutive_failures = 0;
                    let now = std::time::Instant::now();
                    let elapsed = now.duration_since(last_success);
                    // Log first successful broadcast after restart
                    if elapsed.as_secs() > 5 {
                        info!("Broadcast encoding succeeded! Sending {} boids to WebSocket clients", num_boids);
                    }
                    last_success = now;
                }
                Ok(Err(e)) => {
                    consecutive_failures += 1;
                    // Log the actual error for debugging
                    let error_str = format!("{:?}", e);
                    if error_str.contains("Cached state not yet available") {
                        // This is expected right after restart - simulation needs time to populate cache
                        if consecutive_failures % 60 == 0 { // Log every ~1 second at 60 FPS
                            info!("Waiting for simulation to populate cached state... (attempt {})", consecutive_failures);
                        }
                    } else {
                        // Other errors are more serious
                        if error_str.contains("InvalidContext") || error_str.contains("context") {
                            warn!("CUDA context error in broadcast encoding: {:?}", e);
                        }
                        
                        // If encoding fails repeatedly, log warning
                        if consecutive_failures % 100 == 0 {
                            warn!("Failed to encode broadcast state ({} consecutive failures): {:?}", consecutive_failures, e);
                        }
                    }
                    
                    // If we haven't had a success in 5 seconds, something is seriously wrong
                    if last_success.elapsed().as_secs() > 5 {
                        warn!("No successful broadcasts for 5 seconds, simulation may be stuck. Error: {:?}", e);
                    }
                }
                Err(e) => {
                    warn!("Broadcast encoding task panicked: {:?}", e);
                }
            }
        }
    });
    
    let state = AppState { 
        cuda_context, 
        boids_simulation,
        simulation_engine,
        broadcast_tx,
    };

    // Build application
    let app = Router::new()
        .route("/health", get(health))
        .route("/api/gpu-info", get(gpu_info))
        .route("/api/gpu-stats", get(gpu_stats))
        .route("/api/simulate/sph", post(simulate_sph))
        .route("/api/simulate/boids", post(simulate_boids))
        .route("/api/simulate/grayscott", post(simulate_grayscott))
        .route("/ws", get(websocket_handler))
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
    info!("  WS   /ws");
    
    axum::serve(listener, app).await?;
    
    Ok(())
}
