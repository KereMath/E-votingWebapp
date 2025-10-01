#include "setup.h"
#include <iostream>
#include <sstream>
#include <iomanip>
#include <cstring>

// C-compatible struct for FFI
struct SetupResult {
    char* pairing_param;
    char* prime_order;
    char* g1;
    char* g2;
    char* h1;
    int success;
    char* error_message;
};

// Helper function to convert element to hex string
char* element_to_hex(element_t elem) {
    int len = element_length_in_bytes(elem);
    unsigned char* bytes = new unsigned char[len];
    element_to_bytes(bytes, elem);
    
    std::stringstream ss;
    for (int i = 0; i < len; i++) {
        ss << std::hex << std::setw(2) << std::setfill('0') << (int)bytes[i];
    }
    
    delete[] bytes;
    std::string result = ss.str();
    char* c_result = new char[result.length() + 1];
    strcpy(c_result, result.c_str());
    return c_result;
}

// Helper function to convert mpz_t to hex string
char* mpz_to_hex(mpz_t num) {
    char* result = mpz_get_str(nullptr, 16, num);
    return result;
}

// Helper to get pairing param string
char* get_pairing_param_string(pairing_t pairing) {
    pbc_param_t par;
    pbc_param_init_a_gen(par, 256, 512);
    
    FILE* temp = tmpfile();
    pbc_param_out_str(temp, par);
    
    fseek(temp, 0, SEEK_END);
    long size = ftell(temp);
    fseek(temp, 0, SEEK_SET);
    
    char* buffer = new char[size + 1];
    fread(buffer, 1, size, temp);
    buffer[size] = '\0';
    
    fclose(temp);
    pbc_param_clear(par);
    
    return buffer;
}

extern "C" {
    // Main setup function callable from Rust
    SetupResult* perform_setup(int security_level) {
        SetupResult* result = new SetupResult();
        
        try {
            TIACParams params = setupParams();
            
            result->pairing_param = get_pairing_param_string(params.pairing);
            result->prime_order = mpz_to_hex(params.prime_order);
            result->g1 = element_to_hex(params.g1);
            result->g2 = element_to_hex(params.g2);
            result->h1 = element_to_hex(params.h1);
            result->success = 1;
            result->error_message = nullptr;
            
            clearParams(params);
            
        } catch (const std::exception& e) {
            result->success = 0;
            result->error_message = new char[strlen(e.what()) + 1];
            strcpy(result->error_message, e.what());
            result->pairing_param = nullptr;
            result->prime_order = nullptr;
            result->g1 = nullptr;
            result->g2 = nullptr;
            result->h1 = nullptr;
        }
        
        return result;
    }
    
    // Function to free SetupResult memory
    void free_setup_result(SetupResult* result) {
        if (result) {
            if (result->pairing_param) delete[] result->pairing_param;
            if (result->prime_order) delete[] result->prime_order;
            if (result->g1) delete[] result->g1;
            if (result->g2) delete[] result->g2;
            if (result->h1) delete[] result->h1;
            if (result->error_message) delete[] result->error_message;
            delete result;
        }
    }
}