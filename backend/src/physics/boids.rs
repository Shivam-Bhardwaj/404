// Boids algorithm simulation
// Extended Reynolds rules with genetic evolution
use crate::cuda::CudaContext;
use anyhow::Result;
use rand::Rng;
use rustacuda::launch;
use rustacuda::memory::DeviceBuffer;
use rustacuda::memory::DeviceCopy;
use rustacuda::prelude::*;
use std::ffi::CString;
use std::sync::Arc;

#[repr(C)]
#[derive(Clone, Copy, Default)]
pub struct Boid {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub species: u8,
}

unsafe impl DeviceCopy for Boid {}

struct HostBuffers {
    boids: Vec<Boid>,
    x: Vec<f32>,
    y: Vec<f32>,
    vx: Vec<f32>,
    vy: Vec<f32>,
    species: Vec<u8>,
}

impl HostBuffers {
    fn new(count: usize) -> Self {
        Self {
            boids: vec![Boid::default(); count],
            x: vec![0.0; count],
            y: vec![0.0; count],
            vx: vec![0.0; count],
            vy: vec![0.0; count],
            species: vec![0; count],
        }
    }

    fn len(&self) -> usize {
        self.boids.len()
    }

    fn copy_from_slice(&mut self, boids: &[Boid]) {
        debug_assert_eq!(self.len(), boids.len());
        self.boids.copy_from_slice(boids);
        self.sync_scalars_from_boids();
    }

    fn sync_scalars_from_boids(&mut self) {
        for (idx, boid) in self.boids.iter().enumerate() {
            self.x[idx] = boid.x;
            self.y[idx] = boid.y;
            self.vx[idx] = boid.vx;
            self.vy[idx] = boid.vy;
            self.species[idx] = boid.species;
        }
    }

    fn rebuild_boids_from_scalars(&mut self) {
        for i in 0..self.boids.len() {
            self.boids[i] = Boid {
                x: self.x[i],
                y: self.y[i],
                vx: self.vx[i],
                vy: self.vy[i],
                species: self.species[i],
            };
        }
    }
}

pub struct BoidsSimulation {
    context: Arc<CudaContext>,
    num_boids: usize,
    boids: DeviceBuffer<Boid>,
    // SoA device buffers (used if CUDA kernel is available)
    d_x: Option<DeviceBuffer<f32>>,
    d_y: Option<DeviceBuffer<f32>>,
    d_vx: Option<DeviceBuffer<f32>>,
    d_vy: Option<DeviceBuffer<f32>>,
    d_species: Option<DeviceBuffer<u8>>,
    ptx: Option<String>,
    soa_dirty: bool,
    aos_dirty: bool,
    last_used_cuda: bool,
    // Boids parameters
    separation_radius: f32,
    alignment_radius: f32,
    cohesion_radius: f32,
    max_speed: f32,
    max_force: f32,
    host_buffers: HostBuffers,
}

impl BoidsSimulation {
    pub fn new(context: &Arc<CudaContext>, num_boids: usize) -> Result<Self> {
        // Context should already be initialized by caller

        // Initialize boids randomly
        let mut host_boids = Vec::new();
        let mut rng = rand::thread_rng();
        for _ in 0..num_boids {
            host_boids.push(Boid {
                x: rng.gen::<f32>(),
                y: rng.gen::<f32>(),
                vx: rng.gen_range(-0.03..0.03),
                vy: rng.gen_range(-0.03..0.03),
                species: rng.gen_range(0..=3),
            });
        }

        let boids = DeviceBuffer::from_slice(&host_boids)
            .map_err(|e| anyhow::anyhow!("Failed to allocate boids: {:?}", e))?;
        let mut host_buffers = HostBuffers::new(num_boids);
        host_buffers.copy_from_slice(&host_boids);
        // Try to prepare CUDA kernel (PTX provided by build.rs via BOIDS_PTX)
        let mut d_x = None;
        let mut d_y = None;
        let mut d_vx = None;
        let mut d_vy = None;
        let mut d_species = None;
        let mut ptx_opt = None;
        let mut soa_dirty = true;

        if let Some(ptx_path) = option_env!("BOIDS_PTX") {
            if let Ok(ptx) = std::fs::read_to_string(ptx_path) {
                // Initialize SoA buffers with current values now; PTX will be used on-demand
                let dx = DeviceBuffer::from_slice(&host_buffers.x)
                    .map_err(|e| anyhow::anyhow!("alloc d_x: {:?}", e))?;
                let dy = DeviceBuffer::from_slice(&host_buffers.y)
                    .map_err(|e| anyhow::anyhow!("alloc d_y: {:?}", e))?;
                let dvx = DeviceBuffer::from_slice(&host_buffers.vx)
                    .map_err(|e| anyhow::anyhow!("alloc d_vx: {:?}", e))?;
                let dvy = DeviceBuffer::from_slice(&host_buffers.vy)
                    .map_err(|e| anyhow::anyhow!("alloc d_vy: {:?}", e))?;
                let dspec = DeviceBuffer::from_slice(&host_buffers.species)
                    .map_err(|e| anyhow::anyhow!("alloc d_species: {:?}", e))?;
                d_x = Some(dx);
                d_y = Some(dy);
                d_vx = Some(dvx);
                d_vy = Some(dvy);
                d_species = Some(dspec);
                ptx_opt = Some(ptx);
                soa_dirty = false;
            }
        }

        Ok(Self {
            context: Arc::clone(context),
            num_boids,
            boids,
            d_x,
            d_y,
            d_vx,
            d_vy,
            d_species,
            ptx: ptx_opt,
            soa_dirty,
            aos_dirty: false,
            last_used_cuda: false,
            separation_radius: 0.05,
            alignment_radius: 0.1,
            cohesion_radius: 0.15,
            max_speed: 0.05,
            max_force: 0.01,
            host_buffers,
        })
    }

    pub fn num_boids(&self) -> usize {
        self.num_boids
    }

    pub fn step(&mut self, dt: f32) -> Result<()> {
        if self.ptx.is_some() && self.has_soa() {
            if self.soa_dirty {
                self.sync_soa_from_aos()?;
            }
            let ptx = self.ptx.as_ref().unwrap();
            let dx = self.d_x.as_mut().unwrap();
            let dy = self.d_y.as_mut().unwrap();
            let dvx = self.d_vx.as_mut().unwrap();
            let dvy = self.d_vy.as_mut().unwrap();
            let dspecies = self.d_species.as_mut().unwrap();

            let ptx_c = CString::new(ptx.as_str()).unwrap();
            let module = Module::load_from_string(&ptx_c)
                .map_err(|e| anyhow::anyhow!("Failed to load boids PTX: {:?}", e))?;
            let func = module
                .get_function(&CString::new("boids_step").unwrap())
                .map_err(|e| anyhow::anyhow!("Failed to get boids_step: {:?}", e))?;
            let stream = Stream::new(StreamFlags::DEFAULT, None)
                .map_err(|e| anyhow::anyhow!("Failed to create stream: {:?}", e))?;

            let n = self.num_boids as i32;
            let block = (128u32, 1u32, 1u32);
            let grid = (
                ((self.num_boids as u32) + block.0 - 1) / block.0,
                1u32,
                1u32,
            );
            unsafe {
                launch!(
                    func<<<grid, block, 0, stream>>>(
                        n,
                        dt as f32,
                        self.separation_radius as f32,
                        self.alignment_radius as f32,
                        self.cohesion_radius as f32,
                        1.5f32,
                        1.0f32,
                        0.3f32,
                        self.max_speed as f32,
                        dspecies.as_device_ptr(),
                        dx.as_device_ptr(),
                        dy.as_device_ptr(),
                        dvx.as_device_ptr(),
                        dvy.as_device_ptr(),
                        1_000i32,
                        1_000i32
                    )
                )
                .map_err(|e| anyhow::anyhow!("boids_step launch failed: {:?}", e))?;
            }
            stream
                .synchronize()
                .map_err(|e| anyhow::anyhow!("boids_step sync failed: {:?}", e))?;

            self.aos_dirty = true;
            self.last_used_cuda = true;
            self.soa_dirty = false;
            return Ok(());
        }

        // CPU fallback
        self.ensure_aos_current()?;
        let host_boids = &mut self.host_buffers.boids;
        self.boids
            .copy_to(&mut host_boids[..])
            .map_err(|e| anyhow::anyhow!("Failed to copy boids: {:?}", e))?;

        // Boids algorithm: Separation, Alignment, Cohesion
        for i in 0..self.num_boids {
            let mut sep_x = 0.0;
            let mut sep_y = 0.0;
            let mut align_x = 0.0;
            let mut align_y = 0.0;
            let mut coh_x = 0.0;
            let mut coh_y = 0.0;
            let mut sep_count = 0;
            let mut align_count = 0;
            let mut coh_count = 0;

            let bi = &host_boids[i];

            for j in 0..self.num_boids {
                if i == j {
                    continue;
                }

                let bj = &host_boids[j];
                let dx = bi.x - bj.x;
                let dy = bi.y - bj.y;
                let dist_sq = dx * dx + dy * dy;
                let dist = dist_sq.sqrt();

                // Only consider same species (simplified)
                if bi.species == bj.species {
                    // Separation
                    if dist < self.separation_radius && dist > 0.0 {
                        sep_x += dx / dist;
                        sep_y += dy / dist;
                        sep_count += 1;
                    }

                    // Alignment
                    if dist < self.alignment_radius {
                        align_x += bj.vx;
                        align_y += bj.vy;
                        align_count += 1;
                    }

                    // Cohesion
                    if dist < self.cohesion_radius {
                        coh_x += bj.x;
                        coh_y += bj.y;
                        coh_count += 1;
                    }
                }
            }

            // Calculate forces
            let mut fx = 0.0;
            let mut fy = 0.0;

            // Separation force
            if sep_count > 0 {
                let sep_mag = (sep_x * sep_x + sep_y * sep_y).sqrt();
                if sep_mag > 0.0 {
                    fx += (sep_x / sep_mag) * self.max_force;
                    fy += (sep_y / sep_mag) * self.max_force;
                }
            }

            // Alignment force
            if align_count > 0 {
                let align_mag = (align_x * align_x + align_y * align_y).sqrt();
                if align_mag > 0.0 {
                    let target_vx = (align_x / align_count as f32) - bi.vx;
                    let target_vy = (align_y / align_count as f32) - bi.vy;
                    let target_mag = (target_vx * target_vx + target_vy * target_vy).sqrt();
                    if target_mag > 0.0 {
                        fx += (target_vx / target_mag) * self.max_force * 0.5;
                        fy += (target_vy / target_mag) * self.max_force * 0.5;
                    }
                }
            }

            // Cohesion force
            if coh_count > 0 {
                let avg_x = coh_x / coh_count as f32;
                let avg_y = coh_y / coh_count as f32;
                let target_x = avg_x - bi.x;
                let target_y = avg_y - bi.y;
                let target_mag = (target_x * target_x + target_y * target_y).sqrt();
                if target_mag > 0.0 {
                    fx += (target_x / target_mag) * self.max_force * 0.3;
                    fy += (target_y / target_mag) * self.max_force * 0.3;
                }
            }

            // Update velocity
            host_boids[i].vx += fx * dt;
            host_boids[i].vy += fy * dt;

            // Limit speed
            let speed =
                (host_boids[i].vx * host_boids[i].vx + host_boids[i].vy * host_boids[i].vy).sqrt();
            if speed > self.max_speed {
                host_boids[i].vx = (host_boids[i].vx / speed) * self.max_speed;
                host_boids[i].vy = (host_boids[i].vy / speed) * self.max_speed;
            }

            // Update position
            host_boids[i].x += host_boids[i].vx * dt;
            host_boids[i].y += host_boids[i].vy * dt;

            // Wrap around boundaries
            if host_boids[i].x < 0.0 {
                host_boids[i].x += 1.0;
            }
            if host_boids[i].x > 1.0 {
                host_boids[i].x -= 1.0;
            }
            if host_boids[i].y < 0.0 {
                host_boids[i].y += 1.0;
            }
            if host_boids[i].y > 1.0 {
                host_boids[i].y -= 1.0;
            }
        }

        // Copy back to device
        self.boids
            .copy_from(&host_boids[..])
            .map_err(|e| anyhow::anyhow!("Failed to copy boids back: {:?}", e))?;
        self.last_used_cuda = false;
        self.soa_dirty = true;
        self.aos_dirty = false;
        Ok(())
    }

    fn has_soa(&self) -> bool {
        self.d_x.is_some()
            && self.d_y.is_some()
            && self.d_vx.is_some()
            && self.d_vy.is_some()
            && self.d_species.is_some()
    }

    fn sync_soa_from_aos(&mut self) -> Result<()> {
        if !self.has_soa() {
            self.soa_dirty = false;
            return Ok(());
        }
        self.boids
            .copy_to(&mut self.host_buffers.boids[..])
            .map_err(|e| anyhow::anyhow!("Failed to stage boids for SoA sync: {:?}", e))?;
        self.host_buffers.sync_scalars_from_boids();
        if let (Some(dx), Some(dy), Some(dvx), Some(dvy), Some(dspecies)) = (
            self.d_x.as_mut(),
            self.d_y.as_mut(),
            self.d_vx.as_mut(),
            self.d_vy.as_mut(),
            self.d_species.as_mut(),
        ) {
            dx.copy_from(&self.host_buffers.x[..])
                .map_err(|e| anyhow::anyhow!("sync hx->dx: {:?}", e))?;
            dy.copy_from(&self.host_buffers.y[..])
                .map_err(|e| anyhow::anyhow!("sync hy->dy: {:?}", e))?;
            dvx.copy_from(&self.host_buffers.vx[..])
                .map_err(|e| anyhow::anyhow!("sync hvx->dvx: {:?}", e))?;
            dvy.copy_from(&self.host_buffers.vy[..])
                .map_err(|e| anyhow::anyhow!("sync hvy->dvy: {:?}", e))?;
            dspecies
                .copy_from(&self.host_buffers.species[..])
                .map_err(|e| anyhow::anyhow!("sync species: {:?}", e))?;
        }
        self.soa_dirty = false;
        Ok(())
    }

    fn sync_aos_from_soa(&mut self) -> Result<()> {
        if !self.has_soa() {
            self.aos_dirty = false;
            return Ok(());
        }
        
        // Ensure CUDA context is set up before accessing device memory
        self.context.ensure_context()?;
        
        if let (Some(dx), Some(dy), Some(dvx), Some(dvy), Some(dspecies)) = (
            self.d_x.as_ref(),
            self.d_y.as_ref(),
            self.d_vx.as_ref(),
            self.d_vy.as_ref(),
            self.d_species.as_ref(),
        ) {
            dx.copy_to(&mut self.host_buffers.x[..])
                .map_err(|e| anyhow::anyhow!("dx->host: {:?}", e))?;
            dy.copy_to(&mut self.host_buffers.y[..])
                .map_err(|e| anyhow::anyhow!("dy->host: {:?}", e))?;
            dvx.copy_to(&mut self.host_buffers.vx[..])
                .map_err(|e| anyhow::anyhow!("dvx->host: {:?}", e))?;
            dvy.copy_to(&mut self.host_buffers.vy[..])
                .map_err(|e| anyhow::anyhow!("dvy->host: {:?}", e))?;
            dspecies
                .copy_to(&mut self.host_buffers.species[..])
                .map_err(|e| anyhow::anyhow!("species->host: {:?}", e))?;
        }
        self.host_buffers.rebuild_boids_from_scalars();
        self.boids
            .copy_from(&self.host_buffers.boids[..])
            .map_err(|e| anyhow::anyhow!("copy SoA boids back: {:?}", e))?;
        self.aos_dirty = false;
        Ok(())
    }

    fn ensure_aos_current(&mut self) -> Result<()> {
        if self.aos_dirty {
            self.sync_aos_from_soa()?;
        }
        Ok(())
    }

    pub fn get_boids(&mut self) -> Result<Vec<f32>> {
        // Ensure CUDA context is set up in current thread before accessing device memory
        self.context.ensure_context()?;
        
        self.ensure_aos_current()?;
        let host_boids = &mut self.host_buffers.boids;
        self.boids
            .copy_to(&mut host_boids[..])
            .map_err(|e| anyhow::anyhow!("Failed to copy boids: {:?}", e))?;
        let mut result = Vec::with_capacity(self.num_boids * 4);
        for b in host_boids.iter() {
            result.push(b.x);
            result.push(b.y);
            result.push(b.vx);
            result.push(b.vy);
        }

        Ok(result)
    }

    pub fn used_cuda(&self) -> bool {
        self.last_used_cuda
    }
}

unsafe impl Send for BoidsSimulation {}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cuda::init_cuda_in_thread;

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
    fn test_boids_initialization() {
        let (context, _context_guard) = setup_test_context();
        let sim = BoidsSimulation::new(&context, 1000);
        assert!(sim.is_ok(), "Boids simulation should initialize");
    }

    #[test]
    fn test_boids_step() {
        let (context, _context_guard) = setup_test_context();
        let mut sim = BoidsSimulation::new(&context, 1000).unwrap();
        let result = sim.step(0.016);
        assert!(result.is_ok(), "Boids step should succeed");
    }

    #[test]
    fn test_boids_count() {
        let (context, _context_guard) = setup_test_context();
        let mut sim = BoidsSimulation::new(&context, 1000).unwrap();
        let boids = sim.get_boids().unwrap();
        assert_eq!(boids.len(), 1000 * 4, "Should return boid data");
    }
}
