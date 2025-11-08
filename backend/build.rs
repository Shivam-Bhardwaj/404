use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    // Always tell Cargo to rerun if the kernel changes
    println!("cargo:rerun-if-changed=src/kernels/boids.cu");

    // Try to compile the CUDA kernel with nvcc if available
    let nvcc = which::which("nvcc");
    if nvcc.is_err() {
        println!("cargo:warning=nvcc not found; building without CUDA boids kernel");
        return;
    }

    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let ptx_out = out_dir.join("boids.ptx");

    let status = Command::new(nvcc.unwrap())
        .args([
            "-ptx",
            "-arch=sm_61",
            "src/kernels/boids.cu",
            "-o",
        ])
        .arg(&ptx_out)
        .status()
        .expect("failed to invoke nvcc");

    if !status.success() {
        println!("cargo:warning=nvcc failed to compile boids kernel; CPU fallback will be used");
        return;
    }

    println!("cargo:rustc-env=BOIDS_PTX={}", ptx_out.display());
}

