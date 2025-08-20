/**
 * Worker Manager for handling expensive operations in Web Workers
 * Prevents main thread blocking and improves performance
 */

import { MessageProcessorInput, MessageProcessorOutput } from '../workers/messageProcessor';

export class WorkerManager {
  private workers: Worker[] = [];
  private workerPool: Worker[] = [];
  private taskQueue: Array<{
    input: MessageProcessorInput;
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = [];
  private readonly maxWorkers = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
  
  constructor() {
    this.initializeWorkers();
  }

  private initializeWorkers(): void {
    for (let i = 0; i < this.maxWorkers; i++) {
      try {
        const worker = new Worker(
          new URL('../workers/messageProcessor.ts', import.meta.url),
          { type: 'module' }
        );
        
        worker.onerror = (error) => {
          console.error(`Worker ${i} error:`, error);
        };
        
        this.workers.push(worker);
        this.workerPool.push(worker);
      } catch (error) {
        console.error(`Failed to create worker ${i}:`, error);
      }
    }
    
    // Fallback: if no workers created, create at least one
    if (this.workers.length === 0) {
      console.warn('No workers created, creating fallback worker');
      try {
        const fallbackWorker = new Worker(
          new URL('../workers/messageProcessor.ts', import.meta.url),
          { type: 'module' }
        );
        this.workers.push(fallbackWorker);
        this.workerPool.push(fallbackWorker);
      } catch (error) {
        console.error('Failed to create fallback worker:', error);
      }
    }
  }

  private getAvailableWorker(): Worker | null {
    return this.workerPool.shift() || null;
  }

  private returnWorker(worker: Worker): void {
    this.workerPool.push(worker);
    this.processQueue();
  }

  private processQueue(): void {
    if (this.taskQueue.length === 0) return;
    
    const worker = this.getAvailableWorker();
    if (!worker) return;
    
    const task = this.taskQueue.shift()!;
    this.executeTaskInternal(worker, task);
  }

  private executeTaskInternal(
    worker: Worker,
    task: {
      input: MessageProcessorInput;
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  ): void {
    const timeout = setTimeout(() => {
      task.reject(new Error('Worker task timeout'));
      this.returnWorker(worker);
    }, 10000); // 10 second timeout

    const handleMessage = (event: MessageEvent<MessageProcessorOutput>) => {
      const { type, data, error } = event.data;
      
      if (type === 'result') {
        clearTimeout(timeout);
        worker.removeEventListener('message', handleMessage);
        this.returnWorker(worker);
        task.resolve(data);
      } else if (type === 'error') {
        clearTimeout(timeout);
        worker.removeEventListener('message', handleMessage);
        this.returnWorker(worker);
        task.reject(new Error(error || 'Worker task failed'));
      }
      // Progress messages are ignored for now
    };

    worker.addEventListener('message', handleMessage);
    worker.postMessage(task.input);
  }

  /**
   * Execute a task in a Web Worker
   */
  async executeTask(input: MessageProcessorInput): Promise<any> {
    return new Promise((resolve, reject) => {
      const task = { input, resolve, reject };
      
      const worker = this.getAvailableWorker();
      if (worker) {
        this.executeTaskInternal(worker, task);
      } else {
        // Queue the task if no workers available
        this.taskQueue.push(task);
      }
    });
  }

  /**
   * Decompress data using Web Worker
   */
  async decompress(data: string): Promise<string> {
    return this.executeTask({
      type: 'decompress',
      data
    });
  }

  /**
   * Process large batch of messages using Web Worker
   */
  async processBatch(messages: any[], chunkSize: number = 10): Promise<any[]> {
    return this.executeTask({
      type: 'process_batch',
      data: messages,
      options: { chunkSize }
    });
  }

  /**
   * Parse large JSON data using Web Worker
   */
  async parseLargeData(jsonString: string): Promise<any> {
    return this.executeTask({
      type: 'parse_large_data',
      data: jsonString
    });
  }

  /**
   * Compute layout positions using Web Worker
   */
  async computeLayout(nodes: any[], edges: any[]): Promise<any[]> {
    return this.executeTask({
      type: 'compute_layout',
      data: { nodes, edges }
    });
  }

  /**
   * Check if workers are available
   */
  get hasAvailableWorkers(): boolean {
    return this.workerPool.length > 0;
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    totalWorkers: number;
    availableWorkers: number;
    queuedTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      availableWorkers: this.workerPool.length,
      queuedTasks: this.taskQueue.length
    };
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    this.workers.forEach(worker => {
      worker.terminate();
    });
    
    this.workers = [];
    this.workerPool = [];
    this.taskQueue = [];
  }
}

// Global worker manager instance
export const globalWorkerManager = new WorkerManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    globalWorkerManager.terminate();
  });
}