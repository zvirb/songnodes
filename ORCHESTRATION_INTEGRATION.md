# 🎵 SongNodes Orchestration Integration Guide

## Overview

SongNodes now has **dual orchestration capabilities** combining:
- **UnifiedWorkflow**: 62+ specialized development agents
- **claude-flow**: 54 agents + 87 MCP tools with hive-mind intelligence

## ✅ Installation Complete

Both orchestration systems are now installed and configured:

1. **UnifiedWorkflow** - Located in `./UnifiedWorkflow/` submodule
2. **claude-flow** - Located in `./claude-flow/` directory
3. **Integration Script** - `./songnodes-orchestration.sh`

## 🚀 Quick Start

### Using the Integration Script

```bash
# Interactive menu
./songnodes-orchestration.sh

# Direct commands
./songnodes-orchestration.sh unified       # Run UnifiedWorkflow only
./songnodes-orchestration.sh flow          # Run claude-flow only
./songnodes-orchestration.sh coordinated   # Run both systems together
./songnodes-orchestration.sh songnodes     # SongNodes-specific tasks
```

### Direct claude-flow Usage

```bash
# List available SPARC modes
npx claude-flow sparc modes

# Run a specific mode
npx claude-flow sparc run architect "Design graph visualization architecture"

# TDD workflow
npx claude-flow sparc tdd "music data scraper feature"

# Batch multiple modes
npx claude-flow sparc batch "architect,code,tdd" "Build graph component"

# Full pipeline
npx claude-flow sparc pipeline "Complete feature implementation"
```

### Direct UnifiedWorkflow Usage

```bash
cd UnifiedWorkflow
python orchestration_suite.py "Your task description"
```

## 🎯 Task-Specific Recommendations

### Frontend Development
- **Primary**: claude-flow (UI/UX focused agents)
- **Support**: UnifiedWorkflow (architecture patterns)
- **Command**: `./songnodes-orchestration.sh coordinated frontend "task"`

### Backend Development
- **Primary**: UnifiedWorkflow (API expertise)
- **Support**: claude-flow (implementation)
- **Command**: `./songnodes-orchestration.sh coordinated backend "task"`

### Performance Optimization
- **Both Systems**: Comprehensive analysis
- **Command**: `./songnodes-orchestration.sh coordinated performance "task"`

### Security Audits
- **Both Systems**: Multi-layer validation
- **Command**: `./songnodes-orchestration.sh coordinated security "task"`

## 📊 Agent Distribution

### UnifiedWorkflow (62+ agents)
Specialized in:
- Backend architecture
- Database optimization
- Security validation
- Performance profiling
- ML-enhanced orchestration

### claude-flow (54 agents)
Specialized in:
- UI/UX design
- Hive-mind coordination
- Neural pattern recognition
- SPARC TDD workflow
- Real-time swarm intelligence

## 🎵 SongNodes-Specific Workflows

### 1. Scraper Development
```bash
# Using claude-flow TDD
npx claude-flow sparc tdd "1001tracklists scraper with rate limiting"

# Or using orchestration script
./songnodes-orchestration.sh songnodes
# Select option 1
```

### 2. Graph Visualization
```bash
# Coordinated approach for best results
./songnodes-orchestration.sh coordinated frontend \
  "optimize D3.js force-directed graph for 1000+ nodes"
```

### 3. Database Optimization
```bash
# Backend-focused with both systems
./songnodes-orchestration.sh coordinated backend \
  "optimize PostgreSQL for graph relationship queries"
```

### 4. Full Platform Enhancement
```bash
# Deploy all agents
./songnodes-orchestration.sh coordinated full-stack \
  "comprehensive SongNodes performance optimization"
```

## 🔧 Configuration Files

### claude-flow Configuration
- Main config: `./CLAUDE.md` (merged with claude-flow settings)
- SPARC modes: `./.roomodes`
- Memory: `./memory/claude-flow-data.json`
- Hive-mind: `./.hive-mind/`

### UnifiedWorkflow Configuration
- Main config: `./UnifiedWorkflow/config.yaml`
- Agent definitions: `./UnifiedWorkflow/agents/`

## 💡 Best Practices

1. **Use Coordinated Mode** for complex tasks requiring multiple perspectives
2. **Use claude-flow** for UI/UX and rapid prototyping
3. **Use UnifiedWorkflow** for architecture and backend optimization
4. **Always specify task context** for better agent routing

## 🐛 Troubleshooting

### claude-flow Issues
```bash
# Reinitialize if needed
npx claude-flow init --sparc --force

# Check MCP servers
npx claude-flow mcp status
```

### UnifiedWorkflow Issues
```bash
# Update submodule
git submodule update --init --recursive

# Check Python dependencies
cd UnifiedWorkflow && pip install -r requirements.txt
```

## 🌊 Advanced Swarm Deployment

### Initialize Hive-Mind Swarm
```bash
# Basic swarm
npx claude-flow swarm init --topology mesh --max-agents 8

# With memory persistence
npx claude-flow swarm init --topology hierarchical \
  --queen-agent architect \
  --worker-agents "coder,tester,reviewer" \
  --enable-memory
```

### Monitor Swarm Progress
```bash
npx claude-flow swarm status
npx claude-flow swarm monitor --real-time
```

## 📚 Resources

- **claude-flow Docs**: https://github.com/ruvnet/claude-flow
- **UnifiedWorkflow**: ./UnifiedWorkflow/README.md
- **SongNodes Context**: ./CLAUDE.md

## 🎯 Next Steps

1. Test the integration with a simple task
2. Familiarize yourself with SPARC modes
3. Explore hive-mind coordination features
4. Use the orchestration script for complex tasks

---

*Integration completed successfully. Both orchestration systems are ready for use.*