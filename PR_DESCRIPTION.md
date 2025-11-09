# feat: Add GPU utilization stats to tech stack section

## Description

This PR adds comprehensive GPU utilization statistics to the tech stack section, addressing issue #4.

## Changes

### Backend
- Added NVML dependency (`nvidia-ml-sys`) for GPU monitoring
- Created `gpu_stats.rs` module with NVML/CUDA fallback support
- Added `/api/gpu-stats` endpoint returning:
  - GPU utilization percentage (compute)
  - Memory utilization percentage
  - Memory usage (used/total in MB)
  - GPU temperature (°C)
- Implemented 500ms caching to reduce query overhead

### Frontend
- Added `fetchGpuStats()` function to API client
- Enhanced TechStack component with:
  - Real-time GPU stats polling (1.5s interval)
  - New "GPU Performance" section with visual indicators
  - Progress bars with color-coded thresholds
  - Temperature monitoring with warning/critical states
  - Enhanced latency breakdowns (compute, network, RTT)

## Features
- Real-time GPU monitoring with visual indicators
- Graceful fallbacks when NVML/GPU unavailable
- Performance-optimized with caching
- Color-coded warnings for high utilization/temperature
- Detailed latency breakdowns for performance diagnosis

## Testing
- Tested with NVML available (NVIDIA GPU)
- Tested fallback to CUDA runtime queries
- Verified error handling for unavailable GPU

## Files Changed
- `backend/src/gpu_stats.rs` (new file)
- `backend/src/main.rs`
- `backend/Cargo.toml`
- `lib/api/physics.ts`
- `app/components/TechStack.tsx`

Fixes #4

