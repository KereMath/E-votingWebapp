cmake_minimum_required(VERSION 3.10)
project(CryptoService)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Find PBC library
find_library(PBC_LIBRARY pbc REQUIRED)
find_library(GMP_LIBRARY gmp REQUIRED)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

# Source files
set(SOURCES
    src/setup.cpp
    src/crypto_bridge.cpp
)

# Create shared library
add_library(crypto_service SHARED ${SOURCES})

# Link libraries
target_link_libraries(crypto_service ${PBC_LIBRARY} ${GMP_LIBRARY})

# Set output directory
set_target_properties(crypto_service PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
)