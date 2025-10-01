use std::ffi::CStr;
use std::os::raw::c_char;
use serde::{Serialize, Deserialize};

#[repr(C)]
struct SetupResultFFI {
    pairing_param: *mut c_char,
    prime_order: *mut c_char,
    g1: *mut c_char,
    g2: *mut c_char,
    h1: *mut c_char,
    security_level: i32,
    success: i32,
    error_message: *mut c_char,
}

/// TIAC Setup Parameters
/// Corresponds to: params = (G1, G2, GT, p, g1, g2, h1)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupParams {
    /// Pairing parameters (contains G1, G2, GT group info)
    pub pairing_param: String,
    
    /// p: Prime order of groups
    pub prime_order: String,
    
    /// g1: Generator of G1
    pub g1: String,
    
    /// g2: Generator of G2
    pub g2: String,
    
    /// h1: Second generator of G1 (independent from g1)
    pub h1: String,
    
    /// Security level (λ)
    pub security_level: i32,
}

extern "C" {
    fn perform_setup(security_level: i32) -> *mut SetupResultFFI;
    fn free_setup_result(result: *mut SetupResultFFI);
}

/// Execute TIAC Setup (Algorithm 1)
/// 
/// Input: security_level (λ = 256)
/// Output: params = (G1, G2, GT, p, g1, g2, h1)
pub fn execute_setup(security_level: i32) -> Result<SetupParams, String> {
    unsafe {
        let result = perform_setup(security_level);
        
        if result.is_null() {
            return Err("Setup function returned null".to_string());
        }
        
        let result_ref = &*result;
        
        if result_ref.success == 0 {
            let error_msg = if !result_ref.error_message.is_null() {
                CStr::from_ptr(result_ref.error_message)
                    .to_string_lossy()
                    .into_owned()
            } else {
                "Unknown error during setup".to_string()
            };
            free_setup_result(result);
            return Err(error_msg);
        }
        
        let params = SetupParams {
            pairing_param: CStr::from_ptr(result_ref.pairing_param)
                .to_string_lossy()
                .into_owned(),
            prime_order: CStr::from_ptr(result_ref.prime_order)
                .to_string_lossy()
                .into_owned(),
            g1: CStr::from_ptr(result_ref.g1)
                .to_string_lossy()
                .into_owned(),
            g2: CStr::from_ptr(result_ref.g2)
                .to_string_lossy()
                .into_owned(),
            h1: CStr::from_ptr(result_ref.h1)
                .to_string_lossy()
                .into_owned(),
            security_level: result_ref.security_level,
        };
        
        free_setup_result(result);
        
        Ok(params)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_tiac_setup() {
        match execute_setup(256) {
            Ok(params) => {
                assert!(!params.pairing_param.is_empty());
                assert!(!params.prime_order.is_empty());
                assert!(!params.g1.is_empty());
                assert!(!params.g2.is_empty());
                assert!(!params.h1.is_empty());
                assert_eq!(params.security_level, 256);
                println!("TIAC Setup successful!");
            }
            Err(e) => {
                panic!("TIAC Setup failed: {}", e);
            }
        }
    }
}
