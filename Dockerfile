# Stage 1: Build the Next.js application
FROM node:20-slim AS builder

# Accept build-time env variables (from Render or Docker CLI)
ARG MONGODB_URI
ARG MONGODB_URI_BASE
ARG NEXT_PUBLIC_APP_URL

# Cache bust argument to force layer rebuild
ARG CACHE_DATE=2025-06-22
RUN echo "Cache bust: $CACHE_DATE"

# Install system dependencies (Python and build tools)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-dev \
    python3-pip \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package and requirements files
COPY package*.json ./
COPY requirements*.txt ./

# Set Python path for node-gyp
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3

# Install Node.js dependencies
RUN npm install --only=production --legacy-peer-deps && \
    npm cache clean --force

# ✅ FIX APPLIED HERE: Create and use virtualenv for Python
RUN python3 -m venv /venv && \
    . /venv/bin/activate && \
    pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Copy the full app source code
COPY . .

# Generate .env.local from build args
RUN echo "MONGODB_URI=$MONGODB_URI" > .env.local && \
    echo "MONGODB_URI_BASE=$MONGODB_URI_BASE" >> .env.local && \
    echo "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" >> .env.local && \
    chmod 644 .env.local

# Build the Next.js app
RUN npm run build

# Stage 2: Create the production image
FROM node:20-slim

# Install Python runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-dev \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy required files from the builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/requirements*.txt ./
COPY --from=builder /app/.env.local .env.local
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/*.py ./
COPY --from=builder /app/*.sh ./

# Install production Node.js dependencies
RUN npm install --only=production --legacy-peer-deps

# Set up virtualenv in production container
RUN python3 -m venv /venv && \
    . /venv/bin/activate && \
    pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Make shell scripts executable
RUN chmod +x ./*.sh

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Expose the app port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]
