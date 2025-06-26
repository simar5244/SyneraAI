#!/bin/bash
set -e

echo "Starting build process..."

# Set environment variables
export NODE_OPTIONS=--max_old_space_size=4096
export NEXT_TELEMETRY_DISABLED=1

# Run the build command and capture output
if ! npm run build 2>&1 | tee build.log; then
    echo "Build command failed, but continuing..."
    
    # Check if .next directory exists
    if [ ! -d ".next" ]; then
        echo "ERROR: No .next directory found after build failure"
        exit 1
    fi
    
    echo "Build output found in .next directory, continuing..."
fi

echo "Build process completed"
