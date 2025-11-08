// Comprehensive test suite for physics simulations
// These tests should FAIL initially (TDD approach)

#[cfg(test)]
mod integration_tests {
    use crate::cuda::{CudaContext, init_cuda_in_thread};
    use crate::physics::*;
    use std::sync::Arc;

    fn setup_test_context() -> (Arc<CudaContext>, rustacuda::context::Context) {
        init_cuda_in_thread().expect("Failed to init CUDA in test thread");
        let context_obj = rustacuda::prelude::Context::create_and_push(
            rustacuda::prelude::ContextFlags::MAP_HOST | rustacuda::prelude::ContextFlags::SCHED_AUTO,
            rustacuda::prelude::Device::get_device(0).expect("Failed to get device")
        ).expect("Failed to create context");
        (Arc::new(CudaContext::new().expect("Failed to create CUDA context")), context_obj)
    }

    #[test]
    fn test_sph_performance() {
        let (context, _context_guard) = setup_test_context();
        let mut sim = SphSimulation::new(&context).unwrap();
        
        // Test single step performance
        let start = std::time::Instant::now();
        sim.step(0.016).unwrap();
        let duration = start.elapsed();
        
        // CPU implementation - should complete in reasonable time
        // Full CUDA kernel will be much faster
        assert!(duration.as_millis() < 100, "SPH step should complete in reasonable time");
    }

    #[test]
    fn test_boids_performance() {
        let (context, _context_guard) = setup_test_context();
        let mut sim = BoidsSimulation::new(&context, 1000).unwrap();
        
        // Test single step performance with fewer boids
        let start = std::time::Instant::now();
        sim.step(0.016).unwrap();
        let duration = start.elapsed();
        
        // CPU implementation - should complete in reasonable time
        assert!(duration.as_millis() < 100, "Boids step should complete in reasonable time");
    }

    #[test]
    fn test_memory_leak_detection() {
        let (context, _context_guard) = setup_test_context();
        
        // Create and destroy many simulations
        for _ in 0..100 {
            let _sim = SphSimulation::new(&context).unwrap();
            drop(_sim);
        }
        
        // If memory leaks, GPU memory will be exhausted
        // This test passes if no panic occurs
    }

    #[test]
    fn test_concurrent_simulations() {
        let (context, _context_guard) = setup_test_context();
        
        // Should be able to run multiple simulations concurrently
        let mut sph = SphSimulation::new(&context).unwrap();
        let mut boids = BoidsSimulation::new(&context, 1000).unwrap();
        
        sph.step(0.016).unwrap();
        boids.step(0.016).unwrap();
        
        // Both should work without interfering
        assert!(sph.get_particles().unwrap().len() > 0);
        assert!(boids.get_boids().unwrap().len() > 0);
    }
}

