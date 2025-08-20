import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('Starting global teardown...');

  try {
    // Clean up test data
    await cleanupTestData();

    // Generate performance report
    await generatePerformanceReport();

    // Clean up temporary files
    await cleanupTempFiles();

    console.log('Global teardown complete');
  } catch (error) {
    console.error('Error during global teardown:', error);
  }
}

async function cleanupTestData() {
  console.log('Cleaning up test data...');
  
  try {
    // Clear any persistent test data
    // This would connect to test database and clean up
    // For now, just log the cleanup
    console.log('Test data cleanup complete');
  } catch (error) {
    console.warn('Failed to cleanup test data:', error);
  }
}

async function generatePerformanceReport() {
  console.log('Generating performance report...');
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Read performance metrics from test results
    const testResultsPath = path.join(process.cwd(), 'test-results');
    
    try {
      const resultsDir = await fs.readdir(testResultsPath);
      const performanceMetrics: any[] = [];
      
      for (const file of resultsDir) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(testResultsPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            if (data.performance) {
              performanceMetrics.push(data.performance);
            }
          } catch (error) {
            // Skip invalid JSON files
          }
        }
      }
      
      if (performanceMetrics.length > 0) {
        const report = {
          timestamp: new Date().toISOString(),
          summary: {
            totalTests: performanceMetrics.length,
            averageLoadTime: calculateAverage(performanceMetrics, 'loadTime'),
            averageFPS: calculateAverage(performanceMetrics, 'fps'),
            averageMemoryUsage: calculateAverage(performanceMetrics, 'memoryUsage'),
          },
          metrics: performanceMetrics,
        };
        
        const reportPath = path.join(testResultsPath, 'performance-report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`Performance report generated: ${reportPath}`);
        console.log(`Average load time: ${report.summary.averageLoadTime}ms`);
        console.log(`Average FPS: ${report.summary.averageFPS}`);
        console.log(`Average memory usage: ${report.summary.averageMemoryUsage}MB`);
      }
    } catch (error) {
      console.log('No performance metrics found');
    }
  } catch (error) {
    console.warn('Failed to generate performance report:', error);
  }
}

async function cleanupTempFiles() {
  console.log('Cleaning up temporary files...');
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Clean up old screenshots and videos (keep last 10 runs)
    const testResultsPath = path.join(process.cwd(), 'test-results');
    
    try {
      const files = await fs.readdir(testResultsPath);
      const screenshotFiles = files.filter(f => 
        f.endsWith('.png') || f.endsWith('.webm') || f.endsWith('.mp4')
      );
      
      // Sort by creation time and keep only recent files
      const fileStats = await Promise.all(
        screenshotFiles.map(async (file) => {
          const filePath = path.join(testResultsPath, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime, path: filePath };
        })
      );
      
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // Keep only the 50 most recent files
      const filesToDelete = fileStats.slice(50);
      
      for (const { path: filePath } of filesToDelete) {
        await fs.unlink(filePath);
      }
      
      if (filesToDelete.length > 0) {
        console.log(`Cleaned up ${filesToDelete.length} old test artifacts`);
      }
    } catch (error) {
      console.log('No test artifacts to clean up');
    }
  } catch (error) {
    console.warn('Failed to cleanup temp files:', error);
  }
}

function calculateAverage(metrics: any[], field: string): number {
  const values = metrics
    .map(m => m[field])
    .filter(v => typeof v === 'number' && !isNaN(v));
  
  if (values.length === 0) return 0;
  
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round(sum / values.length * 100) / 100; // Round to 2 decimal places
}

export default globalTeardown;