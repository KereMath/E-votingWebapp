cmake_minimum_required(VERSION 3.10)
project(CryptoService)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

find_library(PBC_LIBRARY pbc REQUIRED)
find_library(GMP_LIBRARY gmp REQUIRED)

include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src)

# Modular bridge structure
set(SOURCES
    src/setup.cpp
    src/setup_bridge.cpp
    # Future: src/keygen_bridge.cpp
    # Future: src/didgen_bridge.cpp
    # Future: src/blindsign_bridge.cpp
)

add_library(crypto_service SHARED ${SOURCES})
target_link_libraries(crypto_service ${PBC_LIBRARY} ${GMP_LIBRARY})

set_target_properties(crypto_service PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
    OUTPUT_NAME "crypto_service"
)
