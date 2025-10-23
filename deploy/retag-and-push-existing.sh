#!/bin/bash
# Retag and push existing images to localhost:5000 registry
set -e

REGISTRY="localhost:5000"

echo "Retagging and pushing existing images to ${REGISTRY}..."

# Function to retag and push
retag_push() {
    local old_tag=$1
    local new_tag=$2

    if docker image inspect "$old_tag" &> /dev/null; then
        echo "✓ Found $old_tag, retagging to $new_tag"
        docker tag "$old_tag" "$new_tag"
        docker push "$new_tag"
        echo "✓ Pushed $new_tag"
    else
        echo "✗ Image $old_tag not found, skipping"
    fi
}

# Retag existing images
retag_push "songnodes/rest-api:latest" "${REGISTRY}/songnodes_rest-api:latest"
retag_push "songnodes-websocket-api:latest" "${REGISTRY}/songnodes_websocket-api:latest"
retag_push "songnodes-metadata-enrichment:latest" "${REGISTRY}/songnodes_metadata-enrichment:latest"
retag_push "songnodes-frontend:latest" "${REGISTRY}/songnodes_frontend:latest"
retag_push "songnodes/graph-visualization-api:latest" "${REGISTRY}/songnodes_graph-visualization-api:latest"

echo ""
echo "✓ Retagging complete!"
echo ""
echo "Verifying images in registry:"
curl -s http://localhost:5000/v2/_catalog | jq '.repositories'
