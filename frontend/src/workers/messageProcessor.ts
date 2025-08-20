/**
 * Web Worker for processing heavy message operations
 * Prevents main thread blocking during expensive computations
 */

export interface MessageProcessorInput {
  type: 'decompress' | 'process_batch' | 'compute_layout' | 'parse_large_data';
  data: any;
  options?: {
    compression?: boolean;
    chunkSize?: number;
  };
}

export interface MessageProcessorOutput {
  type: 'result' | 'error' | 'progress';
  data: any;
  error?: string;
  progress?: number;
}

// Simple run-length decompression for large payloads
function decompress(data: string): string {
  let decompressed = '';
  let i = 0;
  
  while (i < data.length) {
    if (i < data.length - 1 && /\d/.test(data[i])) {
      const count = parseInt(data[i]);
      const char = data[i + 1];
      if (char !== undefined) {
        decompressed += char.repeat(count);
        i += 2;
      } else {
        decompressed += data[i];
        i++;
      }
    } else {
      decompressed += data[i];
      i++;
    }
  }
  
  return decompressed;
}

// Process large batches of messages in chunks
function processBatch(messages: any[], chunkSize: number = 10): any[] {
  const results: any[] = [];
  
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    
    // Process each chunk
    const processedChunk = chunk.map(message => ({
      ...message,
      processed: true,
      timestamp: Date.now()
    }));
    
    results.push(...processedChunk);
    
    // Report progress
    const progress = Math.min(100, (i + chunkSize) / messages.length * 100);
    self.postMessage({
      type: 'progress',
      data: null,
      progress
    } as MessageProcessorOutput);
  }
  
  return results;
}

// Parse large JSON data with progress reporting
function parseLargeData(jsonString: string): any {
  try {
    // For very large JSON, we might need chunked parsing
    // This is a simplified version
    const parsed = JSON.parse(jsonString);
    
    if (Array.isArray(parsed) && parsed.length > 1000) {
      // Report progress for large arrays
      self.postMessage({
        type: 'progress',
        data: null,
        progress: 50
      } as MessageProcessorOutput);
    }
    
    return parsed;
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error.message}`);
  }
}

// Compute layout positions (simplified Barnes-Hut implementation)
function computeLayout(nodes: any[], edges: any[]): any[] {
  const result = nodes.map((node, index) => {
    // Simple force-directed positioning
    let fx = 0, fy = 0;
    
    // Repulsion from other nodes
    for (let i = 0; i < nodes.length; i++) {
      if (i === index) continue;
      
      const other = nodes[i];
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const repulsion = 1000 / (distance * distance);
        fx += (dx / distance) * repulsion;
        fy += (dy / distance) * repulsion;
      }
    }
    
    // Attraction from connected edges
    edges.forEach(edge => {
      if (edge.source === node.id || edge.target === node.id) {
        const otherId = edge.source === node.id ? edge.target : edge.source;
        const other = nodes.find(n => n.id === otherId);
        
        if (other) {
          const dx = other.x - node.x;
          const dy = other.y - node.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            const attraction = distance * 0.01;
            fx += (dx / distance) * attraction;
            fy += (dy / distance) * attraction;
          }
        }
      }
    });
    
    return {
      ...node,
      x: node.x + fx * 0.1,
      y: node.y + fy * 0.1
    };
  });
  
  return result;
}

// Main message handler
self.onmessage = function(event: MessageEvent<MessageProcessorInput>) {
  const { type, data, options } = event.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'decompress':
        result = decompress(data);
        break;
        
      case 'process_batch':
        result = processBatch(data, options?.chunkSize || 10);
        break;
        
      case 'parse_large_data':
        result = parseLargeData(data);
        break;
        
      case 'compute_layout':
        result = computeLayout(data.nodes, data.edges);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    // Send final result
    self.postMessage({
      type: 'result',
      data: result
    } as MessageProcessorOutput);
    
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      type: 'error',
      data: null,
      error: error instanceof Error ? error.message : String(error)
    } as MessageProcessorOutput);
  }
};

// Handle global errors
self.onerror = function(error) {
  const errorMessage = error instanceof ErrorEvent && error.message 
    ? error.message 
    : 'Unknown worker error';
  
  self.postMessage({
    type: 'error',
    data: null,
    error: `Worker error: ${errorMessage}`
  } as MessageProcessorOutput);
};

export default null; // Export for TypeScript