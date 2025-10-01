#include "setup.h"
#include "keygen.h"
#include "keygen_bridge.h"
#include <cstring>
#include <cstdlib>
#include <sstream>
#include <iomanip>

// Helper: hex string → element
static void hex_to_element(element_t elem, const char* hex_str, pairing_t pairing, int group) {
    size_t hex_len = strlen(hex_str);
    size_t byte_len = hex_len / 2;
    unsigned char* bytes = (unsigned char*)malloc(byte_len);
    
    for (size_t i = 0; i < byte_len; i++) {
        char byte_str[3] = {hex_str[2*i], hex_str[2*i+1], '\0'};
        bytes[i] = (unsigned char)strtol(byte_str, NULL, 16);
    }
    
    if (group == 1) {
        element_init_G1(elem, pairing);
    } else {
        element_init_G2(elem, pairing);
    }
    element_from_bytes(elem, bytes);
    free(bytes);
}

// Helper: element → hex string
static char* element_to_hex(element_t elem) {
    size_t len = element_length_in_bytes(elem);
    unsigned char* bytes = (unsigned char*)malloc(len);
    element_to_bytes(bytes, elem);
    
    std::ostringstream oss;
    for (size_t i = 0; i < len; i++) {
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)bytes[i];
    }
    free(bytes);
    
    std::string hex_str = oss.str();
    char* result = (char*)malloc(hex_str.length() + 1);
    strcpy(result, hex_str.c_str());
    return result;
}

// Helper: Zr element → hex string
static char* zr_to_hex(element_t elem) {
    mpz_t z;
    mpz_init(z);
    element_to_mpz(z, elem);
    char* str = mpz_get_str(NULL, 16, z);
    mpz_clear(z);
    
    size_t len = strlen(str);
    char* result = (char*)malloc(len + 1);
    strcpy(result, str);
    free(str);
    return result;
}

extern "C" {

KeyGenResultFFI* perform_keygen(
    const char* pairing_param_hex,
    const char* prime_order_hex,
    const char* g1_hex,
    const char* g2_hex,
    const char* h1_hex,
    int threshold,
    int num_authorities
) {
    KeyGenResultFFI* result = (KeyGenResultFFI*)malloc(sizeof(KeyGenResultFFI));
    result->mvk = nullptr;
    result->authority_keys = nullptr;
    result->num_authorities = num_authorities;
    result->threshold = threshold;
    result->success = 0;
    result->error_message = nullptr;
    
    try {
        // Reconstruct TIACParams from hex strings
        TIACParams params;
        
        // Initialize pairing (simplified - in real implementation parse pairing_param)
        pbc_param_t par;
        pbc_param_init_a_gen(par, 256, 512);
        pairing_init_pbc_param(params.pairing, par);
        pbc_param_clear(par);
        
        // Set prime order
        mpz_init(params.prime_order);
        mpz_set_str(params.prime_order, prime_order_hex, 16);
        
        // Restore generators
        hex_to_element(params.g1, g1_hex, params.pairing, 1);
        hex_to_element(params.h1, h1_hex, params.pairing, 1);
        hex_to_element(params.g2, g2_hex, params.pairing, 2);
        
        // Execute KeyGen (Algoritma 2)
        KeyGenOutput keyOut = keygen(params, threshold, num_authorities);
        
        // Allocate and fill MasterVerKey
        result->mvk = (MasterVerKeyFFI*)malloc(sizeof(MasterVerKeyFFI));
        result->mvk->alpha2 = element_to_hex(keyOut.mvk.alpha2);
        result->mvk->beta2 = element_to_hex(keyOut.mvk.beta2);
        result->mvk->beta1 = element_to_hex(keyOut.mvk.beta1);
        
        // Allocate and fill authority keys
        result->authority_keys = (AuthorityKeyFFI*)malloc(num_authorities * sizeof(AuthorityKeyFFI));
        
        for (int i = 0; i < num_authorities; i++) {
            result->authority_keys[i].authority_index = i + 1;  // 1-indexed
            
            // Secret keys
            result->authority_keys[i].sgk1 = zr_to_hex(keyOut.eaKeys[i].sgk1);
            result->authority_keys[i].sgk2 = zr_to_hex(keyOut.eaKeys[i].sgk2);
            
            // Verification keys
            result->authority_keys[i].vkm1 = element_to_hex(keyOut.eaKeys[i].vkm1);
            result->authority_keys[i].vkm2 = element_to_hex(keyOut.eaKeys[i].vkm2);
            result->authority_keys[i].vkm3 = element_to_hex(keyOut.eaKeys[i].vkm3);
        }
        
        result->success = 1;
        
        // Cleanup
        element_clear(keyOut.mvk.alpha2);
        element_clear(keyOut.mvk.beta2);
        element_clear(keyOut.mvk.beta1);
        
        for (int i = 0; i < num_authorities; i++) {
            element_clear(keyOut.eaKeys[i].sgk1);
            element_clear(keyOut.eaKeys[i].sgk2);
            element_clear(keyOut.eaKeys[i].vkm1);
            element_clear(keyOut.eaKeys[i].vkm2);
            element_clear(keyOut.eaKeys[i].vkm3);
        }
        
        clearParams(params);
        
        return result;
        
    } catch (const std::exception& e) {
        result->success = 0;
        std::string error_msg = std::string("KeyGen failed: ") + e.what();
        result->error_message = (char*)malloc(error_msg.length() + 1);
        strcpy(result->error_message, error_msg.c_str());
        return result;
    }
}

void free_keygen_result(KeyGenResultFFI* result) {
    if (result == nullptr) return;
    
    if (result->mvk) {
        if (result->mvk->alpha2) free(result->mvk->alpha2);
        if (result->mvk->beta2) free(result->mvk->beta2);
        if (result->mvk->beta1) free(result->mvk->beta1);
        free(result->mvk);
    }
    
    if (result->authority_keys) {
        for (int i = 0; i < result->num_authorities; i++) {
            if (result->authority_keys[i].sgk1) free(result->authority_keys[i].sgk1);
            if (result->authority_keys[i].sgk2) free(result->authority_keys[i].sgk2);
            if (result->authority_keys[i].vkm1) free(result->authority_keys[i].vkm1);
            if (result->authority_keys[i].vkm2) free(result->authority_keys[i].vkm2);
            if (result->authority_keys[i].vkm3) free(result->authority_keys[i].vkm3);
        }
        free(result->authority_keys);
    }
    
    if (result->error_message) free(result->error_message);
    
    free(result);
}

} // extern "C"