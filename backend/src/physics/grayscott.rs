// Gray-Scott reaction-diffusion simulation
// Based on Turing pattern equations
use crate::cuda::CudaContext;
use anyhow::Result;
use rustacuda::prelude::*;
use rustacuda::memory::DeviceBuffer;
use std::ffi::CString;
#[cfg(feature = "cuda-kernel")]
use nvrtc::Program;
use std::sync::Arc;

pub struct GrayScottSimulation {
    context: Arc<CudaContext>,
    width: usize,
    height: usize,
    u_field: DeviceBuffer<f32>,  // Concentration field u
    v_field: DeviceBuffer<f32>,  // Catalyst field v
    u_temp: DeviceBuffer<f32>,    // Temporary buffer for u
    v_temp: DeviceBuffer<f32>,   // Temporary buffer for v
    // Gray-Scott parameters
    du: f32,  // Diffusion rate for u
    dv: f32,  // Diffusion rate for v
    f: f32,   // Feed rate
    k: f32,   // Kill rate
    // CUDA kernel module/function
    #[cfg(feature = "cuda-kernel")]
    module: Module,
    #[cfg(feature = "cuda-kernel")]
    func: Function<'static>,
    #[cfg(feature = "cuda-kernel")]
    stream: Stream,
}

impl GrayScottSimulation {
    pub fn new(context: &Arc<CudaContext>, width: usize, height: usize) -> Result<Self> {
        // Context should already be initialized by caller
        
        let size = width * height;
        
        // Initialize u field (mostly 1.0)
        let mut u_host = vec![1.0f32; size];
        // Add some initial pattern in center
        let center_x = width / 2;
        let center_y = height / 2;
        for y in 0..height {
            for x in 0..width {
                let dx = x as i32 - center_x as i32;
                let dy = y as i32 - center_y as i32;
                let dist_sq = (dx * dx + dy * dy) as f32;
                if dist_sq < 100.0 {
                    let idx = y * width + x;
                    u_host[idx] = 0.5;
                }
            }
        }
        
        // Initialize v field (mostly 0.0)
        let mut v_host = vec![0.0f32; size];
        // Add catalyst in center
        for y in 0..height {
            for x in 0..width {
                let dx = x as i32 - center_x as i32;
                let dy = y as i32 - center_y as i32;
                let dist_sq = (dx * dx + dy * dy) as f32;
                if dist_sq < 25.0 {
                    let idx = y * width + x;
                    v_host[idx] = 0.25;
                }
            }
        }
        
        let u_field = DeviceBuffer::from_slice(&u_host)
            .map_err(|e| anyhow::anyhow!("Failed to allocate u field: {:?}", e))?;
        let v_field = DeviceBuffer::from_slice(&v_host)
            .map_err(|e| anyhow::anyhow!("Failed to allocate v field: {:?}", e))?;
        let u_temp = DeviceBuffer::from_slice(&u_host)
            .map_err(|e| anyhow::anyhow!("Failed to allocate u_temp: {:?}", e))?;
        let v_temp = DeviceBuffer::from_slice(&v_host)
            .map_err(|e| anyhow::anyhow!("Failed to allocate v_temp: {:?}", e))?;
        
        // Compile CUDA kernel at runtime using NVRTC (when enabled)
        #[cfg(feature = "cuda-kernel")]
        let src = r#"
        extern "C" __global__ void gray_scott_step(
            const int width, const int height, const float du, const float dv,
            const float f, const float k, const float dt,
            const float* u_in, const float* v_in, float* u_out, float* v_out
        ) {
            int x = blockIdx.x * blockDim.x + threadIdx.x;
            int y = blockIdx.y * blockDim.y + threadIdx.y;
            if (x >= width || y >= height) return;
            int idx = y * width + x;

            // Clamp helper
            auto clamp_coord = [&](int xx, int yy) {
                if (xx < 0) xx = 0; if (xx >= width) xx = width - 1;
                if (yy < 0) yy = 0; if (yy >= height) yy = height - 1;
                return yy * width + xx;
            };

            float u = u_in[idx];
            float v = v_in[idx];
            float lap_u = 0.0f;
            float lap_v = 0.0f;
            // 5-point stencil
            int l = clamp_coord(x-1, y);
            int r = clamp_coord(x+1, y);
            int uidx = clamp_coord(x, y-1);
            int didx = clamp_coord(x, y+1);
            lap_u = (u_in[l] + u_in[r] + u_in[uidx] + u_in[didx] - 4.0f * u);
            lap_v = (v_in[l] + v_in[r] + v_in[uidx] + v_in[didx] - 4.0f * v);

            float uvv = u * v * v;
            float du_dt = du * lap_u - uvv + f * (1.0f - u);
            float dv_dt = dv * lap_v + uvv - (f + k) * v;

            float un = u + du_dt * dt;
            float vn = v + dv_dt * dt;
            if (un < 0.0f) un = 0.0f; if (un > 1.0f) un = 1.0f;
            if (vn < 0.0f) vn = 0.0f; if (vn > 1.0f) vn = 1.0f;
            u_out[idx] = un;
            v_out[idx] = vn;
        }
        "#;

        #[cfg(feature = "cuda-kernel")]
        let prog = Program::new(src).map_err(|e| anyhow::anyhow!("NVRTC program error: {:?}", e))?;
        #[cfg(feature = "cuda-kernel")]
        prog.compile(&[])
            .map_err(|e| anyhow::anyhow!("NVRTC compile error: {:?}", e))?;
        #[cfg(feature = "cuda-kernel")]
        let ptx = prog.get_ptx().map_err(|e| anyhow::anyhow!("NVRTC get_ptx error: {:?}", e))?;

        // Load module and get function
        #[cfg(feature = "cuda-kernel")]
        let ptx_c = CString::new(ptx).unwrap();
        #[cfg(feature = "cuda-kernel")]
        let module = Module::load_from_string(&ptx_c)
            .map_err(|e| anyhow::anyhow!("Failed to load PTX module: {:?}", e))?;
        #[cfg(feature = "cuda-kernel")]
        let func = module.get_function(&CString::new("gray_scott_step").unwrap())
            .map_err(|e| anyhow::anyhow!("Failed to get kernel function: {:?}", e))?;

        #[cfg(feature = "cuda-kernel")]
        let stream = Stream::new(StreamFlags::DEFAULT, None)
            .map_err(|e| anyhow::anyhow!("Failed to create stream: {:?}", e))?;

        Ok(Self {
            context: Arc::clone(context),
            width,
            height,
            u_field,
            v_field,
            u_temp,
            v_temp,
            du: 0.16,
            dv: 0.08,
            f: 0.055,
            k: 0.062,
            #[cfg(feature = "cuda-kernel")]
            module,
            #[cfg(feature = "cuda-kernel")]
            func,
            #[cfg(feature = "cuda-kernel")]
            stream,
        })
    }

    pub fn step(&mut self, dt: f32) -> Result<()> {
        // Launch CUDA kernel when enabled; otherwise fallback CPU
        #[cfg(feature = "cuda-kernel")]
        let width_i32 = self.width as i32;
        #[cfg(feature = "cuda-kernel")]
        let height_i32 = self.height as i32;
        #[cfg(feature = "cuda-kernel")]
        let du = self.du;
        #[cfg(feature = "cuda-kernel")]
        let dv = self.dv;
        #[cfg(feature = "cuda-kernel")]
        let f = self.f;
        #[cfg(feature = "cuda-kernel")]
        let k = self.k;
        #[cfg(feature = "cuda-kernel")]
        let dt = dt;

        #[cfg(feature = "cuda-kernel")]
        let block = (16, 16, 1);
        #[cfg(feature = "cuda-kernel")]
        let grid = (
            ((self.width as u32) + block.0 - 1) / block.0,
            ((self.height as u32) + block.1 - 1) / block.1,
            1,
        );

        #[cfg(feature = "cuda-kernel")]
        {
            unsafe {
                launch!(
                    self.func<<<grid, block, 0, self.stream>>>(
                        width_i32, height_i32, du, dv, f, k, dt,
                        self.u_field.as_device_ptr(),
                        self.v_field.as_device_ptr(),
                        self.u_temp.as_device_ptr(),
                        self.v_temp.as_device_ptr()
                    )
                )
                .map_err(|e| anyhow::anyhow!("Kernel launch failed: {:?}", e))?;
            }
            self.stream.synchronize()
                .map_err(|e| anyhow::anyhow!("Stream sync failed: {:?}", e))?;
            std::mem::swap(&mut self.u_field, &mut self.u_temp);
            std::mem::swap(&mut self.v_field, &mut self.v_temp);
            return Ok(());
        }

        #[cfg(not(feature = "cuda-kernel"))]
        {
            // CPU fallback (original implementation)
            let mut u_host = vec![0.0f32; self.width * self.height];
            let mut v_host = vec![0.0f32; self.width * self.height];
            self.u_field.copy_to(&mut u_host[..])
                .map_err(|e| anyhow::anyhow!("Failed to copy u field: {:?}", e))?;
            self.v_field.copy_to(&mut v_host[..])
                .map_err(|e| anyhow::anyhow!("Failed to copy v field: {:?}", e))?;
            for y in 0..self.height {
                for x in 0..self.width {
                    let idx = y * self.width + x;
                    let u = u_host[idx];
                    let v = v_host[idx];
                    let neighbors = [
                        (x as i32, y as i32 - 1),
                        (x as i32, y as i32 + 1),
                        (x as i32 - 1, y as i32),
                        (x as i32 + 1, y as i32),
                    ];
                    let mut lap_u = 0.0;
                    let mut lap_v = 0.0;
                    for (nx, ny) in neighbors.iter() {
                        if *nx >= 0 && *nx < self.width as i32 && *ny >= 0 && *ny < self.height as i32 {
                            let nidx = (*ny as usize) * self.width + (*nx as usize);
                            lap_u += u_host[nidx] - u;
                            lap_v += v_host[nidx] - v;
                        }
                    }
                    let uv2 = u * v * v;
                    let du_dt = self.du * lap_u - uv2 + self.f * (1.0 - u);
                    let dv_dt = self.dv * lap_v + uv2 - (self.f + self.k) * v;
                    u_host[idx] = (u + du_dt * dt).max(0.0).min(1.0);
                    v_host[idx] = (v + dv_dt * dt).max(0.0).min(1.0);
                }
            }
            self.u_field.copy_from(&u_host[..])
                .map_err(|e| anyhow::anyhow!("Failed to copy u field back: {:?}", e))?;
            self.v_field.copy_from(&v_host[..])
                .map_err(|e| anyhow::anyhow!("Failed to copy v field back: {:?}", e))?;
            Ok(())
        }
    }

    pub fn get_field(&self) -> Result<Vec<f32>> {
        let size = self.width * self.height;
        let mut u_host = vec![0.0f32; size];
        self.u_field.copy_to(&mut u_host[..])
            .map_err(|e| anyhow::anyhow!("Failed to copy u field: {:?}", e))?;
        Ok(u_host)
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
    fn test_grayscott_initialization() {
        let (context, _context_guard) = setup_test_context();
        let sim = GrayScottSimulation::new(&context, 512, 512);
        assert!(sim.is_ok(), "Gray-Scott simulation should initialize");
    }

    #[test]
    fn test_grayscott_step() {
        let (context, _context_guard) = setup_test_context();
        let mut sim = GrayScottSimulation::new(&context, 512, 512).unwrap();
        let result = sim.step(0.016);
        assert!(result.is_ok(), "Gray-Scott step should succeed");
    }

    #[test]
    fn test_grayscott_field_size() {
        let (context, _context_guard) = setup_test_context();
        let sim = GrayScottSimulation::new(&context, 512, 512).unwrap();
        let field = sim.get_field().unwrap();
        assert_eq!(field.len(), 512 * 512, "Field should match dimensions");
    }
}
