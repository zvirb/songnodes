#!/bin/bash
# SongNodes Orchestration Integration Script
# Combines claude-flow and UnifiedWorkflow capabilities

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🎵 SongNodes Orchestration System${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if both tools are available
if [ ! -d "UnifiedWorkflow" ]; then
    echo -e "${RED}❌ UnifiedWorkflow not found!${NC}"
    echo "Please ensure UnifiedWorkflow submodule is initialized"
    exit 1
fi

if [ ! -d "claude-flow" ]; then
    echo -e "${RED}❌ claude-flow not found!${NC}"
    echo "Please clone claude-flow first"
    exit 1
fi

# Function to run UnifiedWorkflow
run_unified_workflow() {
    echo -e "${BLUE}🔧 Starting UnifiedWorkflow (62+ agents)...${NC}"
    cd UnifiedWorkflow
    if [ -f "orchestration_suite.py" ]; then
        python orchestration_suite.py "$@"
    else
        echo -e "${YELLOW}⚠️  UnifiedWorkflow orchestration script not found${NC}"
    fi
    cd ..
}

# Function to run claude-flow
run_claude_flow() {
    echo -e "${GREEN}🐝 Starting claude-flow (54 agents + 87 MCP tools)...${NC}"
    npx claude-flow "$@"
}

# Function to run both in coordination
run_coordinated() {
    echo -e "${PURPLE}🌊 Running Coordinated Orchestration${NC}"
    echo ""

    # Parse task type
    TASK_TYPE="$1"
    TASK_DESC="${2:-Development task}"

    case "$TASK_TYPE" in
        "frontend")
            echo -e "${CYAN}📱 Frontend Development Task${NC}"
            echo "Using claude-flow for UI/UX agents and UnifiedWorkflow for architecture"
            npx claude-flow sparc run ui-designer "$TASK_DESC" &
            FLOW_PID=$!
            cd UnifiedWorkflow && python -c "from orchestration_suite import run_agent; run_agent('frontend-architect', '$TASK_DESC')" &
            UNIFIED_PID=$!
            wait $FLOW_PID $UNIFIED_PID
            ;;

        "backend")
            echo -e "${YELLOW}⚙️  Backend Development Task${NC}"
            echo "Using UnifiedWorkflow for API design and claude-flow for implementation"
            cd UnifiedWorkflow && python -c "from orchestration_suite import run_agent; run_agent('backend-gateway-expert', '$TASK_DESC')" &
            UNIFIED_PID=$!
            npx claude-flow sparc run backend-dev "$TASK_DESC" &
            FLOW_PID=$!
            wait $UNIFIED_PID $FLOW_PID
            ;;

        "performance")
            echo -e "${RED}🚀 Performance Optimization Task${NC}"
            echo "Using both systems for comprehensive analysis"
            npx claude-flow sparc run perf-analyzer "$TASK_DESC" &
            cd UnifiedWorkflow && python -c "from orchestration_suite import run_agent; run_agent('performance-profiler', '$TASK_DESC')" &
            wait
            ;;

        "security")
            echo -e "${RED}🔒 Security Audit Task${NC}"
            echo "Running security validators from both systems"
            npx claude-flow hooks pre-task --description "Security audit: $TASK_DESC"
            cd UnifiedWorkflow && python -c "from orchestration_suite import run_agent; run_agent('security-validator', '$TASK_DESC')"
            npx claude-flow sparc run security-auditor "$TASK_DESC"
            ;;

        "full-stack")
            echo -e "${PURPLE}🎯 Full-Stack Development${NC}"
            echo "Deploying swarm intelligence from both systems"

            # Initialize claude-flow swarm
            npx claude-flow swarm init --topology mesh --max-agents 8

            # Run UnifiedWorkflow orchestration
            cd UnifiedWorkflow && python -c "
from orchestration_suite import OrchestratorAgent
orchestrator = OrchestratorAgent()
orchestrator.run_full_stack('$TASK_DESC')
" &

            # Run claude-flow agents in parallel
            npx claude-flow sparc batch "backend-dev,frontend-dev,tester,reviewer" "$TASK_DESC"
            wait
            ;;

        *)
            echo -e "${CYAN}📋 General Task${NC}"
            echo "Using intelligent routing between systems"
            npx claude-flow sparc run planner "$TASK_DESC"
            ;;
    esac
}

# Main menu
show_menu() {
    echo -e "${CYAN}Choose orchestration mode:${NC}"
    echo ""
    echo -e "${GREEN}1)${NC} UnifiedWorkflow Only (62+ specialized agents)"
    echo -e "${BLUE}2)${NC} claude-flow Only (54 agents + 87 MCP tools)"
    echo -e "${PURPLE}3)${NC} Coordinated Mode (Both systems working together)"
    echo -e "${YELLOW}4)${NC} SongNodes Music Data Task"
    echo -e "${RED}5)${NC} Exit"
    echo ""
}

# SongNodes specific tasks
run_songnodes_task() {
    echo -e "${CYAN}🎵 SongNodes Music Data Orchestration${NC}"
    echo ""
    echo "Select task:"
    echo "1) Scraper Development"
    echo "2) Graph Visualization Optimization"
    echo "3) Database Performance Tuning"
    echo "4) Frontend Performance"
    echo "5) Full System Optimization"

    read -p "Choice: " songnodes_choice

    case "$songnodes_choice" in
        1)
            echo "Starting scraper development orchestration..."
            npx claude-flow sparc tdd "music data scraper for 1001tracklists integration"
            ;;
        2)
            echo "Optimizing graph visualization..."
            run_coordinated "frontend" "optimize D3.js force-directed graph rendering for 1000+ nodes"
            ;;
        3)
            echo "Tuning database performance..."
            run_coordinated "backend" "optimize PostgreSQL queries for music relationship graph"
            ;;
        4)
            echo "Enhancing frontend performance..."
            npx claude-flow sparc run perf-analyzer "analyze React component rendering in GraphCanvas"
            ;;
        5)
            echo "Running full system optimization..."
            run_coordinated "full-stack" "comprehensive SongNodes platform optimization"
            ;;
    esac
}

# Main execution
if [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    echo "Usage: $0 [unified|flow|coordinated|songnodes] [task_type] [task_description]"
    echo ""
    echo "Examples:"
    echo "  $0                    # Interactive menu"
    echo "  $0 unified           # Run UnifiedWorkflow"
    echo "  $0 flow              # Run claude-flow"
    echo "  $0 coordinated frontend 'Build React component'"
    echo "  $0 songnodes         # SongNodes-specific tasks"
    exit 0
fi

# Handle command line arguments
if [ -n "$1" ]; then
    case "$1" in
        "unified")
            shift
            run_unified_workflow "$@"
            ;;
        "flow")
            shift
            run_claude_flow "$@"
            ;;
        "coordinated")
            shift
            run_coordinated "$@"
            ;;
        "songnodes")
            run_songnodes_task
            ;;
        *)
            echo -e "${RED}Unknown command: $1${NC}"
            echo "Use --help for usage information"
            ;;
    esac
else
    # Interactive mode
    show_menu
    read -p "Select option (1-5): " choice

    case "$choice" in
        1)
            echo "Enter task description:"
            read task_desc
            run_unified_workflow "$task_desc"
            ;;
        2)
            echo "Enter task description:"
            read task_desc
            run_claude_flow sparc run planner "$task_desc"
            ;;
        3)
            echo "Enter task type (frontend/backend/performance/security/full-stack):"
            read task_type
            echo "Enter task description:"
            read task_desc
            run_coordinated "$task_type" "$task_desc"
            ;;
        4)
            run_songnodes_task
            ;;
        5)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
fi

echo ""
echo -e "${GREEN}✅ Orchestration complete!${NC}"