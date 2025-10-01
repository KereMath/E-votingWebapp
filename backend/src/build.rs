use std::env;
use std::path::PathBuf;

fn main() {
    // Get the project root directory
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let crypto_lib_path = PathBuf::from(&manifest_dir)
        .parent()
        .unwrap()
        .join("crypto_service/build/lib");
    
    // Tell cargo to look for shared libraries in the crypto_service build directory
    println!("cargo:rustc-link-search=native={}", crypto_lib_path.display());
    
    // Link to crypto_service library
    println!("cargo:rustc-link-lib=dylib=crypto_service");
    
    // Also link PBC and GMP since crypto_service depends on them
    println!("cargo:rustc-link-lib=dylib=pbc");
    println!("cargo:rustc-link-lib=dylib=gmp");
    
    // Re-run if the build script changes
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/crypto_ffi.rs");
}