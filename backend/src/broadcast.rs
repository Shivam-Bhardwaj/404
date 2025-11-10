// Efficient state broadcasting with binary serialization
use crate::simulation_engine::SimulationEngine;
use anyhow::Result;
use std::time::Instant;

#[derive(Clone)]
pub struct BroadcastState {
    pub timestamp: u64,
    pub num_boids: usize,
    pub data: Vec<u8>,
}

impl BroadcastState {
    pub fn encode(engine: &SimulationEngine) -> Result<Self> {
        let start = Instant::now();
        
        // Get simulation state
        let state = engine.get_state()?;
        let num_boids = engine.num_boids();
        
        // Binary encode: [x1, y1, vx1, vy1, x2, y2, vx2, vy2, ...]
        // Each float is 4 bytes, so total size is num_boids * 4 * 4 = num_boids * 16
        let mut data = Vec::with_capacity(num_boids * 16);
        
        for chunk in state.chunks_exact(4) {
            // Pack as little-endian f32
            data.extend_from_slice(&chunk[0].to_le_bytes()); // x
            data.extend_from_slice(&chunk[1].to_le_bytes()); // y
            data.extend_from_slice(&chunk[2].to_le_bytes()); // vx
            data.extend_from_slice(&chunk[3].to_le_bytes()); // vy
        }
        
        let timestamp = start.elapsed().as_millis() as u64;
        
        Ok(Self {
            timestamp,
            num_boids,
            data,
        })
    }
    
    #[allow(dead_code)]
    pub fn decode(data: &[u8]) -> Result<Vec<f32>> {
        let mut result = Vec::new();
        
        // Decode binary data back to floats
        for chunk in data.chunks_exact(4) {
            let bytes: [u8; 4] = chunk.try_into().unwrap();
            let value = f32::from_le_bytes(bytes);
            result.push(value);
        }
        
        Ok(result)
    }
    
    #[allow(dead_code)]
    pub fn size_bytes(&self) -> usize {
        self.data.len()
    }
}

// Delta compression for position updates
#[derive(Clone)]
#[allow(dead_code)]
pub struct DeltaState {
    pub base_timestamp: u64,
    pub delta_timestamp: u64,
    pub num_boids: usize,
    pub deltas: Vec<u8>, // Packed delta values
}

#[allow(dead_code)]
impl DeltaState {
    pub fn encode_delta(current: &BroadcastState, previous: &BroadcastState) -> Result<Self> {
        if current.num_boids != previous.num_boids {
            // Can't delta compress if particle count changed
            return Ok(Self {
                base_timestamp: current.timestamp,
                delta_timestamp: 0,
                num_boids: current.num_boids,
                deltas: current.data.clone(),
            });
        }
        
        let mut deltas = Vec::with_capacity(current.data.len());
        
        // Calculate deltas (current - previous)
        for (curr, prev) in current.data.chunks_exact(4).zip(previous.data.chunks_exact(4)) {
            let curr_val = f32::from_le_bytes(curr.try_into().unwrap());
            let prev_val = f32::from_le_bytes(prev.try_into().unwrap());
            let delta = curr_val - prev_val;
            
            // Quantize delta to reduce size (optional)
            deltas.extend_from_slice(&delta.to_le_bytes());
        }
        
        Ok(Self {
            base_timestamp: previous.timestamp,
            delta_timestamp: current.timestamp.saturating_sub(previous.timestamp),
            num_boids: current.num_boids,
            deltas,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cuda::{CudaContext, init_cuda_in_thread};
    use crate::simulation_engine::SimulationEngine;
    use std::sync::Arc;

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
    fn test_broadcast_state_encode_decode() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 10).unwrap();
        engine.start().unwrap();
        
        // Wait for simulation to initialize
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        // Encode state
        let encoded = BroadcastState::encode(&engine).unwrap();
        assert_eq!(encoded.num_boids, 10);
        assert_eq!(encoded.data.len(), 10 * 16); // 10 boids * 4 floats * 4 bytes
        
        // Decode state
        let decoded = BroadcastState::decode(&encoded.data).unwrap();
        assert_eq!(decoded.len(), 10 * 4); // 10 boids * 4 floats
        
        engine.stop();
    }

    #[test]
    fn test_broadcast_state_size() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 100).unwrap();
        engine.start().unwrap();
        
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        let encoded = BroadcastState::encode(&engine).unwrap();
        assert_eq!(encoded.size_bytes(), 100 * 16); // 100 boids * 16 bytes per boid
        
        engine.stop();
    }

    #[test]
    fn test_delta_state_encode() {
        let (context, _context_guard) = setup_test_context();
        let engine = SimulationEngine::new(&context, 10).unwrap();
        engine.start().unwrap();
        
        std::thread::sleep(std::time::Duration::from_millis(100));
        
        let state1 = BroadcastState::encode(&engine).unwrap();
        
        // Wait a bit and get second state
        std::thread::sleep(std::time::Duration::from_millis(50));
        let state2 = BroadcastState::encode(&engine).unwrap();
        
        // Encode delta
        let delta = DeltaState::encode_delta(&state2, &state1).unwrap();
        assert_eq!(delta.num_boids, 10);
        assert_eq!(delta.deltas.len(), state2.data.len());
        
        engine.stop();
    }

    #[test]
    fn test_delta_state_different_particle_count() {
        // Test delta encoding when particle count changes
        let state1 = BroadcastState {
            timestamp: 100,
            num_boids: 10,
            data: vec![0u8; 10 * 16],
        };
        
        let state2 = BroadcastState {
            timestamp: 200,
            num_boids: 20, // Different count
            data: vec![0u8; 20 * 16],
        };
        
        let delta = DeltaState::encode_delta(&state2, &state1).unwrap();
        // Should fall back to full state when counts differ
        assert_eq!(delta.num_boids, 20);
        assert_eq!(delta.deltas.len(), state2.data.len());
    }

    #[test]
    fn test_broadcast_state_roundtrip() {
        // Test that encoding and decoding preserves data
        let original_data: Vec<f32> = (0..40).map(|i| i as f32 * 0.1).collect();
        
        // Manually create encoded data
        let mut encoded = Vec::new();
        for val in &original_data {
            encoded.extend_from_slice(&val.to_le_bytes());
        }
        
        // Decode
        let decoded = BroadcastState::decode(&encoded).unwrap();
        
        assert_eq!(decoded.len(), original_data.len());
        for (orig, dec) in original_data.iter().zip(decoded.iter()) {
            assert!((orig - dec).abs() < 0.0001, "Values should match");
        }
    }
}
