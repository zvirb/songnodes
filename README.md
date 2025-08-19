# MusicDB Scrapy Project - Orchestrated Data Pipeline

## 🎵 Overview

MusicDB is a sophisticated data engineering pipeline that scrapes, transforms, and loads music tracklist data from diverse online sources into a unified PostgreSQL database. Built with containerized microservices using non-standard ports to avoid conflicts, it follows a 12-step orchestration workflow for reliable, scalable data processing.

## 🚀 Key Features

- **Multi-Source Scraping**: Automated data collection from 1001tracklists, MixesDB, Setlist.fm, Reddit, Apple Music, and more
- **Intelligent Data Processing**: NLP-powered normalization, deduplication, and entity extraction
- **Scalable Architecture**: Containerized microservices with horizontal scaling capabilities
- **Real-time Analytics**: GraphQL and REST APIs with WebSocket support for live updates
- **Comprehensive Monitoring**: Prometheus, Grafana, and ELK stack integration
- **Orchestrated Workflow**: 12-step agentic orchestration for reliable pipeline execution

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

- **Scraping**: Scrapy, Playwright, BeautifulSoup, Selenium
- **Data Processing**: Python, spaCy, pandas, NumPy
- **Database**: PostgreSQL 15 with JSONB support
- **Cache/Queue**: Redis, RabbitMQ
- **APIs**: FastAPI, GraphQL, WebSocket
- **Monitoring**: Prometheus, Grafana, Elasticsearch, Kibana
- **Containerization**: Docker, Docker Compose
- **CI/CD**: GitHub Actions, Blue-Green Deployment

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
# Start core services
docker-compose up -d postgres redis rabbitmq

# Start scraping services
docker-compose up -d scraper-orchestrator scraper-1001tracklists

# Start API services
docker-compose up -d api-gateway rest-api graphql-api

# Start monitoring
docker-compose up -d prometheus grafana
```

4. **Initialize the database**
```bash
docker-compose exec postgres psql -U musicdb_user -d musicdb -f /docker-entrypoint-initdb.d/01-schema.sql
```

5. **Access the services**
- API Gateway: http://localhost:8080
- GraphQL Playground: http://localhost:8081/graphql
- Grafana Dashboard: http://localhost:3001 (admin/admin)
- Kibana Logs: http://localhost:5602

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

### Production Deployment
```bash
# Use production compose file
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Run database migrations
docker-compose exec postgres psql -U musicdb_user -d musicdb -f /migrations/latest.sql

# Verify deployment
./scripts/verify-deployment.sh
```

### Scaling
```bash
# Scale scrapers
docker-compose up -d --scale scraper-1001tracklists=5

# Scale API services
docker-compose up -d --scale rest-api=3
```

## 📝 Documentation

Comprehensive documentation available in `/docs`:
- [SDLC Overview](docs/sdlc/01-project-overview.md)
- [Container Architecture](docs/architecture/container-architecture.md)
- [Orchestration Workflow](docs/orchestration/workflow-implementation.md)
- [Deployment Guide](docs/deployment/deployment-guide.md)

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