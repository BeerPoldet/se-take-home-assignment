#!/bin/bash

# Build Script
# This script should contain all compilation steps for your CLI application

echo "Building CLI application..."

# Install dependencies
pnpm install

# Type check
pnpm run type-check

# Build TypeScript to JavaScript
pnpm run build

echo "Build completed"