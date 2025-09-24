# Gemini Code Assistant Context

## Project Overview

This project, named "songnodes," is a sophisticated data engineering pipeline designed to scrape, transform, and load music tracklist data from various online sources into a unified PostgreSQL database. The system is built with a microservices architecture, containerized using Docker, and orchestrated with a 12-step workflow.

The architecture includes:
- A **frontend** application built with React, Vite, Redux, and D3.js for interactive music graph visualization.
- A **backend** composed of multiple microservices, including a REST API, a GraphQL API, a WebSocket API, and a data processing pipeline.
- **Scraping services** for various sources like 1001tracklists, MixesDB, Setlist.fm, and Reddit.
- A **database layer** with PostgreSQL, Redis, and RabbitMQ.
- **Monitoring and logging** using Prometheus, Grafana, and the ELK stack.

## Building and Running

The project uses Docker Compose to manage the multi-container environment. Key commands are defined in `package.json` and the `Makefile`.

### Docker Commands

- **Start all services:**
  ```bash
  docker-compose up -d
  ```
- **Stop all services:**
  ```bash
  docker-compose down
  ```
- **View logs:**
  ```bash
  docker-compose logs -f
  ```

### Development Commands

- **Start the development environment:**
  ```bash
  npm start
  ```
- **Run tests:**
  ```bash
  npm test
  ```
- **Lint the code:**
  ```bash
  npm run lint
  ```

### Makefile Commands

The `Makefile` provides a comprehensive set of commands for testing and quality assurance.

- **Run all tests:**
  ```bash
  make test
  ```
- **Run unit tests:**
  ```bash
  make test-unit
  ```
- **Run integration tests:**
  ```bash
  make test-integration
  ```
- **Run end-to-end tests:**
  ```bash
  make test-e2e
  ```
- **Format the code:**
  ```bash
  make format
  ```

## Development Conventions

### Testing

The project has a strong emphasis on testing, with a comprehensive testing suite that includes:
- **Unit tests:** Written with `vitest` for the frontend and `pytest` for the backend.
- **Integration tests:** Written with `pytest`.
- **End-to-end tests:** Written with `playwright`.
- **Performance tests:** Written with `locust`.
- **Accessibility tests:** Written with `axe-core`.
- **Security scans:** Using `bandit` and `safety`.

### Coding Style

- The Python code is formatted with `black` and `isort`.
- The frontend code is linted with `eslint`.
- The project uses `prettier` for code formatting.

### Frontend

The frontend is a modern React application with the following key features:
- **Build Tool:** Vite
- **Styling:** Emotion and Tailwind CSS
- **State Management:** Redux Toolkit
- **UI Components:** Material-UI
- **Visualization:** D3.js and Three.js
