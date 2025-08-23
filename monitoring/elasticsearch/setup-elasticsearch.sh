#!/bin/bash

# Setup Elasticsearch for Enhanced Visualization Service Logging
# This script creates the necessary pipelines, policies, and templates

set -e

# Configuration
ELASTICSEARCH_URL=${ELASTICSEARCH_URL:-"http://localhost:9200"}
ELASTICSEARCH_USERNAME=${ELASTICSEARCH_USERNAME:-"elastic"}
ELASTICSEARCH_PASSWORD=${ELASTICSEARCH_PASSWORD:-"changeme"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to wait for Elasticsearch to be ready
wait_for_elasticsearch() {
    print_status "Waiting for Elasticsearch to be ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "${ELASTICSEARCH_URL}/_cluster/health" > /dev/null 2>&1; then
            print_status "Elasticsearch is ready!"
            return 0
        fi
        
        print_warning "Attempt $attempt/$max_attempts: Elasticsearch not ready, waiting 10 seconds..."
        sleep 10
        ((attempt++))
    done
    
    print_error "Elasticsearch failed to become ready after $max_attempts attempts"
    exit 1
}

# Function to create ILM policy
create_ilm_policy() {
    print_status "Creating ILM policy for enhanced-visualization-service..."
    
    local response=$(curl -s -w "%{http_code}" -X PUT \
        "${ELASTICSEARCH_URL}/_ilm/policy/enhanced-visualization-service-policy" \
        -H "Content-Type: application/json" \
        -d @enhanced-visualization-service-ilm-policy.json)
    
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        print_status "ILM policy created successfully"
    else
        print_error "Failed to create ILM policy. HTTP code: $http_code"
        echo "Response: ${response%???}"
        exit 1
    fi
}

# Function to create ingest pipeline
create_ingest_pipeline() {
    print_status "Creating ingest pipeline for enhanced-visualization-service..."
    
    local response=$(curl -s -w "%{http_code}" -X PUT \
        "${ELASTICSEARCH_URL}/_ingest/pipeline/enhanced-visualization-service-pipeline" \
        -H "Content-Type: application/json" \
        -d @enhanced-visualization-service-pipeline.json)
    
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        print_status "Ingest pipeline created successfully"
    else
        print_error "Failed to create ingest pipeline. HTTP code: $http_code"
        echo "Response: ${response%???}"
        exit 1
    fi
}

# Function to create index template
create_index_template() {
    print_status "Creating index template for enhanced-visualization-service..."
    
    local template_json='{
  "index_patterns": ["enhanced-visualization-service-*"],
  "priority": 1,
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 1,
      "index.lifecycle.name": "enhanced-visualization-service-policy",
      "index.lifecycle.rollover_alias": "enhanced-visualization-service"
    },
    "mappings": {
      "properties": {
        "@timestamp": {
          "type": "date"
        },
        "level": {
          "type": "keyword"
        },
        "message": {
          "type": "text",
          "analyzer": "standard"
        },
        "service": {
          "properties": {
            "name": {
              "type": "keyword"
            },
            "version": {
              "type": "keyword"
            },
            "component": {
              "type": "keyword"
            }
          }
        },
        "environment": {
          "type": "keyword"
        },
        "hostname": {
          "type": "keyword"
        },
        "pid": {
          "type": "long"
        },
        "requestId": {
          "type": "keyword"
        },
        "userId": {
          "type": "keyword"
        },
        "duration": {
          "type": "float"
        },
        "statusCode": {
          "type": "long"
        },
        "method": {
          "type": "keyword"
        },
        "url": {
          "type": "keyword"
        },
        "ip": {
          "type": "ip"
        },
        "userAgent": {
          "type": "text",
          "fields": {
            "keyword": {
              "type": "keyword"
            }
          }
        },
        "connectionId": {
          "type": "keyword"
        },
        "event": {
          "type": "keyword"
        },
        "operation": {
          "type": "keyword"
        },
        "table": {
          "type": "keyword"
        },
        "success": {
          "type": "boolean"
        },
        "metric": {
          "type": "keyword"
        },
        "value": {
          "type": "float"
        },
        "unit": {
          "type": "keyword"
        },
        "securityEvent": {
          "type": "keyword"
        },
        "severity": {
          "type": "keyword"
        },
        "fingerprint": {
          "type": "keyword"
        },
        "status_category": {
          "type": "keyword"
        },
        "performance_category": {
          "type": "keyword"
        },
        "event_type": {
          "type": "keyword"
        },
        "event_action": {
          "type": "keyword"
        },
        "business_metric": {
          "type": "keyword"
        },
        "geoip": {
          "properties": {
            "location": {
              "type": "geo_point"
            },
            "country_name": {
              "type": "keyword"
            },
            "city_name": {
              "type": "keyword"
            }
          }
        },
        "user_agent": {
          "properties": {
            "name": {
              "type": "keyword"
            },
            "version": {
              "type": "keyword"
            },
            "device": {
              "type": "keyword"
            },
            "os": {
              "properties": {
                "name": {
                  "type": "keyword"
                },
                "version": {
                  "type": "keyword"
                }
              }
            }
          }
        }
      }
    }
  }
}'

    local response=$(curl -s -w "%{http_code}" -X PUT \
        "${ELASTICSEARCH_URL}/_index_template/enhanced-visualization-service" \
        -H "Content-Type: application/json" \
        -d "$template_json")
    
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        print_status "Index template created successfully"
    else
        print_error "Failed to create index template. HTTP code: $http_code"
        echo "Response: ${response%???}"
        exit 1
    fi
}

# Function to create initial index with alias
create_initial_index() {
    print_status "Creating initial index and alias..."
    
    local today=$(date +%Y.%m.%d)
    local index_name="enhanced-visualization-service-${today}-000001"
    
    # Create the initial index
    local response=$(curl -s -w "%{http_code}" -X PUT \
        "${ELASTICSEARCH_URL}/${index_name}" \
        -H "Content-Type: application/json" \
        -d '{
          "aliases": {
            "enhanced-visualization-service": {
              "is_write_index": true
            }
          }
        }')
    
    local http_code="${response: -3}"
    
    if [[ "$http_code" == "200" ]]; then
        print_status "Initial index and alias created successfully"
    else
        print_error "Failed to create initial index. HTTP code: $http_code"
        echo "Response: ${response%???}"
        exit 1
    fi
}

# Function to verify setup
verify_setup() {
    print_status "Verifying Elasticsearch setup..."
    
    # Check ILM policy
    if curl -s -f "${ELASTICSEARCH_URL}/_ilm/policy/enhanced-visualization-service-policy" > /dev/null; then
        print_status "✓ ILM policy exists"
    else
        print_error "✗ ILM policy not found"
        exit 1
    fi
    
    # Check ingest pipeline
    if curl -s -f "${ELASTICSEARCH_URL}/_ingest/pipeline/enhanced-visualization-service-pipeline" > /dev/null; then
        print_status "✓ Ingest pipeline exists"
    else
        print_error "✗ Ingest pipeline not found"
        exit 1
    fi
    
    # Check index template
    if curl -s -f "${ELASTICSEARCH_URL}/_index_template/enhanced-visualization-service" > /dev/null; then
        print_status "✓ Index template exists"
    else
        print_error "✗ Index template not found"
        exit 1
    fi
    
    # Check alias
    if curl -s -f "${ELASTICSEARCH_URL}/_alias/enhanced-visualization-service" > /dev/null; then
        print_status "✓ Index alias exists"
    else
        print_error "✗ Index alias not found"
        exit 1
    fi
    
    print_status "All components verified successfully!"
}

# Main execution
main() {
    print_status "Starting Elasticsearch setup for Enhanced Visualization Service"
    print_status "Elasticsearch URL: $ELASTICSEARCH_URL"
    
    # Change to script directory
    cd "$(dirname "$0")"
    
    # Check if required files exist
    if [[ ! -f "enhanced-visualization-service-ilm-policy.json" ]]; then
        print_error "ILM policy file not found: enhanced-visualization-service-ilm-policy.json"
        exit 1
    fi
    
    if [[ ! -f "enhanced-visualization-service-pipeline.json" ]]; then
        print_error "Pipeline file not found: enhanced-visualization-service-pipeline.json"
        exit 1
    fi
    
    # Execute setup steps
    wait_for_elasticsearch
    create_ilm_policy
    create_ingest_pipeline
    create_index_template
    create_initial_index
    verify_setup
    
    print_status "Elasticsearch setup completed successfully!"
    print_status "You can now start Filebeat to begin shipping logs."
    print_status "Access Kibana at http://localhost:5601 to view logs and create dashboards."
}

# Run main function
main "$@"