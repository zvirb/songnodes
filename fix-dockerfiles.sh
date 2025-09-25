#!/bin/bash

# Script to replace Docker Hub base images with alternative registry images
echo "Replacing Docker Hub base images with alternatives..."

# Find all Dockerfiles
DOCKERFILES=$(find . -name "Dockerfile*" -type f 2>/dev/null | grep -v node_modules | grep -v ".backup")

for dockerfile in $DOCKERFILES; do
    echo "Processing: $dockerfile"

    # Backup original
    cp "$dockerfile" "${dockerfile}.backup"

    # Replace python:3.11-slim with AWS ECR version
    sed -i 's|FROM python:3.11-slim|FROM public.ecr.aws/docker/library/python:3.11-slim|g' "$dockerfile"

    # Replace node:18-alpine with AWS ECR version
    sed -i 's|FROM node:18-alpine|FROM public.ecr.aws/docker/library/node:18-alpine|g' "$dockerfile"

    # Replace node:20-alpine with AWS ECR version
    sed -i 's|FROM node:20-alpine|FROM public.ecr.aws/docker/library/node:20-alpine|g' "$dockerfile"

    # Show changes
    if diff -q "$dockerfile" "${dockerfile}.backup" > /dev/null; then
        echo "  No changes needed"
        rm "${dockerfile}.backup"
    else
        echo "  ✓ Updated base image references"
    fi
done

echo "Done! All Dockerfiles have been updated to use alternative registries."