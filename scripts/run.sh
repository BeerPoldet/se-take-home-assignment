#!/bin/bash

# Run Script
# This script should execute your CLI application and output results to result.txt

echo "Running CLI application..."

# Change to project root directory
cd "$(dirname "$0")/.."

# Run with tsx (TypeScript directly)
pnpm exec tsx src/index.ts

echo "CLI application execution completed"
echo "Results written to scripts/result.txt"