use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use serde::{Serialize, Deserialize};

// ============== SETUP FFI ==============

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetupParams {
    pub pairing_param: String,
    pub prime_order: String,
    pub g1: String,
    pub g2: String,
    pub h1: String,
    pub security_level: i32,
}

extern "C" {
    fn perform_setup(security_level: i32) -> *mut SetupResultFFI;
    fn free_setup_result(result: *mut SetupResultFFI);
}

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

// ============== KEYGEN FFI ==============

#[repr(C)]
struct AuthorityKeyFFI {
    authority_index: i32,
    sgk1: *mut c_char,
    sgk2: *mut c_char,
    vkm1: *mut c_char,
    vkm2: *mut c_char,
    vkm3: *mut c_char,
}

#[repr(C)]
struct MasterVerKeyFFI {
    alpha2: *mut c_char,
    beta2: *mut c_char,
    beta1: *mut c_char,
}

#[repr(C)]
struct KeyGenResultFFI {
    mvk: *mut MasterVerKeyFFI,
    authority_keys: *mut AuthorityKeyFFI,
    num_authorities: i32,
    threshold: i32,
    success: i32,
    error_message: *mut c_char,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorityKey {
    pub authority_index: i32,
    pub sgk1: String,  // Secret key component 1
    pub sgk2: String,  // Secret key component 2
    pub vkm1: String,  // Verification key α2,m
    pub vkm2: String,  // Verification key β2,m
    pub vkm3: String,  // Verification key β1,m
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterVerKey {
    pub alpha2: String,
    pub beta2: String,
    pub beta1: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyGenResult {
    pub mvk: MasterVerKey,
    pub authority_keys: Vec<AuthorityKey>,
    pub threshold: i32,
}

extern "C" {
    fn perform_keygen(
        pairing_param_hex: *const c_char,
        prime_order_hex: *const c_char,
        g1_hex: *const c_char,
        g2_hex: *const c_char,
        h1_hex: *const c_char,
        threshold: i32,
        num_authorities: i32,
    ) -> *mut KeyGenResultFFI;
    
    fn free_keygen_result(result: *mut KeyGenResultFFI);
}

pub fn execute_keygen(
    setup_params: &SetupParams,
    threshold: i32,
    num_authorities: i32,
) -> Result<KeyGenResult, String> {
    unsafe {
        let pairing_param_c = CString::new(setup_params.pairing_param.as_str())
            .map_err(|e| format!("Invalid pairing param: {}", e))?;
        let prime_order_c = CString::new(setup_params.prime_order.as_str())
            .map_err(|e| format!("Invalid prime order: {}", e))?;
        let g1_c = CString::new(setup_params.g1.as_str())
            .map_err(|e| format!("Invalid g1: {}", e))?;
        let g2_c = CString::new(setup_params.g2.as_str())
            .map_err(|e| format!("Invalid g2: {}", e))?;
        let h1_c = CString::new(setup_params.h1.as_str())
            .map_err(|e| format!("Invalid h1: {}", e))?;
        
        let result = perform_keygen(
            pairing_param_c.as_ptr(),
            prime_order_c.as_ptr(),
            g1_c.as_ptr(),
            g2_c.as_ptr(),
            h1_c.as_ptr(),
            threshold,
            num_authorities,
        );
        
        if result.is_null() {
            return Err("KeyGen function returned null".to_string());
        }
        
        let result_ref = &*result;
        
        if result_ref.success == 0 {
            let error_msg = if !result_ref.error_message.is_null() {
                CStr::from_ptr(result_ref.error_message)
                    .to_string_lossy()
                    .into_owned()
            } else {
                "Unknown error during keygen".to_string()
            };
            free_keygen_result(result);
            return Err(error_msg);
        }
        
        // Parse Master Verification Key
        let mvk_ref = &*result_ref.mvk;
        let mvk = MasterVerKey {
            alpha2: CStr::from_ptr(mvk_ref.alpha2).to_string_lossy().into_owned(),
            beta2: CStr::from_ptr(mvk_ref.beta2).to_string_lossy().into_owned(),
            beta1: CStr::from_ptr(mvk_ref.beta1).to_string_lossy().into_owned(),
        };
        
        // Parse Authority Keys
        let mut authority_keys = Vec::new();
        for i in 0..result_ref.num_authorities {
            let key_ref = &*result_ref.authority_keys.offset(i as isize);
            authority_keys.push(AuthorityKey {
                authority_index: key_ref.authority_index,
                sgk1: CStr::from_ptr(key_ref.sgk1).to_string_lossy().into_owned(),
                sgk2: CStr::from_ptr(key_ref.sgk2).to_string_lossy().into_owned(),
                vkm1: CStr::from_ptr(key_ref.vkm1).to_string_lossy().into_owned(),
                vkm2: CStr::from_ptr(key_ref.vkm2).to_string_lossy().into_owned(),
                vkm3: CStr::from_ptr(key_ref.vkm3).to_string_lossy().into_owned(),
            });
        }
        
        free_keygen_result(result);
        
        Ok(KeyGenResult {
            mvk,
            authority_keys,
            threshold,
        })
    }
}