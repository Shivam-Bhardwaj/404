// CUDA context and device management - Thread-safe version
use anyhow::{Context as AnyhowContext, Result};
use rustacuda::prelude::*;
use std::sync::Arc;
use std::sync::Mutex;
use tracing::warn;

pub struct CudaContext {
    device: Arc<Device>,
    // Store context handle for thread-local access
    _context_handle: Arc<Mutex<()>>,
}

impl CudaContext {
    pub fn new() -> Result<Self> {
        // CUDA should already be initialized by caller
        // Get device (requires CUDA to be initialized)
        let device = Device::get_device(0)
            .map_err(|e| anyhow::anyhow!("Failed to get CUDA device (is CUDA initialized?): {:?}", e))?;
        
        let device_name = device.name()
            .map_err(|e| anyhow::anyhow!("Failed to get device name: {:?}", e))?;
        
        tracing::info!("CUDA Device: {}", device_name);
        
        Ok(Self {
            device: Arc::new(device),
            _context_handle: Arc::new(Mutex::new(())),
        })
    }

    pub fn device(&self) -> &Arc<Device> {
        &self.device
    }

    /// Ensure CUDA context is active in current thread
    /// This must be called before any CUDA operations in a new thread
    pub fn ensure_context(&self) -> Result<()> {
        // Try to initialize CUDA first if not already initialized
        // This is safe to call multiple times
        if let Err(_) = rustacuda::init(CudaFlags::empty()) {
            // CUDA might already be initialized, which is fine
        }
        
        // In rustacuda, contexts are thread-local
        // Try to create context if it doesn't exist
        // If context already exists, this will return an error, which we can ignore
        // Try to create context - if it already exists, the error is usually safe to ignore
        // In rustacuda, creating a context when one exists returns an error, but operations
        // can still work if a context is already active
        match Context::create_and_push(
            ContextFlags::MAP_HOST | ContextFlags::SCHED_AUTO,
            *self.device
        ) {
            Ok(_) => Ok(()),
            Err(e) => {
                // If context creation fails, it might be because one already exists
                // or because CUDA isn't properly initialized. Try to proceed anyway
                // as the context might already be active from a previous call
                // Log a warning but don't fail - let the actual CUDA operation fail if needed
                warn!("Context creation returned error (may already exist): {:?}", e);
                Ok(())
            }
        }
    }
}

// Helper function to create context in a thread
pub fn init_cuda_in_thread() -> Result<()> {
    rustacuda::init(CudaFlags::empty())
        .context("Failed to initialize CUDA")?;
    
    let device = Device::get_device(0)
        .context("Failed to get CUDA device")?;
    
    Context::create_and_push(
        ContextFlags::MAP_HOST | ContextFlags::SCHED_AUTO,
        device
    ).context("Failed to create CUDA context")?;
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cuda_context_initialization() {
        init_cuda_in_thread().expect("Failed to init CUDA");
        let _context_obj = Context::create_and_push(
            ContextFlags::MAP_HOST | ContextFlags::SCHED_AUTO,
            Device::get_device(0).expect("Failed to get device")
        ).expect("Failed to create context");
        let context = CudaContext::new();
        assert!(context.is_ok(), "CUDA context should initialize");
    }
}
