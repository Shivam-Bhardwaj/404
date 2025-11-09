// GPU statistics collection using NVML (NVIDIA Management Library)
// Falls back to basic CUDA queries if NVML is unavailable
use anyhow::{Context, Result};
use rustacuda::prelude::*;
use serde::Serialize;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Serialize, Clone)]
pub struct GpuStats {
    pub gpu_utilization: Option<u32>,      // 0-100%
    pub memory_utilization: Option<u32>,   // 0-100%
    pub memory_used_mb: Option<u64>,
    pub memory_total_mb: Option<u64>,
    pub temperature_c: Option<u32>,
    pub timestamp: u64,
}

// Cache for GPU stats to avoid excessive queries
struct StatsCache {
    stats: Option<GpuStats>,
    last_update: Instant,
    update_interval: Duration,
}

static STATS_CACHE: Mutex<Option<StatsCache>> = Mutex::new(None);

const CACHE_DURATION_MS: u64 = 500; // Cache for 500ms

#[cfg(feature = "gpu-stats")]
/// Initialize NVML if available
fn init_nvml() -> Result<()> {
    unsafe {
        let status = nvidia_ml_sys::nvmlInit_v2();
        if status == nvidia_ml_sys::NVML_SUCCESS {
            Ok(())
        } else {
            Err(anyhow::anyhow!("NVML initialization failed with status: {}", status))
        }
    }
}

#[cfg(feature = "gpu-stats")]
/// Check if NVML is available
fn nvml_available() -> bool {
    unsafe {
        let status = nvidia_ml_sys::nvmlInit_v2();
        if status == nvidia_ml_sys::NVML_SUCCESS {
            // Shutdown immediately - we'll init again when needed
            nvidia_ml_sys::nvmlShutdown();
            true
        } else {
            false
        }
    }
}

#[cfg(not(feature = "gpu-stats"))]
/// Check if NVML is available (always false when feature disabled)
fn nvml_available() -> bool {
    false
}

#[cfg(feature = "gpu-stats")]
/// Get GPU stats using NVML
fn get_gpu_stats_nvml() -> Result<GpuStats> {
    unsafe {
        init_nvml()?;
        
        let mut device: nvidia_ml_sys::nvmlDevice_t = std::ptr::null_mut();
        let status = nvidia_ml_sys::nvmlDeviceGetHandleByIndex_v2(0, &mut device);
        if status != nvidia_ml_sys::NVML_SUCCESS {
            nvidia_ml_sys::nvmlShutdown();
            return Err(anyhow::anyhow!("Failed to get device handle: {}", status));
        }

        // Get utilization rates
        let mut utilization = nvidia_ml_sys::nvmlUtilization_t {
            gpu: 0,
            memory: 0,
        };
        let mut gpu_util = None;
        let mut mem_util = None;
        let util_status = nvidia_ml_sys::nvmlDeviceGetUtilizationRates(device, &mut utilization);
        if util_status == nvidia_ml_sys::NVML_SUCCESS {
            gpu_util = Some(utilization.gpu);
            mem_util = Some(utilization.memory);
        }

        // Get memory info
        let mut memory_info = nvidia_ml_sys::nvmlMemory_t {
            total: 0,
            free: 0,
            used: 0,
        };
        let mut mem_used_mb = None;
        let mut mem_total_mb = None;
        let mem_status = nvidia_ml_sys::nvmlDeviceGetMemoryInfo(device, &mut memory_info);
        if mem_status == nvidia_ml_sys::NVML_SUCCESS {
            mem_used_mb = Some(memory_info.used / (1024 * 1024)); // Convert to MB
            mem_total_mb = Some(memory_info.total / (1024 * 1024));
        }

        // Get temperature
        let mut temp = 0u32;
        let mut temp_c = None;
        let temp_status = nvidia_ml_sys::nvmlDeviceGetTemperature(
            device,
            nvidia_ml_sys::NVML_TEMPERATURE_GPU,
            &mut temp,
        );
        if temp_status == nvidia_ml_sys::NVML_SUCCESS {
            temp_c = Some(temp);
        }

        nvidia_ml_sys::nvmlShutdown();

        Ok(GpuStats {
            gpu_utilization: gpu_util,
            memory_utilization: mem_util,
            memory_used_mb: mem_used_mb,
            memory_total_mb: mem_total_mb,
            temperature_c: temp_c,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        })
    }
}

/// Get basic GPU stats using CUDA runtime (fallback)
fn get_gpu_stats_cuda(device: &Device) -> Result<GpuStats> {
    // CUDA runtime doesn't provide utilization directly
    // We can only get memory info
    let mem_info = device.total_memory()
        .context("Failed to get device total memory")?;
    
    // Try to get free memory (this might not be accurate)
    // CUDA runtime doesn't expose free memory directly, so we'll estimate
    let mem_total_mb = (mem_info / (1024 * 1024)) as u64;
    
    Ok(GpuStats {
        gpu_utilization: None,
        memory_utilization: None,
        memory_used_mb: None, // Can't get accurate used memory from CUDA runtime alone
        memory_total_mb: Some(mem_total_mb),
        temperature_c: None,
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    })
}

/// Get GPU stats with caching
pub fn get_gpu_stats(device: Option<&Device>) -> Result<GpuStats> {
    let mut cache_guard = STATS_CACHE.lock().unwrap();
    
    // Check cache
    if let Some(ref cache) = *cache_guard {
        if cache.last_update.elapsed() < cache.update_interval {
            if let Some(ref stats) = cache.stats {
                return Ok(stats.clone());
            }
        }
    }

    // Get fresh stats
    let stats = if cfg!(feature = "gpu-stats") && nvml_available() {
        #[cfg(feature = "gpu-stats")]
        {
            get_gpu_stats_nvml().unwrap_or_else(|_| {
                // Fallback to CUDA if NVML fails
                if let Some(dev) = device {
                    get_gpu_stats_cuda(dev).unwrap_or_else(|_| GpuStats {
                        gpu_utilization: None,
                        memory_utilization: None,
                        memory_used_mb: None,
                        memory_total_mb: None,
                        temperature_c: None,
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64,
                    })
                } else {
                    GpuStats {
                        gpu_utilization: None,
                        memory_utilization: None,
                        memory_used_mb: None,
                        memory_total_mb: None,
                        temperature_c: None,
                        timestamp: std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64,
                    }
                }
            })
        }
        #[cfg(not(feature = "gpu-stats"))]
        {
            // Feature disabled - use CUDA fallback
            if let Some(dev) = device {
                get_gpu_stats_cuda(dev).unwrap_or_else(|_| GpuStats {
                    gpu_utilization: None,
                    memory_utilization: None,
                    memory_used_mb: None,
                    memory_total_mb: None,
                    temperature_c: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                })
            } else {
                GpuStats {
                    gpu_utilization: None,
                    memory_utilization: None,
                    memory_used_mb: None,
                    memory_total_mb: None,
                    temperature_c: None,
                    timestamp: std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64,
                }
            }
        }
    } else if let Some(dev) = device {
        get_gpu_stats_cuda(dev).unwrap_or_else(|_| GpuStats {
            gpu_utilization: None,
            memory_utilization: None,
            memory_used_mb: None,
            memory_total_mb: None,
            temperature_c: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        })
    } else {
        GpuStats {
            gpu_utilization: None,
            memory_utilization: None,
            memory_used_mb: None,
            memory_total_mb: None,
            temperature_c: None,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        }
    };

    // Update cache
    *cache_guard = Some(StatsCache {
        stats: Some(stats.clone()),
        last_update: Instant::now(),
        update_interval: Duration::from_millis(CACHE_DURATION_MS),
    });

    Ok(stats)
}

