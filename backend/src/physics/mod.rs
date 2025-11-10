// Physics simulation modules

pub mod sph;
pub mod boids;
pub mod grayscott;
pub mod sdf;

// Re-export for convenience
pub use sph::SphSimulation;
pub use boids::BoidsSimulation;
pub use grayscott::GrayScottSimulation;
// pub use sdf::SdfRenderer; // Not currently used

