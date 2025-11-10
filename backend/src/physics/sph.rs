// SPH (Smoothed Particle Hydrodynamics) simulation
// Based on Navier-Stokes equations discretized using SPH
use crate::cuda::CudaContext;
use anyhow::Result;
use rustacuda::prelude::*;
use rustacuda::memory::DeviceBuffer;
use rustacuda::memory::DeviceCopy;
use std::sync::Arc;

#[repr(C)]
#[derive(Clone, Copy, Default)]
pub struct Particle {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub density: f32,
    pub pressure: f32,
}

unsafe impl DeviceCopy for Particle {}

pub struct SphSimulation {
    #[allow(dead_code)]
    context: Arc<CudaContext>,
    num_particles: usize,
    particles: DeviceBuffer<Particle>,
    // SPH parameters
    rest_density: f32,
    gas_constant: f32,
    viscosity: f32,
    smoothing_radius: f32,
    mass: f32,
}

impl SphSimulation {
    pub fn new(context: &Arc<CudaContext>) -> Result<Self> {
        // Context should already be initialized by caller (init_cuda_in_thread)
        // No need to call ensure_context() here
        
        let num_particles = 1000;
        
        // Initialize particles in a circle
        let mut host_particles = Vec::new();
        for i in 0..num_particles {
            let angle = (i as f32 / num_particles as f32) * 2.0 * std::f32::consts::PI;
            let radius = 0.3;
            host_particles.push(Particle {
                x: 0.5 + radius * angle.cos(),
                y: 0.5 + radius * angle.sin(),
                vx: -angle.sin() * 0.1,
                vy: angle.cos() * 0.1,
                density: 1000.0,
                pressure: 0.0,
            });
        }
        
        // Copy to device
        let particles = DeviceBuffer::from_slice(&host_particles)
            .map_err(|e| anyhow::anyhow!("Failed to allocate particles: {:?}", e))?;
        
        Ok(Self {
            context: Arc::clone(context),
            num_particles,
            particles,
            rest_density: 1000.0,
            gas_constant: 2000.0,
            viscosity: 0.018,
            smoothing_radius: 0.1,
            mass: 0.02,
        })
    }

    pub fn step(&mut self, dt: f32) -> Result<()> {
        // Copy particles to host for CPU computation
        // TODO: Replace with CUDA kernel for GPU acceleration
        let mut host_particles = vec![Particle::default(); self.num_particles];
        self.particles.copy_to(&mut host_particles[..])
            .map_err(|e| anyhow::anyhow!("Failed to copy particles: {:?}", e))?;
        
        // SPH density calculation
        for i in 0..self.num_particles {
            let mut density = 0.0;
            let pi = &host_particles[i];
            
            for j in 0..self.num_particles {
                let pj = &host_particles[j];
                let dx = pi.x - pj.x;
                let dy = pi.y - pj.y;
                let dist_sq = dx * dx + dy * dy;
                let dist = dist_sq.sqrt();
                
                if dist < self.smoothing_radius {
                    // Cubic spline smoothing kernel
                    let q = dist / self.smoothing_radius;
                    let w = if q < 1.0 {
                        let q2 = q * q;
                        let q3 = q2 * q;
                        1.0 - 1.5 * q2 + 0.75 * q3
                    } else if q < 2.0 {
                        let q2 = q * q;
                        let _q3 = q2 * q;
                        0.25 * (2.0 - q) * (2.0 - q) * (2.0 - q)
                    } else {
                        0.0
                    };
                    
                    density += self.mass * w;
                }
            }
            
            host_particles[i].density = density;
            // Pressure from equation of state
            host_particles[i].pressure = self.gas_constant * (density - self.rest_density);
        }
        
        // SPH force calculation and velocity update
        for i in 0..self.num_particles {
            let mut fx = 0.0;
            let mut fy = 0.0;
            let pi = &host_particles[i];
            
            for j in 0..self.num_particles {
                if i == j { continue; }
                
                let pj = &host_particles[j];
                let dx = pi.x - pj.x;
                let dy = pi.y - pj.y;
                let dist_sq = dx * dx + dy * dy;
                let dist = dist_sq.sqrt().max(0.0001); // Avoid division by zero
                
                if dist < self.smoothing_radius {
                    // Pressure force
                    let pressure_force = -(pi.pressure + pj.pressure) / (2.0 * pj.density);
                    let q = dist / self.smoothing_radius;
                    let dw_dr = if q < 1.0 {
                        -3.0 * q + 2.25 * q * q
                    } else if q < 2.0 {
                        -0.75 * (2.0 - q) * (2.0 - q)
                    } else {
                        0.0
                    };
                    
                    fx += pressure_force * self.mass * dw_dr * (dx / dist);
                    fy += pressure_force * self.mass * dw_dr * (dy / dist);
                    
                    // Viscosity force
                    let dvx = pi.vx - pj.vx;
                    let dvy = pi.vy - pj.vy;
                    let laplacian_w = if q < 1.0 {
                        3.0 - 4.5 * q
                    } else if q < 2.0 {
                        1.5 * (2.0 - q)
                    } else {
                        0.0
                    };
                    
                    fx += self.viscosity * self.mass * laplacian_w * dvx / pj.density;
                    fy += self.viscosity * self.mass * laplacian_w * dvy / pj.density;
                }
            }
            
            // Update velocity
            host_particles[i].vx += fx * dt;
            host_particles[i].vy += fy * dt;
            
            // Update position
            host_particles[i].x += host_particles[i].vx * dt;
            host_particles[i].y += host_particles[i].vy * dt;
            
            // Boundary conditions (bounce)
            if host_particles[i].x < 0.0 || host_particles[i].x > 1.0 {
                host_particles[i].vx *= -0.5;
                host_particles[i].x = host_particles[i].x.clamp(0.0, 1.0);
            }
            if host_particles[i].y < 0.0 || host_particles[i].y > 1.0 {
                host_particles[i].vy *= -0.5;
                host_particles[i].y = host_particles[i].y.clamp(0.0, 1.0);
            }
        }
        
        // Copy back to device
        self.particles.copy_from(&host_particles[..])
            .map_err(|e| anyhow::anyhow!("Failed to copy particles back: {:?}", e))?;
        
        Ok(())
    }

    pub fn get_particles(&self) -> Result<Vec<f32>> {
        // Copy particles back to host
        let mut host_particles = vec![Particle::default(); self.num_particles];
        self.particles.copy_to(&mut host_particles[..])
            .map_err(|e| anyhow::anyhow!("Failed to copy particles: {:?}", e))?;
        
        // Flatten to [x, y, vx, vy, ...]
        let mut result = Vec::with_capacity(self.num_particles * 4);
        for p in host_particles {
            result.push(p.x);
            result.push(p.y);
            result.push(p.vx);
            result.push(p.vy);
        }
        
        Ok(result)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cuda::init_cuda_in_thread;

    fn setup_test_context() -> (Arc<CudaContext>, rustacuda::context::Context) {
        // Initialize CUDA in this test thread and keep context alive
        init_cuda_in_thread().expect("Failed to init CUDA in test thread");
        let context_obj = rustacuda::prelude::Context::create_and_push(
            rustacuda::prelude::ContextFlags::MAP_HOST | rustacuda::prelude::ContextFlags::SCHED_AUTO,
            rustacuda::prelude::Device::get_device(0).expect("Failed to get device")
        ).expect("Failed to create context");
        (Arc::new(CudaContext::new().expect("Failed to create CUDA context")), context_obj)
    }

    #[test]
    fn test_sph_initialization() {
        let (context, _context_guard) = setup_test_context();
        let sim = SphSimulation::new(&context);
        if let Err(e) = &sim {
            eprintln!("SPH initialization error: {:?}", e);
        }
        assert!(sim.is_ok(), "SPH simulation should initialize");
    }

    #[test]
    fn test_sph_step() {
        let (context, _context_guard) = setup_test_context();
        let mut sim = SphSimulation::new(&context).unwrap();
        let result = sim.step(0.016); // ~60 FPS
        assert!(result.is_ok(), "SPH step should succeed");
    }

    #[test]
    fn test_sph_particle_count() {
        let (context, _context_guard) = setup_test_context();
        let sim = SphSimulation::new(&context).unwrap();
        let particles = sim.get_particles().unwrap();
        // Should return 4 values per particle (x, y, vx, vy)
        assert_eq!(particles.len(), 1000 * 4, "Should return particle data");
    }
}
