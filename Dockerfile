# Stage 1: Build the Next.js application
FROM node:20-slim AS builder

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

# Copy package files
COPY package*.json ./
COPY requirements*.txt ./



# Set Python path for node-gyp
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3

# Install Node.js dependencies with production flag (allow legacy peer deps)
RUN npm install --only=production --legacy-peer-deps && \
    npm cache clean --force




# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the production image
FROM node:20-slim

# Install Python and runtime dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-dev \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/requirements*.txt ./

# Install production Node.js dependencies (allow legacy peer deps)
RUN npm install --only=production --legacy-peer-deps

# Install production Python dependencies
RUN pip3 install --upgrade pip setuptools wheel && pip3 install --no-cache-dir --break-system-packages --use-deprecated=legacy-resolver -r requirements.txt

# Copy built application and other necessary files
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/*.py ./
COPY --from=builder /app/*.sh ./

# Make shell scripts executable
RUN chmod +x ./*.sh

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Start the application
CMD ["sh", "-c", "npm run start"]
