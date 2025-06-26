# Stage 1: Build the Next.js application
FROM node:20-slim AS builder

# Accept build-time env variables (from Render or Docker CLI)
ARG MONGODB_URI
ARG MONGODB_URI_BASE
ARG NEXT_PUBLIC_APP_URL

# Cache bust argument to force layer rebuild
ARG CACHE_DATE=2025-06-22
RUN echo "Cache bust: $CACHE_DATE"

# Install system dependencies (Python, build tools, and dos2unix)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-dev \
    python3-pip \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    dos2unix \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY requirements*.txt ./

# Set Python path for node-gyp
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3

# Install Node.js dependencies with production flag (allow legacy peer deps)
RUN npm install --only=production --legacy-peer-deps && \
    npm cache clean --force

# Create and activate a virtual environment for Python in builder stage
RUN python3 -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies in the virtual environment
RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install --no-cache-dir -r requirements.txt

# Copy the full app source code
COPY . .

# Generate .env.local from build args
RUN echo "MONGODB_URI=$MONGODB_URI" > .env.local && \
    echo "MONGODB_URI_BASE=$MONGODB_URI_BASE" >> .env.local && \
    echo "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" >> .env.local && \
    chmod 644 .env.local

# Install dependencies with legacy peer deps
RUN npm install --legacy-peer-deps --force

# Copy and prepare the build script
COPY build.sh /app/
RUN dos2unix /app/build.sh && \
    chmod +x /app/build.sh && \
    # Verify the script is valid
    if ! /bin/sh -n /app/build.sh; then \
        echo "ERROR: build.sh has syntax errors" >&2; \
        exit 1; \
    fi

# Run the build script
RUN /app/build.sh

# Verify the build was successful
RUN if [ ! -d ".next" ]; then \
      echo "ERROR: .next directory was not created!" >&2; \
      exit 1; \
    else \
      echo "Build verification: .next directory exists"; \
    fi

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
RUN python3 -m venv /opt/venv
ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies in the virtual environment
RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install --no-cache-dir -r requirements.txt

# Make shell scripts executable
RUN chmod +x ./*.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=10000

# Expose the port the app runs on
EXPOSE 10000

# Start the application
CMD ["node_modules/.bin/next", "start"]
