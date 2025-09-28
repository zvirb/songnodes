#!/usr/bin/env python3
"""
MCP-Compatible Observability Server
Implements Pattern 3: Interactive tool-based querying for AI agents
Provides a Model Context Protocol interface for Claude and Gemini CLIs
"""

import os
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging
import requests

from scraper import ObservabilityScraper

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Observability MCP Server", version="1.0.0")

# Add CORS middleware for browser-based clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the scraper
scraper = ObservabilityScraper()


# Request/Response Models
class PromQLQueryRequest(BaseModel):
    query: str = Field(..., description="PromQL query to execute")
    time: Optional[str] = Field(None, description="Specific time for the query (RFC3339/Unix timestamp)")


class RangeQueryRequest(BaseModel):
    query: str = Field(..., description="PromQL query to execute")
    start: str = Field(..., description="Start time (RFC3339/Unix timestamp)")
    end: str = Field(..., description="End time (RFC3339/Unix timestamp)")
    step: str = Field("1m", description="Query resolution step")


class ServiceDiagnosticsRequest(BaseModel):
    service_name: str = Field(..., description="Name of the service to diagnose")
    include_history: bool = Field(False, description="Include historical metrics")
    hours_back: int = Field(1, description="Hours of history to include")


class DeploymentCheckRequest(BaseModel):
    hours_back: int = Field(24, description="How many hours back to check for deployments")
    service_filter: Optional[str] = Field(None, description="Filter deployments by service name")


# MCP Tool Manifest
TOOL_MANIFEST = {
    "name": "observability",
    "version": "1.0.0",
    "description": "Observability tools for monitoring Prometheus and Grafana",
    "tools": [
        {
            "name": "get_active_alerts",
            "description": "Fetch all currently active alerts from Prometheus",
            "parameters": {},
            "returns": {
                "type": "array",
                "description": "List of active alerts with details"
            }
        },
        {
            "name": "query_prometheus",
            "description": "Execute a PromQL query against Prometheus",
            "parameters": {
                "query": {
                    "type": "string",
                    "required": True,
                    "description": "PromQL query to execute"
                },
                "time": {
                    "type": "string",
                    "required": False,
                    "description": "Specific time for the query"
                }
            },
            "returns": {
                "type": "object",
                "description": "Query results with metric values"
            }
        },
        {
            "name": "get_service_health",
            "description": "Get comprehensive health status for a specific service",
            "parameters": {
                "service_name": {
                    "type": "string",
                    "required": True,
                    "description": "Name of the service (e.g., 'enhanced-visualization-service')"
                }
            },
            "returns": {
                "type": "object",
                "description": "Service health metrics and status"
            }
        },
        {
            "name": "check_deployments",
            "description": "Check for recent deployments from Grafana annotations",
            "parameters": {
                "hours_back": {
                    "type": "number",
                    "required": False,
                    "default": 24,
                    "description": "How many hours back to check"
                }
            },
            "returns": {
                "type": "array",
                "description": "List of recent deployments"
            }
        },
        {
            "name": "diagnose_issue",
            "description": "Run automated diagnostics for system issues",
            "parameters": {
                "service_name": {
                    "type": "string",
                    "required": False,
                    "description": "Optional service to focus on"
                }
            },
            "returns": {
                "type": "object",
                "description": "Diagnostic findings and recommendations"
            }
        },
        {
            "name": "get_system_kpis",
            "description": "Get current Key Performance Indicators for the system",
            "parameters": {},
            "returns": {
                "type": "object",
                "description": "System KPIs with current values"
            }
        }
    ]
}


@app.get("/.well-known/mcp-tools")
async def get_tools():
    """MCP discovery endpoint - returns available tools"""
    return TOOL_MANIFEST


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "observability-mcp-server",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/tools/{tool_name}")
async def execute_tool(tool_name: str, request: Request):
    """Execute a specific MCP tool"""
    try:
        # Get request body
        body = await request.json() if request.body else {}

        # Route to appropriate tool handler
        if tool_name == "get_active_alerts":
            return await handle_get_active_alerts()

        elif tool_name == "query_prometheus":
            params = PromQLQueryRequest(**body)
            return await handle_query_prometheus(params)

        elif tool_name == "get_service_health":
            service_name = body.get("service_name")
            if not service_name:
                raise HTTPException(status_code=400, detail="service_name is required")
            return await handle_get_service_health(service_name)

        elif tool_name == "check_deployments":
            params = DeploymentCheckRequest(**body)
            return await handle_check_deployments(params)

        elif tool_name == "diagnose_issue":
            service_name = body.get("service_name")
            return await handle_diagnose_issue(service_name)

        elif tool_name == "get_system_kpis":
            return await handle_get_system_kpis()

        else:
            raise HTTPException(status_code=404, detail=f"Tool '{tool_name}' not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error executing tool {tool_name}: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e),
            "tool": tool_name
        }


# Tool Handlers
async def handle_get_active_alerts():
    """Handle get_active_alerts tool"""
    alerts = scraper.get_active_alerts()

    # Format for AI consumption
    formatted_alerts = []
    for alert in alerts:
        labels = alert.get('labels', {})
        annotations = alert.get('annotations', {})

        formatted_alerts.append({
            "alertname": labels.get('alertname', 'Unknown'),
            "severity": labels.get('severity', 'unknown'),
            "service": labels.get('job', 'unknown'),
            "instance": labels.get('instance', 'unknown'),
            "summary": annotations.get('summary', 'No summary'),
            "description": annotations.get('description', ''),
            "started": alert.get('activeAt', ''),
            "labels": labels
        })

    return {
        "status": "success",
        "data": {
            "count": len(formatted_alerts),
            "alerts": formatted_alerts,
            "timestamp": datetime.utcnow().isoformat()
        }
    }


async def handle_query_prometheus(params: PromQLQueryRequest):
    """Handle query_prometheus tool"""
    # Security: Basic query validation
    if len(params.query) > 1000:
        raise HTTPException(status_code=400, detail="Query too long")

    # Blocklist dangerous operations
    blocked_keywords = ['delete', 'drop', 'truncate']
    if any(keyword in params.query.lower() for keyword in blocked_keywords):
        raise HTTPException(status_code=400, detail="Query contains blocked keywords")

    result = scraper.query_prometheus(params.query, params.time)

    if result['success']:
        # Format the result for AI understanding
        data = result['data']
        formatted_result = []

        for series in data.get('result', []):
            metric = series.get('metric', {})
            value = series.get('value', [None, None])

            formatted_result.append({
                "metric": metric,
                "value": float(value[1]) if value[1] else None,
                "timestamp": value[0]
            })

        return {
            "status": "success",
            "data": {
                "query": params.query,
                "result": formatted_result,
                "result_count": len(formatted_result),
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    else:
        return {
            "status": "error",
            "error": result.get('error', 'Query failed'),
            "query": params.query
        }


async def handle_get_service_health(service_name: str):
    """Handle get_service_health tool"""
    # Check if service is known
    if service_name not in scraper.service_queries:
        # Try to get basic metrics anyway
        up_query = f'up{{job="{service_name}"}}'
        up_result = scraper.query_prometheus(up_query)

        return {
            "status": "success",
            "data": {
                "service": service_name,
                "health": "unknown",
                "message": "Service not in predefined list, showing basic status",
                "up": up_result.get('data', {}).get('result', [])
            }
        }

    # Get comprehensive service metrics
    metrics = scraper.collect_service_metrics(service_name)

    # Determine overall health
    health_status = "healthy"
    issues = []

    # Check for common issues
    if 'error' in metrics:
        health_status = "error"
        issues.append("Failed to collect metrics")
    else:
        # Check specific metrics
        for query, value in metrics.items():
            if 'health' in query.lower() and value == 0:
                health_status = "unhealthy"
                issues.append(f"Health check failing: {query}")
            elif 'error' in query.lower() and value and value > 0:
                health_status = "degraded"
                issues.append(f"Errors detected: {query}")

    return {
        "status": "success",
        "data": {
            "service": service_name,
            "health_status": health_status,
            "issues": issues,
            "metrics": metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
    }


async def handle_check_deployments(params: DeploymentCheckRequest):
    """Handle check_deployments tool"""
    annotations = scraper.get_grafana_annotations(hours_back=params.hours_back)

    # Filter and format deployments
    deployments = []
    for ann in annotations:
        # Check if it's a deployment annotation
        if 'deploy' in ann.get('tags', []):
            # Apply service filter if provided
            if params.service_filter:
                if params.service_filter not in ann.get('text', ''):
                    continue

            deployments.append({
                "time": datetime.fromtimestamp(ann['time'] / 1000).isoformat(),
                "text": ann.get('text', 'No description'),
                "tags": ann.get('tags', []),
                "dashboard": ann.get('dashboardUId', '')
            })

    # Sort by time (newest first)
    deployments.sort(key=lambda x: x['time'], reverse=True)

    return {
        "status": "success",
        "data": {
            "count": len(deployments),
            "deployments": deployments,
            "hours_checked": params.hours_back,
            "service_filter": params.service_filter,
            "timestamp": datetime.utcnow().isoformat()
        }
    }


async def handle_diagnose_issue(service_name: Optional[str] = None):
    """Handle diagnose_issue tool"""
    diagnosis = scraper.diagnose_issue(service_name)

    # Add AI-friendly summary
    summary = []

    if diagnosis['findings']:
        summary.append(f"Found {len(diagnosis['findings'])} potential issues:")
        for finding in diagnosis['findings']:
            summary.append(f"- [{finding['severity']}] {finding['issue']}")

    if diagnosis['recommendations']:
        summary.append("\nRecommendations:")
        for rec in diagnosis['recommendations']:
            summary.append(f"- {rec}")

    diagnosis['summary'] = "\n".join(summary) if summary else "No issues detected"

    return {
        "status": "success",
        "data": diagnosis
    }


async def handle_get_system_kpis():
    """Handle get_system_kpis tool"""
    kpis = scraper.collect_kpis()

    # Format for AI understanding
    formatted_kpis = {}
    for name, data in kpis.items():
        if 'error' in data:
            formatted_kpis[name] = {
                "description": data['description'],
                "status": "error",
                "error": data['error']
            }
        else:
            value = data.get('values')
            status = "normal"  # Default status

            # Determine status based on metric type and value
            if 'error' in name.lower() and isinstance(value, (int, float)):
                status = "critical" if value > 0.05 else "good"
            elif 'cpu' in name.lower() and isinstance(value, (int, float)):
                status = "critical" if value > 80 else "warning" if value > 60 else "good"

            formatted_kpis[name] = {
                "description": data['description'],
                "value": value,
                "status": status
            }

    return {
        "status": "success",
        "data": {
            "kpis": formatted_kpis,
            "timestamp": datetime.utcnow().isoformat()
        }
    }


# Additional API endpoints for direct access

@app.get("/api/health-report")
async def get_health_report():
    """Generate a comprehensive health report"""
    report = scraper.generate_health_report()
    return {
        "status": "success",
        "report": report
    }


@app.get("/api/health-report/markdown")
async def get_health_report_markdown():
    """Generate health report in Markdown format"""
    report = scraper.generate_health_report()
    markdown = scraper.format_for_ai_context(report)
    return {
        "status": "success",
        "markdown": markdown,
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv('MCP_SERVER_PORT', 8000))
    host = os.getenv('MCP_SERVER_HOST', '0.0.0.0')

    logger.info(f"Starting MCP Observability Server on {host}:{port}")
    logger.info(f"Tool discovery endpoint: http://localhost:{port}/.well-known/mcp-tools")
    logger.info(f"Health check: http://localhost:{port}/health")

    uvicorn.run(app, host=host, port=port)