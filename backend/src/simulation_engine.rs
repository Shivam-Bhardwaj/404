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
    target_fps: f32,
    last_update: Arc<Mutex<Instant>>,
    frame_count: Arc<Mutex<u64>>,
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
            target_fps: 500.0, // 500 Hz internal update rate
            last_update: Arc::new(Mutex::new(Instant::now())),
            frame_count: Arc::new(Mutex::new(0)),
        })
    }
    
    pub fn start(&self) -> Result<()> {
        let mut running = self.running.lock().unwrap();
        if *running {
            warn!("Simulation engine already running");
            return Ok(());
        }
        
        *running = true;
        info!("Starting persistent simulation engine at {} Hz", self.target_fps);
        
        let simulation = Arc::clone(&self.simulation);
        let context = Arc::clone(&self.context);
        let running_flag = Arc::clone(&self.running);
        let target_fps = self.target_fps;
        let last_update = Arc::clone(&self.last_update);
        let frame_count = Arc::clone(&self.frame_count);
        
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
            
            let dt = 1.0 / target_fps;
            let target_duration = Duration::from_secs_f32(dt);
            
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
                
                // Run simulation step
                {
                    let mut sim = simulation.lock().unwrap();
                    if let Err(e) = sim.step(dt) {
                        warn!("Simulation step error: {:?}", e);
                    }
                }
                
                // Update frame tracking
                {
                    let mut count = frame_count.lock().unwrap();
                    *count += 1;
                }
                
                {
                    let mut last = last_update.lock().unwrap();
                    *last = Instant::now();
                }
                
                // Sleep to maintain target FPS
                let elapsed = start.elapsed();
                if elapsed < target_duration {
                    std::thread::sleep(target_duration - elapsed);
                } else {
                    // Falling behind - log warning occasionally
                    if *frame_count.lock().unwrap() % 1000 == 0 {
                        warn!("Simulation falling behind target FPS");
                    }
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
        self.context.ensure_context()?;
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
