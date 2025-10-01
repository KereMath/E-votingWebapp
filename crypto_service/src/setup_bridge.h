#ifndef SETUP_BRIDGE_H
#define SETUP_BRIDGE_H

extern "C" {

struct SetupResultFFI {
    // TIAC Spec: params = (G1, G2, GT, p, g1, g2, h1)
    char* pairing_param;  // Pairing yapısı (G1, G2, GT bilgilerini içerir)
    char* prime_order;    // p (asal mertepe)
    char* g1;            // g1 ∈ G1 (G1 üreteci)
    char* g2;            // g2 ∈ G2 (G2 üreteci)  
    char* h1;            // h1 ∈ G1 (G1'in başka bir üreteci)
    
    // Metadata
    int security_level;   // λ (güvenlik parametresi, bizde 256)
    int success;
    char* error_message;
};

// TIAC Setup fonksiyonu
SetupResultFFI* perform_setup(int security_level);

// Bellek temizleme
void free_setup_result(SetupResultFFI* result);

} // extern "C"

#endif // SETUP_BRIDGE_H
