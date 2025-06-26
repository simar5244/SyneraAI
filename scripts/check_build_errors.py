#!/usr/bin/env python3
import subprocess
import sys
from pathlib import Path

def run_build():
    print("🚀 Running 'npm run build' to check for build errors...\n")
    
    try:
        # Run the build command and capture both stdout and stderr
        result = subprocess.run(
            ["npm", "run", "build"],
            capture_output=True,
            text=True,
            cwd=str(Path(__file__).parent.parent)
        )
        
        # If the build failed, show the error output
        if result.returncode != 0:
            print("❌ Build failed with the following errors:\n")
            print(result.stderr or result.stdout)
            print("\n💡 Fix the above errors to make the build pass.")
            sys.exit(1)
        else:
            print("✅ Build completed successfully! No build-breaking errors found.")
            
    except FileNotFoundError:
        print("❌ Error: npm not found. Make sure Node.js and npm are installed.")
        sys.exit(1)
    except Exception as e:
        print(f"❌ An error occurred: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    run_build()
