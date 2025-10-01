#include "setup.h"
#include "setup_bridge.h"
#include <cstring>
#include <cstdlib>
#include <sstream>
#include <iomanip>

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

// Helper: mpz_t → hex string
static char* mpz_to_hex(mpz_t num) {
    char* str = mpz_get_str(NULL, 16, num);
    size_t len = strlen(str);
    char* result = (char*)malloc(len + 1);
    strcpy(result, str);
    free(str);
    return result;
}

// Helper: pairing parameters → string
static char* serialize_pairing_params(pairing_t pairing) {
    // PBC pairing yapısını serialize et
    // Format: "type=a,rbits=256,qbits=512,q=..."
    std::ostringstream oss;
    oss << "type=a,";
    oss << "rbits=256,";
    oss << "qbits=512,";
    oss << "q=" << mpz_get_str(NULL, 16, pairing->r);
    
    std::string param_str = oss.str();
    char* result = (char*)malloc(param_str.length() + 1);
    strcpy(result, param_str.c_str());
    return result;
}

extern "C" {

/**
 * TIAC Setup (Algoritma 1)
 * 
 * Girdi: λ güvenlik parametresi (256-bit)
 * Çıktı: params = (G1, G2, GT, p, g1, g2, h1)
 * 
 * Adımlar:
 * 1. λ-bit asal p mertebeli bilinear group (G1, G2, GT) seç
 * 2. g1, h1 ∈ G1 üretecileri, g2 ∈ G2 üreteci seç
 * 3. params döndür
 */
SetupResultFFI* perform_setup(int security_level) {
    SetupResultFFI* result = (SetupResultFFI*)malloc(sizeof(SetupResultFFI));
    
    result->pairing_param = nullptr;
    result->prime_order = nullptr;
    result->g1 = nullptr;
    result->g2 = nullptr;
    result->h1 = nullptr;
    result->security_level = security_level;
    result->success = 0;
    result->error_message = nullptr;
    
    try {
        // TIAC Setup - setupParams() ile aynı
        TIACParams params = setupParams();
        
        // Serialize parameters according to TIAC spec
        // params = (G1, G2, GT, p, g1, g2, h1)
        
        // Pairing params (G1, G2, GT bilgilerini içerir)
        result->pairing_param = serialize_pairing_params(params.pairing);
        
        // p (prime order)
        result->prime_order = mpz_to_hex(params.prime_order);
        
        // g1 ∈ G1
        result->g1 = element_to_hex(params.g1);
        
        // g2 ∈ G2
        result->g2 = element_to_hex(params.g2);
        
        // h1 ∈ G1 (independent generator)
        result->h1 = element_to_hex(params.h1);
        
        result->success = 1;
        
        // Cleanup
        clearParams(params);
        
        return result;
        
    } catch (const std::exception& e) {
        result->success = 0;
        std::string error_msg = std::string("Setup failed: ") + e.what();
        result->error_message = (char*)malloc(error_msg.length() + 1);
        strcpy(result->error_message, error_msg.c_str());
        return result;
    } catch (...) {
        result->success = 0;
        const char* error_msg = "Setup failed: Unknown error";
        result->error_message = (char*)malloc(strlen(error_msg) + 1);
        strcpy(result->error_message, error_msg);
        return result;
    }
}

void free_setup_result(SetupResultFFI* result) {
    if (result == nullptr) return;
    
    if (result->pairing_param) free(result->pairing_param);
    if (result->prime_order) free(result->prime_order);
    if (result->g1) free(result->g1);
    if (result->g2) free(result->g2);
    if (result->h1) free(result->h1);
    if (result->error_message) free(result->error_message);
    
    free(result);
}

} // extern "C"
