#!/bin/bash
set -e

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "Docker is not running. Please start Docker and try again."
  exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example"
  cp .env.example .env
  echo "Please update the .env file with your configuration and run this script again."
  exit 1
fi

# Build and start the containers
echo "Starting Synera AI with Docker Compose..."
docker-compose up --build -d

echo ""
echo "Synera AI is now running!"
echo "- Frontend: http://localhost:3000"
echo "- MongoDB: mongodb://localhost:27017/synera-ai"
echo "- Mongo Express: http://localhost:8081"
echo "- Redis Commander: http://localhost:8082"
echo ""
echo "To stop the application, run: docker-compose down"
echo "To view logs, run: docker-compose logs -f"
