# Stage 1: Build the Next.js application
FROM node:20-slim AS builder

# Accept build-time env variables
ARG MONGODB_URI
ARG MONGODB_URI_BASE
ARG NEXT_PUBLIC_APP_URL

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-pip \
    build-essential \
    curl \
    bash \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY requirements*.txt ./

# Set Python path for node-gyp
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3

# Install Node.js dependencies (including concurrently for production)
RUN echo "Node.js version: $(node --version)" && \
    echo "npm version: $(npm --version)" && \
    echo "Git version: $(git --version)" && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set audit false && \
    npm config set fund false && \
    npm cache clean --force && \
    npm install --legacy-peer-deps --no-audit --progress=false

# Set up Python virtual environment
RUN python3 -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies
RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Make bash scripts executable
RUN find . -name "*.sh" -type f -exec chmod +x {} \;

# Generate .env.local from build args
RUN echo "MONGODB_URI=${MONGODB_URI}" > .env.local && \
    echo "MONGODB_URI_BASE=${MONGODB_URI_BASE}" >> .env.local && \
    echo "NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}" >> .env.local && \
    chmod 644 .env.local

# Build the application
RUN set -e && \
    echo "Starting build process..." && \
    export NODE_OPTIONS="--max_old_space_size=2048" && \
    export NEXT_TELEMETRY_DISABLED=1 && \
    npm run build && \
    echo "Build completed successfully"

# Stage 2: Production image
FROM node:20-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    curl \
    bash \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy required files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/requirements*.txt ./
COPY --from=builder /app/.env.local ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/*.py ./
COPY --from=builder /app/*.sh ./

# Install production Node.js dependencies (including concurrently)
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set audit false && \
    npm config set fund false && \
    npm install --legacy-peer-deps --no-audit --progress=false

# Make bash scripts executable
RUN find . -name "*.sh" -type f -exec chmod +x {} \;

# Set up Python virtual environment
RUN python3 -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies
RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install --no-cache-dir -r requirements.txt

# Set environment variables
ENV NODE_ENV=production
ENV PORT=10000
ENV NEXT_TELEMETRY_DISABLED=1

# Expose the port the app runs on
EXPOSE 10000

# Start the application with all processes
CMD ["npm", "start"]