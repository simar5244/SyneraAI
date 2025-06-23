# Stage 1: Build the Next.js application
FROM node:20-alpine AS builder

# Cache bust argument to force layer rebuild
ARG CACHE_DATE=2025-06-22
RUN echo "Cache bust: $CACHE_DATE"

# Install Python and build dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    g++ \
    make \
    python3-dev \
    gcc \
    musl-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY requirements*.txt ./

# Install build dependencies
RUN apk add --no-cache --virtual .build-deps \
    python3 \
    python3-dev \
    py3-pip \
    make \
    g++ \
    gcc \
    pkgconfig \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    librsvg \
    pango \
    jpeg \
    musl-dev \
    && ln -sf python3 /usr/bin/python

# Set Python path for node-gyp
ENV PYTHON=/usr/bin/python3
ENV npm_config_python=/usr/bin/python3

# Install Node.js dependencies with production flag (allow legacy peer deps)
RUN npm install --only=production --legacy-peer-deps && \
    npm cache clean --force

# Remove build dependencies
RUN apk del .build-deps

# Install Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Stage 2: Create the production image
FROM node:20-alpine

# Install Python and runtime dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    g++ \
    make \
    python3-dev \
    gcc \
    musl-dev \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

WORKDIR /app

# Copy package files and install production dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/requirements*.txt ./

# Install production Node.js dependencies (allow legacy peer deps)
RUN npm install --only=production --legacy-peer-deps

# Install production Python dependencies
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

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
