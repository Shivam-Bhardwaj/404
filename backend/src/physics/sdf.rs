// Signed Distance Field (SDF) rendering
// Perfect circle rendering using SDF
use crate::cuda::CudaContext;
use anyhow::Result;
use rustacuda::memory::DeviceBuffer;
use std::sync::Arc;

#[allow(dead_code)]
pub struct SdfRenderer {
    #[allow(dead_code)]
    context: Arc<CudaContext>,
    width: usize,
    height: usize,
    output: DeviceBuffer<u8>,
}

#[allow(dead_code)]
impl SdfRenderer {
    pub fn new(context: &Arc<CudaContext>, width: usize, height: usize) -> Result<Self> {
        // Context should already be initialized by caller
        
        let size = width * height * 4; // RGBA
        
        // Initialize output buffer
        let output_host = vec![0u8; size];
        let output = DeviceBuffer::from_slice(&output_host)
            .map_err(|e| anyhow::anyhow!("Failed to allocate output buffer: {:?}", e))?;
        
        Ok(Self {
            context: Arc::clone(context),
            width,
            height,
            output,
        })
    }

    pub fn render(&self, _sdf_function: &str) -> Result<Vec<u8>> {
        let size = self.width * self.height * 4;
        let mut output_host = vec![0u8; size];
        
        // Simple CPU-based SDF rendering for now
        // TODO: Implement CUDA kernel
        let center_x = self.width as f32 / 2.0;
        let center_y = self.height as f32 / 2.0;
        let radius = (self.width.min(self.height) as f32 / 2.0) * 0.8;
        
        for y in 0..self.height {
            for x in 0..self.width {
                let dx = x as f32 - center_x;
                let dy = y as f32 - center_y;
                let dist = (dx * dx + dy * dy).sqrt();
                
                // SDF for circle
                let sdf = dist - radius;
                
                // Convert SDF to color (simple threshold for now)
                let idx = (y * self.width + x) * 4;
                if sdf < 0.0 {
                    // Inside circle
                    output_host[idx] = 255;     // R
                    output_host[idx + 1] = 255; // G
                    output_host[idx + 2] = 255; // B
                    output_host[idx + 3] = 255; // A
                } else {
                    // Outside circle
                    output_host[idx] = 0;       // R
                    output_host[idx + 1] = 0;   // G
                    output_host[idx + 2] = 0;   // B
                    output_host[idx + 3] = 255; // A
                }
            }
        }
        
        Ok(output_host)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cuda::init_cuda_in_thread;

    fn setup_test_context() -> (Arc<CudaContext>, rustacuda::context::Context) {
        init_cuda_in_thread().expect("Failed to init CUDA in test thread");
        let context_obj = rustacuda::prelude::Context::create_and_push(
            rustacuda::prelude::ContextFlags::MAP_HOST | rustacuda::prelude::ContextFlags::SCHED_AUTO,
            rustacuda::prelude::Device::get_device(0).expect("Failed to get device")
        ).expect("Failed to create context");
        (Arc::new(CudaContext::new().expect("Failed to create CUDA context")), context_obj)
    }

    #[test]
    fn test_sdf_initialization() {
        let (context, _context_guard) = setup_test_context();
        let renderer = SdfRenderer::new(&context, 512, 512);
        assert!(renderer.is_ok(), "SDF renderer should initialize");
    }

    #[test]
    fn test_sdf_render() {
        let (context, _context_guard) = setup_test_context();
        let renderer = SdfRenderer::new(&context, 512, 512).unwrap();
        let result = renderer.render("circle");
        assert!(result.is_ok(), "SDF render should succeed");
    }

    #[test]
    fn test_sdf_output_size() {
        let (context, _context_guard) = setup_test_context();
        let renderer = SdfRenderer::new(&context, 512, 512).unwrap();
        let output = renderer.render("circle").unwrap();
        assert_eq!(output.len(), 512 * 512 * 4, "Should return RGBA image");
    }
}
