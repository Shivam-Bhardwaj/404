// Integration tests for WebSocket and end-to-end functionality
#[cfg(test)]
mod integration_tests {
    use crate::cuda::{CudaContext, init_cuda_in_thread};
    use crate::simulation_engine;
    use crate::broadcast;
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
    fn test_simulation_engine_broadcast_integration() {
        let (context, _context_guard) = setup_test_context();
        let engine = simulation_engine::SimulationEngine::new(&context, 50).unwrap();
        engine.start().unwrap();
        
        // Wait for simulation to stabilize
        std::thread::sleep(std::time::Duration::from_millis(200));
        
        // Encode multiple states
        let states: Vec<_> = (0..5)
            .map(|_| {
                std::thread::sleep(std::time::Duration::from_millis(20));
                broadcast::BroadcastState::encode(&engine).unwrap()
            })
            .collect();
        
        // All states should have same particle count
        let num_boids = states[0].num_boids;
        assert!(states.iter().all(|s| s.num_boids == num_boids));
        
        // Test delta encoding between consecutive states
        for i in 1..states.len() {
            let delta = broadcast::DeltaState::encode_delta(&states[i], &states[i-1]).unwrap();
            assert_eq!(delta.num_boids, num_boids);
        }
        
        engine.stop();
    }

    #[test]
    fn test_simulation_engine_performance() {
        let (context, _context_guard) = setup_test_context();
        let engine = simulation_engine::SimulationEngine::new(&context, 1000).unwrap();
        engine.start().unwrap();
        
        // Measure encoding performance
        let start = std::time::Instant::now();
        for _ in 0..10 {
            let _state = broadcast::BroadcastState::encode(&engine).unwrap();
        }
        let duration = start.elapsed();
        
        // Should encode 10 states in reasonable time (< 1 second)
        assert!(duration.as_secs() < 1, "Encoding should be fast");
        
        engine.stop();
    }

    #[test]
    fn test_simulation_engine_consistency() {
        let (context, _context_guard) = setup_test_context();
        let engine = simulation_engine::SimulationEngine::new(&context, 100).unwrap();
        engine.start().unwrap();
        
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        // Get state multiple times - should always return valid data
        for _ in 0..5 {
            let state = engine.get_state().unwrap();
            assert_eq!(state.len(), 100 * 4);
            assert!(state.iter().all(|&x| x.is_finite()), "All values should be finite");
        }
        
        engine.stop();
    }

    #[test]
    fn test_broadcast_state_timestamp() {
        let (context, _context_guard) = setup_test_context();
        let engine = simulation_engine::SimulationEngine::new(&context, 10).unwrap();
        engine.start().unwrap();
        
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        let state = broadcast::BroadcastState::encode(&engine).unwrap();
        // Timestamp should be reasonable (encoding time in ms)
        assert!(state.timestamp < 1000, "Encoding should be fast");
        
        engine.stop();
    }
}
