#!/usr/bin/env bash
# Setup Python virtual environment and install dependencies

# Create venv if it doesn't exist
test -d .venv || python3 -m venv .venv

# Activate venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

echo "Virtual environment ready and dependencies installed. Activate with 'source .venv/bin/activate'"
