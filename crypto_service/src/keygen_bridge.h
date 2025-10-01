#ifndef KEYGEN_BRIDGE_H
#define KEYGEN_BRIDGE_H

extern "C" {

struct AuthorityKeyFFI {
    int authority_index;  // m değeri (1'den ne'ye kadar)
    
    // Secret keys (sgkm = (xm, ym))
    char* sgk1;  // xm
    char* sgk2;  // ym
    
    // Verification keys (vkm = (α2,m, β2,m, β1,m))
    char* vkm1;  // α2,m = g2^xm
    char* vkm2;  // β2,m = g2^ym
    char* vkm3;  // β1,m = g1^ym
};

struct MasterVerKeyFFI {
    // mvk = (α2, β2, β1) = (g2^x, g2^y, g1^y)
    char* alpha2;  // g2^x where x = v(0)
    char* beta2;   // g2^y where y = w(0)
    char* beta1;   // g1^y
};

struct KeyGenResultFFI {
    // Master verification key (broadcast to everyone)
    MasterVerKeyFFI* mvk;
    
    // Individual authority keys
    AuthorityKeyFFI* authority_keys;
    int num_authorities;
    
    // Metadata
    int threshold;
    int success;
    char* error_message;
};

// Algoritma 2: Coconut TTP ile Anahtar Üretimi
KeyGenResultFFI* perform_keygen(
    const char* pairing_param_hex,
    const char* prime_order_hex,
    const char* g1_hex,
    const char* g2_hex,
    const char* h1_hex,
    int threshold,        // t
    int num_authorities  // ne
);

void free_keygen_result(KeyGenResultFFI* result);

} // extern "C"

#endif // KEYGEN_BRIDGE_H