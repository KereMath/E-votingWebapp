use std::env;
use std::path::PathBuf;

fn main() {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR").unwrap();
    let crypto_lib_path = PathBuf::from(&manifest_dir)
        .parent()
        .unwrap()
        .join("crypto_service/build/lib");
    
    // Crypto service library path
    println!("cargo:rustc-link-search=native={}", crypto_lib_path.display());
    
    // System library paths for PBC and GMP
    println!("cargo:rustc-link-search=native=/usr/local/lib");
    println!("cargo:rustc-link-search=native=/usr/lib/x86_64-linux-gnu");
    println!("cargo:rustc-link-search=native=/usr/lib");
    
    // Link libraries
    println!("cargo:rustc-link-lib=dylib=crypto_service");
    println!("cargo:rustc-link-lib=dylib=pbc");
    println!("cargo:rustc-link-lib=dylib=gmp");
    
    // Set rpath so the binary can find libraries at runtime
    println!("cargo:rustc-link-arg=-Wl,-rpath,{}", crypto_lib_path.display());
    println!("cargo:rustc-link-arg=-Wl,-rpath,/usr/local/lib");
    
    println!("cargo:rerun-if-changed=build.rs");
    println!("cargo:rerun-if-changed=src/crypto_ffi.rs");
}
