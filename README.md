# 🎵 SongNodes - Music Data Visualization & Analysis Platform

## 🎵 Overview

SongNodes is a comprehensive music data platform that combines intelligent scraping, graph visualization, and real-time analytics. Built with containerized microservices and AI-powered data processing, it provides interactive graph-based insights into music relationships, track adjacencies, and performance analytics.

## 🚀 Key Features

### Core Features
- **Interactive Graph Visualization**: D3.js force-directed graphs with PIXI.js WebGL acceleration showing track relationships
- **Advanced Audio Analysis**: Timbre, rhythm, mood detection, and genre classification using librosa
- **Intelligent Harmonic Mixing**: Camelot Wheel integration with weighted transition scoring (harmonic, BPM, energy, genre)
- **Fuzzy Search with Fuse.js**: Typo-tolerant search with faceted filtering (BPM, key, mood, energy, genre)
- **Enterprise Proxy Management**: Rotating proxies with health monitoring, 4 selection strategies, automatic failover
- **Target Tracks Management**: User-driven feedback loop for managing tracks to scrape and analyze
- **Multi-Source Data Collection**: Automated scraping from 1001tracklists, MixesDB, Setlist.fm, Reddit, YouTube, SoundCloud

### Technical Features
- **Real-time Updates**: WebSocket API with RabbitMQ message queue integration
- **Advanced NLP Processing**: Tracklist extraction with Claude/Anthropic API integration
- **Production-Ready Kubernetes**: Complete deployment manifests with HPA, NetworkPolicies, Ingress
- **Comprehensive Monitoring**: Prometheus + Grafana with custom dashboards for all services
- **Containerized Architecture**: Full Docker Compose + Kubernetes deployment with health checks
- **JSONB Advanced Features**: PostgreSQL JSONB columns for timbre, rhythm, mood, and genre metadata

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Nginx Reverse Proxy                      │
│                    (Ports: 8443, 8088)                      │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│                      API Gateway                             │
│                      (Port: 8080)                           │
└─────────┬──────────────┬──────────────┬────────────────────┘
          │              │              │
    ┌─────▼─────┐  ┌────▼────┐  ┌─────▼─────┐
    │ REST API  │  │GraphQL  │  │WebSocket  │
    │Port: 8082 │  │Port:8081│  │Port: 8083│
    └─────┬─────┘  └────┬────┘  └─────┬─────┘
          │              │              │
┌─────────▼──────────────▼──────────────▼────────────────────┐
│              Data Processing Pipeline                       │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │Transformer   │ │NLP Processor │ │Validator     │        │
│ │Port: 8020    │ │Port: 8021    │ │Port: 8022    │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
└──────────────────────────┬──────────────────────────────────┘
                          │
┌──────────────────────────▼──────────────────────────────────┐
│                   Scraping Services                         │
├──────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐│
│ │1001tracks │ │MixesDB     │ │Setlist.fm  │ │Reddit    ││
│ │Port: 8011  │ │Port: 8012  │ │Port: 8013  │ │Port:8014 ││
│ └────────────┘ └────────────┘ └────────────┘ └──────────┘│
└──────────────────────────┬──────────────────────────────────┘
                          │
┌──────────────────────────▼──────────────────────────────────┐
│                    Data Storage                             │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│ │PostgreSQL    │ │Redis Cache   │ │RabbitMQ      │        │
│ │Port: 5433    │ │Port: 6380    │ │Port: 5673    │        │
│ └──────────────┘ └──────────────┘ └──────────────┘        │
└──────────────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18.3.1 + TypeScript 5.5.4 + Vite 5
- **State Management**: Zustand 4.5.5 for reactive state
- **Visualization**: D3.js force simulation + PIXI.js v8.5.2 (WebGL rendering)
- **Search**: Fuse.js 7.0.0 for fuzzy search with typo tolerance
- **UI**: Tailwind CSS + Custom components (CamelotWheel, AdvancedSearch)

### Backend
- **API Framework**: Python FastAPI with async/await patterns
- **Audio Analysis**: librosa, essentia for advanced feature extraction
- **NLP**: Claude/Anthropic API for tracklist extraction
- **Web Scraping**: Scrapy with custom proxy middleware
- **Validation**: Pydantic models for type safety

### Data & Infrastructure
- **Database**: PostgreSQL 15 with JSONB columns for advanced features
- **Cache**: Redis 7 with connection pooling (max 50 connections)
- **Message Queue**: RabbitMQ 3.12 for async processing
- **Search Engine**: Fuse.js with weighted multi-field indexing
- **Orchestration**: Kubernetes 1.25+ with StatefulSets, HPA, NetworkPolicies
- **Monitoring**: Prometheus + Grafana with custom dashboards
- **Containerization**: Docker + Docker Compose with resource limits

### Deployment
- **Development**: Docker Compose with hot-reload
- **Production**: Kubernetes with Kustomize overlays
- **CI/CD**: Automated testing (unit, integration, E2E with Playwright)
- **Security**: Sealed Secrets, NetworkPolicies, TLS/SSL with cert-manager

## 📁 Project Structure

```
songnodes/
├── musicdb_scrapy/           # Cloned scraper repository
├── docs/                     # Comprehensive documentation
│   ├── sdlc/                # SDLC documentation
│   ├── architecture/        # System architecture
│   ├── orchestration/       # Workflow implementation
│   └── deployment/          # Deployment guides
├── services/                # Microservice implementations
│   ├── scraper-orchestrator/
│   ├── data-transformer/
│   ├── api-gateway/
│   └── ...
├── sql/                     # Database schemas
│   └── init/
├── monitoring/              # Monitoring configurations
│   ├── prometheus/
│   └── grafana/
├── .claude/                 # Orchestration configs
│   ├── unified-orchestration-config.yaml
│   └── orchestration_todos.json
├── docker-compose.yml       # Main Docker configuration
└── README.md               # This file
```

## 🚀 Quick Start

For day-to-day contributor expectations, review [AGENTS.md](./AGENTS.md).

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 16GB RAM minimum
- 100GB disk space

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/zvirb/musicdb_scrapy.git
cd songnodes
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your API keys and passwords
```

3. **Start the services**
```bash
# Start essential services (MANDATORY: Use Docker Compose)
docker compose up -d postgres redis rest-api api-gateway

# Start frontend UI
docker compose up -d frontend

# Start scraping services (optional)
docker compose up -d scraper-orchestrator scraper-1001tracklists

# Start monitoring (optional)
docker compose up -d prometheus grafana
```

4. **Verify services are running**
```bash
docker compose ps
curl http://localhost:8080/health
curl http://localhost:8082/health
```

5. **Access the services**
- **SongNodes UI**: http://localhost:3006 (Main interface)
- **API Gateway**: http://localhost:8080 (REST endpoints)
- **Target Tracks API**: http://localhost:8082/api/v1/target-tracks
- **GraphQL Playground**: http://localhost:8081/graphql
- **Grafana Dashboard**: http://localhost:3001 (admin/admin)
- **Ollama AI**: http://localhost:11434

## ✅ Current System Status (Sept 2025)

### Working Features
- ✅ **REST API Connectivity**: Fixed port exposure, now accessible from frontend
- ✅ **API Gateway Routing**: Complete proxy routing for target tracks endpoints
- ✅ **Target Tracks CRUD**: Full create/read/update/delete operations working
- ✅ **User Feedback Loop**: Frontend → API Gateway → REST API pathway verified
- ✅ **TypeScript Compilation**: Fixed type definitions and imports
- ✅ **Docker System**: Optimized with 60GB+ cleanup, services running healthy

### API Endpoints Working
```bash
# List target tracks
curl http://localhost:8080/api/v1/target-tracks

# Create new target track
curl -X POST http://localhost:8080/api/v1/target-tracks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Track", "artist": "Test Artist", "priority": "medium"}'

# Trigger search for track
curl -X POST http://localhost:8080/api/v1/target-tracks/1/search
```

### Service Health
- 🟢 PostgreSQL (port 5433) - Healthy
- 🟢 Redis (port 6380) - Healthy
- 🟢 REST API (port 8082) - Healthy
- 🟢 API Gateway (port 8080) - Healthy
- 🟢 Frontend (port 3006) - Building and running

## 📋 Orchestration Workflow

The project follows a 12-step orchestration workflow:

1. **Todo Context Integration** - Load and prioritize tasks
2. **Agent Ecosystem Validation** - Verify all services are operational
3. **Strategic Intelligence Planning** - Analyze patterns and plan execution
4. **Multi-Domain Research Discovery** - Parallel research across domains
5. **Context Synthesis & Compression** - Integrate findings efficiently
6. **Parallel Implementation Execution** - Multi-stream task execution
7. **Evidence-Based Validation** - Validate with concrete evidence
8. **Decision & Iteration Control** - Analyze and iterate if needed
9. **Atomic Version Control** - Commit changes atomically
10. **Meta-Orchestration Audit** - Analyze workflow effectiveness
11. **Production Deployment** - Blue-green deployment
12. **Production Validation** - Monitor and loop control

## 🔌 API Usage

### REST API Example
```bash
# Get tracks
curl http://localhost:8082/api/v1/tracks?limit=10

# Search artists
curl http://localhost:8082/api/v1/artists/search?q=deadmau5
```

### GraphQL Example
```graphql
query {
  tracks(limit: 10, genre: "Tech House") {
    id
    title
    artists {
      name
      role
    }
    playCount
  }
}
```

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:8083/live');
ws.onmessage = (event) => {
  console.log('New track scraped:', JSON.parse(event.data));
};
```

## 📊 Monitoring

Access monitoring dashboards:
- **Grafana**: http://localhost:3001
  - Scraping metrics
  - API performance
  - System resources
- **Prometheus**: http://localhost:9091
- **Kibana**: http://localhost:5602

## 🧪 Testing

```bash
# Run unit tests
docker-compose exec scraper-orchestrator pytest tests/unit/

# Run integration tests
docker-compose exec scraper-orchestrator pytest tests/integration/

# Run end-to-end tests
./scripts/run-e2e-tests.sh
```

## 🚢 Deployment

### Development (Docker Compose)
```bash
# Start all services
docker compose up -d

# Start specific services
docker compose up -d postgres redis rest-api frontend

# View logs
docker compose logs -f rest-api

# Rebuild after code changes
docker compose build rest-api && docker compose up -d rest-api
```

### Production (Kubernetes)
```bash
# See k8s/README.md for complete instructions

# 1. Create namespace and secrets
kubectl apply -f k8s/base/namespace.yaml
kubectl create secret generic songnodes-secrets --from-env-file=.env -n songnodes

# 2. Deploy with Kustomize
kubectl apply -k k8s/base/                    # Base deployment
kubectl apply -k k8s/overlays/production/     # Production overrides

# 3. Verify deployment
kubectl get pods -n songnodes
kubectl get svc -n songnodes
kubectl get ingress -n songnodes

# 4. Access services
kubectl port-forward svc/frontend-service 3006:80 -n songnodes
kubectl port-forward svc/grafana-service 3000:3000 -n songnodes
```

**Production Features**:
- StatefulSets for PostgreSQL, Redis, RabbitMQ with persistent volumes
- HorizontalPodAutoscalers (3-10 replicas) for REST API, Frontend, Graph API
- NetworkPolicies for security isolation between services
- Ingress with TLS/SSL support (cert-manager integration)
- Prometheus + Grafana monitoring with ServiceMonitor CRDs
- Resource limits: DBs (2-4GB), APIs (512MB-1GB), Frontend (256MB)

## 📝 Documentation

Comprehensive documentation available in `/docs`:
- [SDLC Overview](docs/sdlc/01-project-overview.md)
- [Container Architecture](docs/architecture/container-architecture.md)
- [Orchestration Workflow](docs/orchestration/workflow-implementation.md)
- [Deployment Guide](docs/deployment/deployment-guide.md)
- **[Kubernetes Deployment](k8s/README.md)** - Production deployment guide ⭐
- **[Proxy Configuration](docs/PROXY_CONFIGURATION.md)** - Enterprise proxy setup
- **[Scraper Configuration](docs/SCRAPER_CONFIGURATION.md)** - Multi-platform scraping
- **[NLP API Usage](services/nlp-processor/API_USAGE.md)** - Tracklist extraction
- **[Implementation Progress](IMPLEMENTATION_PROGRESS.md)** - Feature roadmap

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built using the 12-step agentic orchestration workflow
- Scrapy framework for web scraping
- PostgreSQL for robust data storage
- Docker for containerization

## 📞 Support

For issues or questions:
- Create an issue on GitHub
- Check logs: `docker-compose logs [service_name]`
- Review orchestration status: http://localhost:8001/orchestration/status

---

**Note**: This project uses non-standard ports to avoid conflicts. See the [port reference](docs/deployment/deployment-guide.md#port-reference) for details.
