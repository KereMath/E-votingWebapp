cat > ~/E-votingWebApp/crypto_service/CMakeLists.txt << 'EOF'
cmake_minimum_required(VERSION 3.10)
project(CryptoService)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Find PBC library
find_library(PBC_LIBRARY pbc REQUIRED)
find_library(GMP_LIBRARY gmp REQUIRED)

# Include directories
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/src)

# Source files
set(SOURCES
    src/setup.cpp
    src/setup_bridge.cpp
    src/keygen.cpp
    src/keygen_bridge.cpp
)

# Create shared library
add_library(crypto_service SHARED ${SOURCES})

# Link libraries
target_link_libraries(crypto_service ${PBC_LIBRARY} ${GMP_LIBRARY})

# Set output directory
set_target_properties(crypto_service PROPERTIES
    LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib
    OUTPUT_NAME "crypto_service"
)

# Install rules (optional)
install(TARGETS crypto_service
    LIBRARY DESTINATION lib
    ARCHIVE DESTINATION lib
)
EOF