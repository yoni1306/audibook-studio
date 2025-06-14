FROM node:20-bullseye

# Install basic tools
RUN apt-get update && apt-get install -y \
    git \
    curl \
    vim \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm globally
RUN npm install -g pnpm

WORKDIR /workspace