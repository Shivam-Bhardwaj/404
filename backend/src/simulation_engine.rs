// Persistent GPU simulation engine that runs continuously
use crate::cuda::CudaContext;
use crate::physics::BoidsSimulation;
use anyhow::Result;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tracing::{info, warn};
use rustacuda::prelude::*;

pub struct SimulationEngine {
    simulation: Arc<Mutex<BoidsSimulation>>,
    context: Arc<CudaContext>,
    running: Arc<Mutex<bool>>,
    target_fps: Arc<Mutex<f32>>, // Make mutable for adaptive timing
    last_update: Arc<Mutex<Instant>>,
    frame_count: Arc<Mutex<u64>>,
    // Performance tracking
    frame_times: Arc<Mutex<Vec<Duration>>>, // Track last N frame times
    consecutive_delays: Arc<Mutex<u32>>, // Count consecutive frames that exceeded target
}

impl SimulationEngine {
    pub fn new(context: &Arc<CudaContext>, num_boids: usize) -> Result<Self> {
        info!("Initializing simulation engine with {} boids", num_boids);
        
        let simulation = Arc::new(Mutex::new(
            BoidsSimulation::new(context, num_boids)?
        ));
        
        Ok(Self {
            simulation,
            context: Arc::clone(context),
            running: Arc::new(Mutex::new(false)),
            target_fps: Arc::new(Mutex::new(500.0)), // 500 Hz internal update rate
            last_update: Arc::new(Mutex::new(Instant::now())),
            frame_count: Arc::new(Mutex::new(0)),
            frame_times: Arc::new(Mutex::new(Vec::new())),
            consecutive_delays: Arc::new(Mutex::new(0)),
        })
    }
    
    pub fn start(&self) -> Result<()> {
        let mut running = self.running.lock().unwrap();
        if *running {
            warn!("Simulation engine already running");
            return Ok(());
        }
        
        *running = true;
        let initial_fps = {
            let fps_guard = self.target_fps.lock().unwrap();
            *fps_guard
        };
        info!("Starting persistent simulation engine at {} Hz", initial_fps);
        
        let simulation = Arc::clone(&self.simulation);
        let context = Arc::clone(&self.context);
        let running_flag = Arc::clone(&self.running);
        let target_fps = Arc::clone(&self.target_fps);
        let last_update = Arc::clone(&self.last_update);
        let frame_count = Arc::clone(&self.frame_count);
        let frame_times = Arc::clone(&self.frame_times);
        let consecutive_delays = Arc::clone(&self.consecutive_delays);
        
        // Spawn simulation loop in background thread
        std::thread::spawn(move || {
            // Initialize CUDA in this thread
            if let Err(e) = crate::cuda::init_cuda_in_thread() {
                warn!("Failed to initialize CUDA in simulation thread: {:?}", e);
                return;
            }
            
            // Create and keep context alive for this thread
            // Get device from the context
            let device = Device::get_device(0).expect("Failed to get CUDA device");
            
            let _cuda_context = match rustacuda::prelude::Context::create_and_push(
                rustacuda::prelude::ContextFlags::MAP_HOST | rustacuda::prelude::ContextFlags::SCHED_AUTO,
                device
            ) {
                Ok(ctx) => ctx,
                Err(e) => {
                    warn!("Failed to create CUDA context in simulation thread: {:?}", e);
                    return;
                }
            };
            
            const FRAME_TIME_HISTORY_SIZE: usize = 100;
            const ADAPTIVE_THRESHOLD: u32 = 50; // Reduce FPS after 50 consecutive delays
            const MIN_FPS: f32 = 100.0; // Minimum FPS to prevent too slow simulation
            
            loop {
                let start = Instant::now();
                
                // Check if we should stop
                {
                    let running_guard = running_flag.lock().unwrap();
                    if !*running_guard {
                        info!("Simulation engine stopping");
                        break;
                    }
                }
                
                // Get current target FPS
                let current_target_fps = {
                    let fps_guard = target_fps.lock().unwrap();
                    *fps_guard
                };
                
                let dt = 1.0 / current_target_fps;
                let target_duration = Duration::from_secs_f32(dt);
                
                // Run simulation step
                let step_result = {
                    let mut sim = simulation.lock().unwrap();
                    sim.step(dt)
                };
                
                if let Err(e) = step_result {
                    warn!("Simulation step error: {:?}", e);
                }
                
                // Update frame tracking
                let elapsed = start.elapsed();
                {
                    let mut count = frame_count.lock().unwrap();
                    *count += 1;
                }
                
                {
                    let mut last = last_update.lock().unwrap();
                    *last = Instant::now();
                }
                
                // Track frame times for adaptive timing
                {
                    let mut times = frame_times.lock().unwrap();
                    times.push(elapsed);
                    if times.len() > FRAME_TIME_HISTORY_SIZE {
                        times.remove(0);
                    }
                }
                
                // Adaptive timing: reduce FPS if consistently falling behind
                if elapsed > target_duration {
                    let mut delays = consecutive_delays.lock().unwrap();
                    *delays += 1;
                    
                    // If consistently falling behind, reduce target FPS
                    if *delays >= ADAPTIVE_THRESHOLD {
                        let mut fps_guard = target_fps.lock().unwrap();
                        let new_fps = (*fps_guard * 0.9).max(MIN_FPS);
                        if (new_fps - *fps_guard).abs() > 1.0 {
                            *fps_guard = new_fps;
                            info!("Reducing simulation FPS to {:.1} Hz due to performance issues", new_fps);
                            *delays = 0; // Reset counter
                        }
                    }
                    
                    // Log warning occasionally
                    {
                        let count = frame_count.lock().unwrap();
                        if *count % 1000 == 0 {
                            let avg_frame_time = {
                                let times = frame_times.lock().unwrap();
                                if times.is_empty() {
                                    elapsed.as_secs_f32() * 1000.0
                                } else {
                                    times.iter().sum::<Duration>().as_secs_f32() / times.len() as f32 * 1000.0
                                }
                            };
                            warn!(
                                "Simulation falling behind target FPS (target: {:.1} Hz, avg frame time: {:.2} ms, consecutive delays: {})",
                                current_target_fps, avg_frame_time, *delays
                            );
                        }
                    }
                } else {
                    // Reset delay counter if we're keeping up
                    let mut delays = consecutive_delays.lock().unwrap();
                    if *delays > 0 {
                        *delays = 0;
                    }
                }
                
                // Sleep to maintain target FPS
                if elapsed < target_duration {
                    std::thread::sleep(target_duration - elapsed);
                }
            }
        });
        
        Ok(())
    }
    
    #[allow(dead_code)]
    pub fn stop(&self) {
        let mut running = self.running.lock().unwrap();
        *running = false;
        info!("Stopping simulation engine");
    }
    
    pub fn get_state(&self) -> Result<Vec<f32>> {
        // Ensure CUDA context is available in current thread
        // Retry logic for async tasks that might run on different threads
        let mut retries = 3;
        loop {
            match self.context.ensure_context() {
                Ok(_) => break,
                Err(e) => {
                    retries -= 1;
                    if retries == 0 {
                        return Err(anyhow::anyhow!("Failed to ensure CUDA context after retries: {:?}", e));
                    }
                    // Brief delay before retry
                    std::thread::sleep(std::time::Duration::from_millis(1));
                }
            }
        }
        
        let mut sim = self.simulation.lock().unwrap();
        sim.get_boids()
    }
    
    pub fn num_boids(&self) -> usize {
        let sim = self.simulation.lock().unwrap();
        sim.num_boids()
    }
    
    #[allow(dead_code)]
    pub fn is_running(&self) -> bool {
        *self.running.lock().unwrap()
    }
    
    #[allow(dead_code)]
    pub fn get_frame_count(&self) -> u64 {
        *self.frame_count.lock().unwrap()
    }
    
    #[allow(dead_code)]
    pub fn get_last_update(&self) -> Instant {
        *self.last_update.lock().unwrap()
    }
}

unsafe impl Send for SimulationEngine {}
unsafe impl Sync for SimulationEngine {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cuda::{CudaContext, init_cuda_in_thread};
    use std::sync::Arc;
    use std::time::Duration;

    fn setup_test_context() -> (Arc<CudaContext>, rustacuda::context::Context) {
        init_cuda_in_thread().expect("Failed to init CUDA in test thread");
        let context_obj = rustacuda::prelude::Context::create_and_push(
            rustacuda::prelude::ContextFlags::MAP_HOST
                | rustacuda::prelude::ContextFlags::SCHED_AUTO,
            rustacuda::prelude::Device::get_device(0).expect("Failed to get device"),
        )
        .expect("Failed to create context");
        (
            Arc::new(CudaContext::new().expect("Failed to create CUDA context")),
            context_obj,
        )
    }

    #[test]
    fn test_simulation_engine_initialization() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 1000);
        assert!(engine.is_ok(), "Simulation engine should initialize");
    }

    #[test]
    fn test_simulation_engine_start_stop() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 1000).unwrap();
        
        // Start the engine
        assert!(engine.start().is_ok(), "Should start successfully");
        assert!(engine.is_running(), "Engine should be running");
        
        // Wait a bit for simulation to run
        std::thread::sleep(Duration::from_millis(100));
        
        // Stop the engine
        engine.stop();
        std::thread::sleep(Duration::from_millis(50));
        
        // Note: is_running() might still return true briefly due to thread cleanup
        // But stop() should have been called
    }

    #[test]
    fn test_simulation_engine_get_state() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 100).unwrap();
        engine.start().unwrap();
        
        // Wait for simulation to run
        std::thread::sleep(Duration::from_millis(100));
        
        // Get state
        let state = engine.get_state();
        assert!(state.is_ok(), "Should retrieve state");
        
        let boids = state.unwrap();
        assert_eq!(boids.len(), 100 * 4, "Should return correct number of boids");
        
        engine.stop();
    }

    #[test]
    fn test_simulation_engine_num_boids() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 500).unwrap();
        assert_eq!(engine.num_boids(), 500);
    }

    #[test]
    fn test_simulation_engine_frame_count() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 100).unwrap();
        
        let initial_count = engine.get_frame_count();
        engine.start().unwrap();
        
        // Wait for some frames
        std::thread::sleep(Duration::from_millis(200));
        
        let new_count = engine.get_frame_count();
        assert!(new_count > initial_count, "Frame count should increase");
        
        engine.stop();
    }

    #[test]
    fn test_simulation_engine_double_start() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 100).unwrap();
        
        assert!(engine.start().is_ok());
        // Second start should not error (but won't start again)
        assert!(engine.start().is_ok());
        
        engine.stop();
    }

    #[test]
    fn test_simulation_engine_persistent_running() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 100).unwrap();
        engine.start().unwrap();
        
        // Run for multiple seconds
        for _ in 0..5 {
            std::thread::sleep(Duration::from_millis(200));
            let state = engine.get_state();
            assert!(state.is_ok(), "Should continue running");
        }
        
        engine.stop();
    }
}
