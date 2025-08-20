#!/bin/bash

# SongNodes Performance Analysis Script
# Comprehensive GPU and system performance profiling

echo "======================================================="
echo "SongNodes Performance Analysis"
echo "Timestamp: $(date)"
echo "======================================================="

# Create output file
OUTPUT_FILE="performance_analysis_$(date +%Y%m%d_%H%M%S).json"

# Start JSON output
cat > $OUTPUT_FILE << 'EOF'
{
  "analysis_timestamp": "$(date -Iseconds)",
  "system_info": {
EOF

# System Information
echo "=== SYSTEM INFORMATION ==="
echo "CPU: $(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)"
echo "Cores: $(nproc)"
echo "Memory: $(free -h | grep '^Mem:' | awk '{print $2}')"

# Add to JSON
cat >> $OUTPUT_FILE << EOF
    "cpu_model": "$(lscpu | grep 'Model name' | cut -d':' -f2 | xargs)",
    "cpu_cores": $(nproc),
    "memory_total": "$(free -h | grep '^Mem:' | awk '{print $2}')",
    "load_average": "$(uptime | awk -F'load average:' '{print $2}' | xargs)"
  },
EOF

echo ""

# GPU Analysis
echo "=== GPU ANALYSIS ==="
if command -v nvidia-smi &> /dev/null; then
    echo "NVIDIA GPU detected:"
    nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw --format=csv,noheader,nounits
    
    # Extract metrics for JSON
    GPU_UTIL=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits)
    GPU_MEM_USED=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits)
    GPU_MEM_TOTAL=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits)
    GPU_TEMP=$(nvidia-smi --query-gpu=temperature.gpu --format=csv,noheader,nounits)
    GPU_POWER=$(nvidia-smi --query-gpu=power.draw --format=csv,noheader,nounits)
    
    cat >> $OUTPUT_FILE << EOF
  "gpu_metrics": {
    "name": "$(nvidia-smi --query-gpu=name --format=csv,noheader)",
    "utilization_percent": $GPU_UTIL,
    "memory_used_mb": $GPU_MEM_USED,
    "memory_total_mb": $GPU_MEM_TOTAL,
    "memory_free_mb": $((GPU_MEM_TOTAL - GPU_MEM_USED)),
    "memory_utilization_percent": $(echo "scale=2; $GPU_MEM_USED * 100 / $GPU_MEM_TOTAL" | bc),
    "temperature_celsius": $GPU_TEMP,
    "power_draw_watts": $GPU_POWER
  },
EOF
    
    # GPU Performance Assessment
    echo ""
    echo "GPU Performance Assessment:"
    if [ "$GPU_UTIL" -lt 50 ]; then
        echo "⚠️  GPU Utilization LOW: ${GPU_UTIL}% (Target: >50% for ML readiness)"
        echo "   Opportunity: Significant GPU optimization potential"
    elif [ "$GPU_UTIL" -lt 70 ]; then
        echo "📊 GPU Utilization MEDIUM: ${GPU_UTIL}%"
    else
        echo "✅ GPU Utilization HIGH: ${GPU_UTIL}%"
    fi
    
    GPU_MEM_PERCENT=$(echo "scale=1; $GPU_MEM_USED * 100 / $GPU_MEM_TOTAL" | bc)
    if (( $(echo "$GPU_MEM_PERCENT < 30" | bc -l) )); then
        echo "⚠️  GPU Memory Usage LOW: ${GPU_MEM_PERCENT}%"
        echo "   Opportunity: Can cache more data in GPU memory"
    fi
    
else
    echo "No NVIDIA GPU detected"
    cat >> $OUTPUT_FILE << 'EOF'
  "gpu_metrics": null,
EOF
fi

echo ""

# System Resource Analysis
echo "=== SYSTEM RESOURCES ==="
echo "Memory Usage:"
free -h

echo ""
echo "CPU Usage (5-second sample):"
top -bn2 | grep "Cpu(s)" | tail -1

echo ""
echo "Disk Usage:"
df -h / | tail -1

echo ""
echo "Network Interfaces:"
ip addr show | grep -E "inet|interface"

# Add system metrics to JSON
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEMORY_USAGE=$(free | grep '^Mem:' | awk '{printf "%.1f", $3/$2 * 100.0}')
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)

cat >> $OUTPUT_FILE << EOF
  "system_metrics": {
    "cpu_usage_percent": $CPU_USAGE,
    "memory_usage_percent": $MEMORY_USAGE,
    "disk_usage_percent": $DISK_USAGE,
    "uptime": "$(uptime -p)"
  },
EOF

echo ""

# Frontend Performance Check
echo "=== FRONTEND ANALYSIS ==="
if pgrep -f "vite" > /dev/null; then
    echo "✅ Vite development server is running"
    VITE_PID=$(pgrep -f "vite")
    echo "Vite Process ID: $VITE_PID"
    
    # Check resource usage of frontend process
    if [ -n "$VITE_PID" ]; then
        VITE_CPU=$(ps -p $VITE_PID -o %cpu --no-headers 2>/dev/null || echo "0")
        VITE_MEM=$(ps -p $VITE_PID -o %mem --no-headers 2>/dev/null || echo "0")
        echo "Vite CPU Usage: ${VITE_CPU}%"
        echo "Vite Memory Usage: ${VITE_MEM}%"
    fi
else
    echo "❌ Vite development server not detected"
fi

# Check for browser processes
echo ""
echo "Browser Processes:"
ps aux | grep -E "(chrome|firefox|chromium)" | grep -v grep | head -5

echo ""

# Docker Services Check
echo "=== DOCKER SERVICES ==="
if command -v docker &> /dev/null; then
    echo "Docker containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "No running containers"
else
    echo "Docker not available"
fi

echo ""

# Performance Recommendations
echo "=== PERFORMANCE ANALYSIS ==="

# ML Readiness Score Calculation
ML_SCORE=0
BOTTLENECKS=()

if [ -n "$GPU_UTIL" ]; then
    if [ "$GPU_UTIL" -ge 50 ]; then
        ML_SCORE=$((ML_SCORE + 40))
    else
        BOTTLENECKS+=("GPU_utilization_${GPU_UTIL}%")
    fi
    
    if (( $(echo "$GPU_MEM_PERCENT >= 40" | bc -l) )); then
        ML_SCORE=$((ML_SCORE + 30))
    else
        BOTTLENECKS+=("GPU_memory_${GPU_MEM_PERCENT}%")
    fi
fi

if (( $(echo "$CPU_USAGE <= 70" | bc -l) )); then
    ML_SCORE=$((ML_SCORE + 20))
else
    BOTTLENECKS+=("CPU_overload_${CPU_USAGE}%")
fi

if (( $(echo "$MEMORY_USAGE <= 75" | bc -l) )); then
    ML_SCORE=$((ML_SCORE + 10))
else
    BOTTLENECKS+=("Memory_pressure_${MEMORY_USAGE}%")
fi

echo "ML Readiness Score: $ML_SCORE/100"

if [ "$ML_SCORE" -ge 80 ]; then
    ML_LEVEL="HIGH"
elif [ "$ML_SCORE" -ge 60 ]; then
    ML_LEVEL="MEDIUM"  
else
    ML_LEVEL="LOW"
fi

echo "ML Readiness Level: $ML_LEVEL"

if [ ${#BOTTLENECKS[@]} -gt 0 ]; then
    echo "Bottlenecks: ${BOTTLENECKS[*]}"
fi

# Add recommendations to JSON
cat >> $OUTPUT_FILE << EOF
  "performance_analysis": {
    "ml_readiness_score": $ML_SCORE,
    "ml_readiness_level": "$ML_LEVEL",
    "bottlenecks": [$(printf '"%s",' "${BOTTLENECKS[@]}" | sed 's/,$//')]
  },
  "optimization_opportunities": [
EOF

# Generate specific recommendations
echo ""
echo "OPTIMIZATION OPPORTUNITIES:"

OPPORTUNITIES=()

if [ -n "$GPU_UTIL" ] && [ "$GPU_UTIL" -lt 50 ]; then
    echo "1. 🎯 GPU UNDERUTILIZATION (HIGH PRIORITY)"
    echo "   Current: ${GPU_UTIL}% | Target: >50%"
    echo "   Recommendations:"
    echo "   - Implement GPU-accelerated WebGL shaders for graph rendering"
    echo "   - Move D3.js force calculations to GPU compute shaders"
    echo "   - Enable hardware-accelerated canvas operations in PIXI.js"
    echo "   - Implement parallel node/edge processing on GPU"
    
    cat >> $OUTPUT_FILE << 'EOF'
    {
      "category": "GPU_UNDERUTILIZATION",
      "severity": "HIGH",
      "description": "GPU utilization below target for ML readiness",
      "recommendations": [
        "Implement GPU-accelerated WebGL shaders",
        "Move D3.js calculations to GPU compute shaders", 
        "Enable hardware-accelerated canvas operations",
        "Implement parallel processing on GPU"
      ]
    },
EOF
fi

if [ -n "$GPU_MEM_PERCENT" ] && (( $(echo "$GPU_MEM_PERCENT < 30" | bc -l) )); then
    echo "2. 💾 GPU MEMORY UNDERUTILIZATION (MEDIUM PRIORITY)"
    echo "   Current: ${GPU_MEM_PERCENT}% | Target: >40%"
    echo "   Recommendations:"
    echo "   - Increase texture cache size for node/edge rendering"
    echo "   - Pre-load larger graph datasets into GPU memory"
    echo "   - Implement GPU-based spatial indexing for fast queries"
    echo "   - Cache frequent shader computations"
    
    cat >> $OUTPUT_FILE << 'EOF'
    {
      "category": "GPU_MEMORY_UNDERUTILIZATION",
      "severity": "MEDIUM", 
      "description": "GPU memory usage below optimal threshold",
      "recommendations": [
        "Increase texture cache size",
        "Pre-load datasets into GPU memory",
        "Implement GPU-based spatial indexing",
        "Cache shader computations"
      ]
    },
EOF
fi

if (( $(echo "$CPU_USAGE > 70" | bc -l) )); then
    echo "3. ⚡ HIGH CPU USAGE (HIGH PRIORITY)"
    echo "   Current: ${CPU_USAGE}% | Target: <70%"
    echo "   Recommendations:"
    echo "   - Offload calculations to Web Workers"
    echo "   - Optimize JavaScript event handling"
    echo "   - Implement requestAnimationFrame throttling"
    echo "   - Reduce DOM manipulation frequency"
    
    cat >> $OUTPUT_FILE << 'EOF'
    {
      "category": "HIGH_CPU_USAGE",
      "severity": "HIGH",
      "description": "CPU usage above recommended threshold",
      "recommendations": [
        "Offload calculations to Web Workers",
        "Optimize JavaScript event handling", 
        "Implement requestAnimationFrame throttling",
        "Reduce DOM manipulation frequency"
      ]
    },
EOF
fi

# Remove trailing comma and close JSON
sed -i '$ s/,$//' $OUTPUT_FILE
cat >> $OUTPUT_FILE << 'EOF'
  ]
}
EOF

echo ""
echo "4. 🔧 PIXI.js OPTIMIZATIONS:"
echo "   - Enable WebGL2 context for advanced GPU features"
echo "   - Implement object pooling for sprites and graphics"
echo "   - Use ParticleContainer for large numbers of nodes"
echo "   - Optimize texture atlasing for better GPU memory usage"

echo ""
echo "5. 📊 MONITORING IMPROVEMENTS:"
echo "   - Add GPU metrics to Prometheus monitoring"
echo "   - Implement real-time performance dashboards"
echo "   - Set up automated performance regression detection"
echo "   - Add WebGL context loss detection and recovery"

echo ""
echo "======================================================="
echo "Analysis complete! Detailed results saved to: $OUTPUT_FILE"
echo "======================================================="

# Display summary
echo ""
echo "SUMMARY:"
echo "--------"
if [ -n "$GPU_UTIL" ]; then
    echo "GPU Utilization: ${GPU_UTIL}% ($([ "$GPU_UTIL" -lt 50 ] && echo "NEEDS OPTIMIZATION" || echo "GOOD"))"
    echo "GPU Memory: ${GPU_MEM_PERCENT}% ($([ "$GPU_MEM_PERCENT" -lt 30 ] && echo "UNDERUTILIZED" || echo "ADEQUATE"))"
fi
echo "CPU Usage: ${CPU_USAGE}% ($([ "$CPU_USAGE" -gt 70 ] && echo "HIGH" || echo "NORMAL"))"
echo "Memory Usage: ${MEMORY_USAGE}% ($([ "$MEMORY_USAGE" -gt 75 ] && echo "HIGH" || echo "NORMAL"))"
echo "ML Readiness: $ML_SCORE/100 ($ML_LEVEL)"

echo ""
echo "Next Steps:"
echo "1. Review detailed optimization opportunities above"
echo "2. Implement GPU utilization improvements for ML readiness"
echo "3. Configure comprehensive Prometheus monitoring"
echo "4. Test with larger datasets (>1000 nodes) for stress testing"