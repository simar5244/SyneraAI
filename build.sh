#!/bin/bash
set -e
echo "Starting build process..."

# Set environment variables
export NODE_OPTIONS=--max_old_space_size=4096
export NEXT_TELEMETRY_DISABLED=1

# Function to check if .next directory is valid
check_next_dir() {
    if [ -d ".next" ]; then
        if [ -f ".next/BUILD_ID" ]; then
            echo "✅ .next directory contains a valid build"
            return 0
        else
            echo "⚠️  .next directory exists but appears to be invalid"
            return 1
        fi
    else
        echo "❌ .next directory not found"
        return 1
    fi
}

# Try to build with full output
if ! npm run build --no-lint; then
    echo "⚠️  Build command failed, attempting to continue with existing build if available..."
    
    if ! check_next_dir; then
        echo "❌ No valid .next directory found after build failure"
        exit 1
    fi
else
    echo "✅ Build completed successfully"
    check_next_dir
fi
