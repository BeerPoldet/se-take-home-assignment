#!/bin/bash

# Unit Test Script
# This script should contain all unit test execution steps

echo "Running unit tests..."

# Change to project root directory
cd "$(dirname "$0")/.."

# Install dependencies if needed
pnpm install

# Run tests
pnpm test

# Type check
echo "Running type check..."
pnpm run type-check

# Lint
echo "Running linter..."
pnpm run lint

echo "All tests completed successfully"
