#!/usr/bin/env python3
"""
Comprehensive Performance Profiler for SongNodes Music Visualization
Analyzes GPU utilization, system resources, and optimization opportunities
"""

import json
import subprocess
import time
import threading
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional
import psutil

@dataclass
class GPUMetrics:
    utilization: int
    memory_used: int
    memory_total: int
    memory_free: int
    temperature: int
    power_usage: int
    power_limit: int

@dataclass
class SystemMetrics:
    cpu_percent: float
    memory_percent: float
    memory_available: int
    memory_total: int
    disk_io_read: int
    disk_io_write: int
    network_sent: int
    network_recv: int
    load_average: List[float]

@dataclass
class PerformanceProfile:
    timestamp: float
    gpu: Optional[GPUMetrics]
    system: SystemMetrics
    process_metrics: Dict[str, float]

class PerformanceProfiler:
    def __init__(self, duration: int = 60, interval: float = 2.0):
        self.duration = duration
        self.interval = interval
        self.profiles: List[PerformanceProfile] = []
        self.running = False
        
    def get_gpu_metrics(self) -> Optional[GPUMetrics]:
        """Get NVIDIA GPU metrics using nvidia-smi"""
        try:
            cmd = [
                'nvidia-smi', '--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit',
                '--format=csv,noheader,nounits'
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0 and result.stdout.strip():
                values = [float(x.strip()) for x in result.stdout.strip().split(',')]
                return GPUMetrics(
                    utilization=int(values[0]),
                    memory_used=int(values[1]),
                    memory_total=int(values[2]),
                    memory_free=int(values[2] - values[1]),
                    temperature=int(values[3]),
                    power_usage=int(values[4]),
                    power_limit=int(values[5])
                )
        except (subprocess.TimeoutExpired, subprocess.CalledProcessError, ValueError, IndexError):
            pass
        
        return None
    
    def get_system_metrics(self) -> SystemMetrics:
        """Get comprehensive system performance metrics"""
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=None)
        
        # Memory metrics
        memory = psutil.virtual_memory()
        
        # Disk I/O
        disk_io = psutil.disk_io_counters()
        
        # Network I/O
        network_io = psutil.net_io_counters()
        
        # Load average
        load_avg = list(psutil.getloadavg())
        
        return SystemMetrics(
            cpu_percent=cpu_percent,
            memory_percent=memory.percent,
            memory_available=memory.available,
            memory_total=memory.total,
            disk_io_read=disk_io.read_bytes if disk_io else 0,
            disk_io_write=disk_io.write_bytes if disk_io else 0,
            network_sent=network_io.bytes_sent if network_io else 0,
            network_recv=network_io.bytes_recv if network_io else 0,
            load_average=load_avg
        )
    
    def get_process_metrics(self) -> Dict[str, float]:
        """Get metrics for relevant processes"""
        process_metrics = {}
        
        # Look for browser processes (Chrome, Firefox, etc.)
        for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
            try:
                pinfo = proc.info
                name = pinfo['name'].lower()
                
                if any(browser in name for browser in ['chrome', 'firefox', 'node', 'vite']):
                    key = f"{pinfo['name']}_{pinfo['pid']}"
                    process_metrics[key] = {
                        'cpu_percent': pinfo['cpu_percent'],
                        'memory_percent': pinfo['memory_percent']
                    }
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue
        
        return process_metrics
    
    def collect_metrics(self) -> PerformanceProfile:
        """Collect a single performance profile snapshot"""
        gpu_metrics = self.get_gpu_metrics()
        system_metrics = self.get_system_metrics()
        process_metrics = self.get_process_metrics()
        
        return PerformanceProfile(
            timestamp=time.time(),
            gpu=gpu_metrics,
            system=system_metrics,
            process_metrics=process_metrics
        )
    
    def start_profiling(self):
        """Start continuous performance profiling"""
        self.running = True
        self.profiles = []
        
        def profile_loop():
            start_time = time.time()
            while self.running and (time.time() - start_time) < self.duration:
                profile = self.collect_metrics()
                self.profiles.append(profile)
                print(f"Profile collected: GPU {profile.gpu.utilization if profile.gpu else 'N/A'}%, "
                      f"CPU {profile.system.cpu_percent:.1f}%, "
                      f"Memory {profile.system.memory_percent:.1f}%")
                time.sleep(self.interval)
        
        self.profile_thread = threading.Thread(target=profile_loop)
        self.profile_thread.start()
    
    def stop_profiling(self):
        """Stop profiling and return results"""
        self.running = False
        if hasattr(self, 'profile_thread'):
            self.profile_thread.join()
        
        return self.analyze_results()
    
    def analyze_results(self) -> Dict:
        """Analyze collected performance data"""
        if not self.profiles:
            return {"error": "No performance data collected"}
        
        # GPU Analysis
        gpu_analysis = {}
        if self.profiles[0].gpu:
            gpu_utils = [p.gpu.utilization for p in self.profiles if p.gpu]
            gpu_memory_used = [p.gpu.memory_used for p in self.profiles if p.gpu]
            gpu_temps = [p.gpu.temperature for p in self.profiles if p.gpu]
            
            gpu_analysis = {
                "utilization_avg": sum(gpu_utils) / len(gpu_utils),
                "utilization_max": max(gpu_utils),
                "utilization_min": min(gpu_utils),
                "memory_avg_mb": sum(gpu_memory_used) / len(gpu_memory_used),
                "memory_max_mb": max(gpu_memory_used),
                "memory_total_mb": self.profiles[0].gpu.memory_total,
                "memory_utilization_percent": (sum(gpu_memory_used) / len(gpu_memory_used)) / self.profiles[0].gpu.memory_total * 100,
                "temperature_avg": sum(gpu_temps) / len(gpu_temps),
                "temperature_max": max(gpu_temps)
            }
        
        # System Analysis
        cpu_usage = [p.system.cpu_percent for p in self.profiles]
        memory_usage = [p.system.memory_percent for p in self.profiles]
        load_averages = [p.system.load_average[0] for p in self.profiles]
        
        system_analysis = {
            "cpu_avg": sum(cpu_usage) / len(cpu_usage),
            "cpu_max": max(cpu_usage),
            "memory_avg": sum(memory_usage) / len(memory_usage),
            "memory_max": max(memory_usage),
            "load_avg": sum(load_averages) / len(load_averages),
            "load_max": max(load_averages)
        }
        
        # Performance Issues Identification
        performance_issues = []
        optimization_opportunities = []
        
        if gpu_analysis:
            if gpu_analysis["utilization_avg"] < 50:
                optimization_opportunities.append({
                    "category": "GPU_UNDERUTILIZATION",
                    "severity": "HIGH",
                    "current_value": gpu_analysis["utilization_avg"],
                    "target_value": 70,
                    "description": f"GPU utilization avg {gpu_analysis['utilization_avg']:.1f}% - significant optimization potential",
                    "recommendations": [
                        "Implement parallel WebGL shader processing",
                        "Utilize GPU for D3.js force simulation calculations",
                        "Enable hardware-accelerated canvas operations",
                        "Implement compute shaders for graph algorithms"
                    ]
                })
            
            if gpu_analysis["memory_utilization_percent"] < 30:
                optimization_opportunities.append({
                    "category": "GPU_MEMORY_UNDERUTILIZATION", 
                    "severity": "MEDIUM",
                    "current_value": gpu_analysis["memory_utilization_percent"],
                    "target_value": 60,
                    "description": f"GPU memory usage {gpu_analysis['memory_utilization_percent']:.1f}% - can cache more data",
                    "recommendations": [
                        "Increase texture cache size for node/edge rendering",
                        "Pre-load graph datasets into GPU memory",
                        "Implement GPU-based spatial indexing",
                        "Cache frequent shader computations"
                    ]
                })
        
        if system_analysis["cpu_avg"] > 80:
            performance_issues.append({
                "category": "HIGH_CPU_USAGE",
                "severity": "HIGH", 
                "current_value": system_analysis["cpu_avg"],
                "description": f"High CPU usage {system_analysis['cpu_avg']:.1f}% - may impact responsiveness"
            })
        
        if system_analysis["memory_avg"] > 85:
            performance_issues.append({
                "category": "HIGH_MEMORY_USAGE",
                "severity": "HIGH",
                "current_value": system_analysis["memory_avg"], 
                "description": f"High memory usage {system_analysis['memory_avg']:.1f}% - risk of swapping"
            })
        
        # ML Readiness Assessment
        ml_readiness_score = 0
        ml_bottlenecks = []
        
        if gpu_analysis:
            if gpu_analysis["utilization_avg"] >= 50:
                ml_readiness_score += 40
            else:
                ml_bottlenecks.append(f"GPU utilization too low: {gpu_analysis['utilization_avg']:.1f}%")
            
            if gpu_analysis["memory_utilization_percent"] >= 40:
                ml_readiness_score += 30
            else:
                ml_bottlenecks.append(f"GPU memory underutilized: {gpu_analysis['memory_utilization_percent']:.1f}%")
        
        if system_analysis["cpu_avg"] <= 70:
            ml_readiness_score += 20
        else:
            ml_bottlenecks.append(f"CPU overloaded: {system_analysis['cpu_avg']:.1f}%")
        
        if system_analysis["memory_avg"] <= 75:
            ml_readiness_score += 10
        else:
            ml_bottlenecks.append(f"Memory pressure: {system_analysis['memory_avg']:.1f}%")
        
        return {
            "analysis_timestamp": time.time(),
            "profiling_duration": self.duration,
            "samples_collected": len(self.profiles),
            "gpu_analysis": gpu_analysis,
            "system_analysis": system_analysis,
            "performance_issues": performance_issues,
            "optimization_opportunities": optimization_opportunities,
            "ml_readiness": {
                "score": ml_readiness_score,
                "max_score": 100,
                "readiness_level": "HIGH" if ml_readiness_score >= 80 else "MEDIUM" if ml_readiness_score >= 60 else "LOW",
                "bottlenecks": ml_bottlenecks
            },
            "recommendations": {
                "gpu_optimization": [
                    "Enable WebGL2 features for advanced GPU operations",
                    "Implement GPU-accelerated graph layout algorithms",
                    "Use compute shaders for parallel data processing",
                    "Optimize PIXI.js renderer settings for GPU utilization"
                ],
                "system_optimization": [
                    "Implement Web Workers for CPU-intensive tasks",
                    "Enable service worker caching for improved I/O",
                    "Optimize memory usage with object pooling",
                    "Use requestAnimationFrame for better frame timing"
                ]
            }
        }

def main():
    """Run performance profiling analysis"""
    print("Starting SongNodes Performance Profiler...")
    print("=" * 60)
    
    # Quick baseline check
    profiler = PerformanceProfiler(duration=30, interval=1.0)
    baseline = profiler.collect_metrics()
    
    print("BASELINE METRICS:")
    if baseline.gpu:
        print(f"  GPU: {baseline.gpu.utilization}% utilization, {baseline.gpu.memory_used}MB/{baseline.gpu.memory_total}MB memory")
    print(f"  CPU: {baseline.system.cpu_percent:.1f}% utilization")
    print(f"  Memory: {baseline.system.memory_percent:.1f}% used")
    print(f"  Load Average: {baseline.system.load_average[0]:.2f}")
    print()
    
    # Run extended profiling
    print("Running 30-second performance profile...")
    profiler.start_profiling()
    
    # Wait for profiling to complete
    time.sleep(32)  # Give slight buffer
    results = profiler.stop_profiling()
    
    # Save results
    timestamp = int(time.time())
    filename = f"performance_profile_{timestamp}.json"
    
    with open(filename, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\nPerformance analysis complete! Results saved to: {filename}")
    print("=" * 60)
    
    # Print key findings
    if "gpu_analysis" in results and results["gpu_analysis"]:
        gpu = results["gpu_analysis"]
        print(f"GPU ANALYSIS:")
        print(f"  Average Utilization: {gpu['utilization_avg']:.1f}% (Target: >50%)")
        print(f"  Memory Usage: {gpu['memory_utilization_percent']:.1f}%")
        print()
    
    system = results["system_analysis"]
    print(f"SYSTEM ANALYSIS:")
    print(f"  CPU Average: {system['cpu_avg']:.1f}%")
    print(f"  Memory Average: {system['memory_avg']:.1f}%")
    print(f"  Load Average: {system['load_avg']:.2f}")
    print()
    
    ml_readiness = results["ml_readiness"]
    print(f"ML READINESS:")
    print(f"  Score: {ml_readiness['score']}/100 ({ml_readiness['readiness_level']})")
    if ml_readiness["bottlenecks"]:
        print(f"  Bottlenecks: {', '.join(ml_readiness['bottlenecks'])}")
    print()
    
    # Print top optimization opportunities
    if results["optimization_opportunities"]:
        print("TOP OPTIMIZATION OPPORTUNITIES:")
        for i, opp in enumerate(results["optimization_opportunities"][:3], 1):
            print(f"  {i}. {opp['category']}: {opp['description']}")
        print()
    
    return results

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nProfiler interrupted by user")
    except Exception as e:
        print(f"Error during profiling: {e}")