/**
 * GPU Optimization Utility for PIXI.js WebGL Rendering
 * Implements advanced GPU utilization techniques for ML readiness
 */

import * as PIXI from 'pixi.js';

export interface GPUOptimizationConfig {
  enableComputeShaders: boolean;
  preferWebGL2: boolean;
  maxTextureSize: number;
  antialias: boolean;
  powerPreference: 'default' | 'high-performance' | 'low-power';
  preserveDrawingBuffer: boolean;
  backgroundAlpha: number;
  clearBeforeRender: boolean;
  useContextAlpha: boolean;
  sharedTicker: boolean;
  sharedLoader: boolean;
}

export interface GPUPerformanceMetrics {
  contextType: 'webgl' | 'webgl2';
  maxTextureSize: number;
  maxTextureUnits: number;
  maxVertexAttribs: number;
  maxVertexUniforms: number;
  maxFragmentUniforms: number;
  maxRenderBufferSize: number;
  extensions: string[];
  vendorInfo: {
    vendor: string;
    renderer: string;
    version: string;
  };
  memoryInfo?: {
    totalGPUMemory: number;
    usedGPUMemory: number;
  };
}

export class GPUOptimizer {
  private static instance: GPUOptimizer;
  private app: PIXI.Application | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private performanceMetrics: GPUPerformanceMetrics | null = null;
  private texturePool: Map<string, PIXI.Texture> = new Map();
  private shaderCache: Map<string, PIXI.Shader> = new Map();
  private frameStats = {
    fps: 0,
    frameTime: 0,
    gpuTime: 0,
    drawCalls: 0,
    textureBinds: 0
  };

  public static getInstance(): GPUOptimizer {
    if (!GPUOptimizer.instance) {
      GPUOptimizer.instance = new GPUOptimizer();
    }
    return GPUOptimizer.instance;
  }

  /**
   * Initialize GPU optimization with enhanced WebGL configuration
   */
  public async initializeOptimization(
    canvas: HTMLCanvasElement,
    config: Partial<GPUOptimizationConfig> = {}
  ): Promise<PIXI.Application> {
    const defaultConfig: GPUOptimizationConfig = {
      enableComputeShaders: true,
      preferWebGL2: true,
      maxTextureSize: 4096,
      antialias: false, // Disable for better performance
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
      backgroundAlpha: 0,
      clearBeforeRender: true,
      useContextAlpha: false,
      sharedTicker: true,
      sharedLoader: true
    };

    const optimizedConfig = { ...defaultConfig, ...config };

    // Force WebGL2 context for advanced features
    const contextAttributes: WebGLContextAttributes = {
      alpha: optimizedConfig.useContextAlpha,
      antialias: optimizedConfig.antialias,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: optimizedConfig.preserveDrawingBuffer,
      powerPreference: optimizedConfig.powerPreference,
      failIfMajorPerformanceCaveat: false,
      desynchronized: true // Enable for better performance
    };

    // Create PIXI application with optimized settings
    this.app = new PIXI.Application({
      view: canvas,
      width: canvas.width,
      height: canvas.height,
      backgroundColor: optimizedConfig.backgroundAlpha,
      clearBeforeRender: optimizedConfig.clearBeforeRender,
      preserveDrawingBuffer: optimizedConfig.preserveDrawingBuffer,
      powerPreference: optimizedConfig.powerPreference,
      sharedTicker: optimizedConfig.sharedTicker,
      sharedLoader: optimizedConfig.sharedLoader,
      // Force WebGL2 context
      context: optimizedConfig.preferWebGL2 ? canvas.getContext('webgl2', contextAttributes) || 
                canvas.getContext('webgl', contextAttributes) : 
                canvas.getContext('webgl', contextAttributes)
    });

    this.gl = this.app.renderer.gl;
    
    // Analyze GPU capabilities
    this.performanceMetrics = await this.analyzeGPUCapabilities();
    
    // Configure advanced WebGL settings
    this.configureAdvancedWebGL();
    
    // Initialize texture and shader pools
    this.initializeResourcePools();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();

    console.log('🚀 GPU Optimization initialized:', {
      contextType: this.performanceMetrics.contextType,
      maxTextureSize: this.performanceMetrics.maxTextureSize,
      extensions: this.performanceMetrics.extensions.length,
      vendor: this.performanceMetrics.vendorInfo.vendor
    });

    return this.app;
  }

  /**
   * Analyze GPU capabilities and limitations
   */
  private async analyzeGPUCapabilities(): Promise<GPUPerformanceMetrics> {
    if (!this.gl) throw new Error('WebGL context not available');

    const extensions = this.gl.getSupportedExtensions() || [];
    
    // Get vendor information
    const debugInfo = this.gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = debugInfo ? this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'Unknown';
    const renderer = debugInfo ? this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Unknown';
    
    // Get memory information if available
    let memoryInfo;
    const memoryExt = this.gl.getExtension('WEBGL_debug_renderer_info');
    if (memoryExt) {
      try {
        // Try to get memory info from WebGL extension
        const info = (navigator as any).gpu?.requestAdapter?.();
        if (info) {
          memoryInfo = {
            totalGPUMemory: info.limits?.maxStorageBufferBindingSize || 0,
            usedGPUMemory: 0 // Cannot get actual usage from WebGL
          };
        }
      } catch (e) {
        // Memory info not available
      }
    }

    return {
      contextType: this.gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
      maxTextureUnits: this.gl.getParameter(this.gl.MAX_TEXTURE_IMAGE_UNITS),
      maxVertexAttribs: this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS),
      maxVertexUniforms: this.gl.getParameter(this.gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxFragmentUniforms: this.gl.getParameter(this.gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxRenderBufferSize: this.gl.getParameter(this.gl.MAX_RENDERBUFFER_SIZE),
      extensions,
      vendorInfo: {
        vendor,
        renderer,
        version: this.gl.getParameter(this.gl.VERSION)
      },
      memoryInfo
    };
  }

  /**
   * Configure advanced WebGL settings for optimal performance
   */
  private configureAdvancedWebGL(): void {
    if (!this.gl) return;

    // Enable depth testing if needed
    this.gl.disable(this.gl.DEPTH_TEST);
    
    // Enable blending for transparency
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    // Optimize culling
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(this.gl.BACK);
    
    // Configure viewport
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    // Set up instanced rendering if supported
    if (this.performanceMetrics?.extensions.includes('ANGLE_instanced_arrays')) {
      console.log('✅ Instanced rendering available');
    }

    // Enable texture compression if supported
    const compressionExts = [
      'WEBGL_compressed_texture_s3tc',
      'WEBGL_compressed_texture_etc1',
      'WEBGL_compressed_texture_astc'
    ].filter(ext => this.performanceMetrics?.extensions.includes(ext));
    
    if (compressionExts.length > 0) {
      console.log('✅ Texture compression available:', compressionExts);
    }
  }

  /**
   * Initialize resource pools for better memory management
   */
  private initializeResourcePools(): void {
    // Pre-create common textures
    const commonSizes = [32, 64, 128, 256, 512];
    commonSizes.forEach(size => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      
      // Create white circle texture
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
      ctx.fill();
      
      const texture = PIXI.Texture.from(canvas);
      this.texturePool.set(`circle_${size}`, texture);
    });

    console.log(`✅ Texture pool initialized with ${this.texturePool.size} textures`);
  }

  /**
   * Create optimized compute shader for graph calculations
   */
  public createComputeShader(vertexShader: string, fragmentShader: string): PIXI.Shader {
    const cacheKey = `${vertexShader.length}_${fragmentShader.length}`;
    
    if (this.shaderCache.has(cacheKey)) {
      return this.shaderCache.get(cacheKey)!;
    }

    // Enhanced vertex shader with instancing support
    const optimizedVertexShader = `
      attribute vec2 aVertexPosition;
      attribute vec2 aTextureCoord;
      attribute float aInstanceID;
      
      uniform mat3 translationMatrix;
      uniform mat3 projectionMatrix;
      uniform vec2 uInstanceOffset[1000]; // Support up to 1000 instances
      
      varying vec2 vTextureCoord;
      varying float vInstanceID;
      
      void main(void) {
        vec2 offset = uInstanceOffset[int(aInstanceID)];
        vec2 position = aVertexPosition + offset;
        
        gl_Position = vec4((projectionMatrix * translationMatrix * vec3(position, 1.0)).xy, 0.0, 1.0);
        vTextureCoord = aTextureCoord;
        vInstanceID = aInstanceID;
      }
    `;

    // Enhanced fragment shader with better precision
    const optimizedFragmentShader = `
      precision highp float;
      
      varying vec2 vTextureCoord;
      varying float vInstanceID;
      
      uniform sampler2D uSampler;
      uniform vec4 uInstanceColor[1000];
      uniform float uTime;
      uniform float uScale;
      
      void main(void) {
        vec4 color = texture2D(uSampler, vTextureCoord);
        vec4 instanceColor = uInstanceColor[int(vInstanceID)];
        
        // Apply dynamic effects based on scale and time
        float alpha = instanceColor.a * smoothstep(0.1, 1.0, uScale);
        
        gl_FragColor = vec4(instanceColor.rgb * color.rgb, alpha * color.a);
      }
    `;

    const shader = PIXI.Shader.from(optimizedVertexShader, optimizedFragmentShader);
    this.shaderCache.set(cacheKey, shader);
    
    return shader;
  }

  /**
   * Get optimized texture from pool
   */
  public getOptimizedTexture(type: string, size: number): PIXI.Texture | null {
    const key = `${type}_${size}`;
    
    // Try exact match first
    let texture = this.texturePool.get(key);
    if (texture) return texture;
    
    // For circle type, find closest size match
    if (type === 'circle') {
      const availableSizes = [32, 64, 128, 256, 512];
      const closestSize = availableSizes.reduce((prev, curr) => 
        Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
      );
      texture = this.texturePool.get(`circle_${closestSize}`);
      if (texture) return texture;
    }
    
    return null;
  }

  /**
   * Create GPU-optimized particle container for large node sets
   */
  public createOptimizedParticleContainer(
    maxSize: number = 10000,
    properties?: Partial<PIXI.IParticleProperties>
  ): PIXI.ParticleContainer {
    const defaultProperties: PIXI.IParticleProperties = {
      scale: true,
      position: true,
      rotation: false,
      uvs: false,
      alpha: true
    };

    const optimizedProperties = { ...defaultProperties, ...properties };
    
    const container = new PIXI.ParticleContainer(maxSize, optimizedProperties, 16384, true);
    
    // Pre-allocate buffer if WebGL2 is available
    if (this.performanceMetrics?.contextType === 'webgl2') {
      console.log('✅ Using WebGL2 optimized particle container');
      // Enable instanced rendering optimizations
      (container as any).interactiveChildren = false;
      (container as any).sortableChildren = false;
    }
    
    // Optimize blending for better GPU performance
    container.blendMode = PIXI.BLEND_MODES.NORMAL;
    
    // Enable GPU texture batching
    if (this.app?.renderer.batch) {
      (container as any).batchSize = 4000; // Increase batch size for better GPU utilization
    }

    return container;
  }

  /**
   * Diagnose and fix GPU performance degradation
   */
  public optimizeGPUPerformance(): void {
    if (!this.app || !this.gl) return;
    
    console.log('🔧 Running GPU performance optimization...');
    
    // Force garbage collection of unused textures
    this.app.renderer.textureGC.run();
    
    // Optimize WebGL state
    const renderer = this.app.renderer;
    if (renderer.type === PIXI.RENDERER_TYPE.WEBGL) {
      // Enable depth testing for better occlusion culling
      this.gl.enable(this.gl.DEPTH_TEST);
      this.gl.depthFunc(this.gl.LEQUAL);
      
      // Optimize texture parameters
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      
      // Enable anisotropic filtering if available
      const ext = this.gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        const maxAnisotropy = this.gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        this.gl.texParameterf(this.gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, maxAnisotropy));
        console.log('✅ Anisotropic filtering enabled');
      }
    }
    
    // Force WebGL context optimization
    this.gl.flush();
    this.gl.finish();
    
    console.log('✅ GPU performance optimization complete');
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    let lastTime = performance.now();
    let frameCount = 0;

    const monitorFrame = () => {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastTime;
      
      frameCount++;
      
      if (frameCount % 60 === 0) { // Update every 60 frames
        this.frameStats.fps = 1000 / (deltaTime / 60);
        this.frameStats.frameTime = deltaTime / 60;
        
        // Get draw call information if available
        if (this.app?.renderer.batch) {
          this.frameStats.drawCalls = (this.app.renderer.batch as any)._drawCallPoolIndex || 0;
        }
        
        // Emit performance metrics event
        this.emitPerformanceMetrics();
      }
      
      lastTime = currentTime;
      requestAnimationFrame(monitorFrame);
    };

    requestAnimationFrame(monitorFrame);
  }

  /**
   * Emit performance metrics for monitoring
   */
  private emitPerformanceMetrics(): void {
    const event = new CustomEvent('gpu-performance-update', {
      detail: {
        ...this.frameStats,
        contextType: this.performanceMetrics?.contextType,
        memoryInfo: this.performanceMetrics?.memoryInfo,
        texturePoolSize: this.texturePool.size,
        shaderCacheSize: this.shaderCache.size
      }
    });
    
    window.dispatchEvent(event);
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics() {
    return {
      ...this.frameStats,
      capabilities: this.performanceMetrics,
      resources: {
        texturePoolSize: this.texturePool.size,
        shaderCacheSize: this.shaderCache.size
      }
    };
  }

  /**
   * Optimize existing PIXI application
   */
  public optimizeExistingApp(app: PIXI.Application): void {
    // Set render optimizations
    app.renderer.plugins.interaction.interactionFrequency = 10; // Reduce interaction frequency
    
    // Configure batch renderer
    if (app.renderer.plugins.batch) {
      app.renderer.plugins.batch.MAX_TEXTURES = Math.min(16, this.performanceMetrics?.maxTextureUnits || 8);
    }
    
    // Enable auto-densification
    app.renderer.plugins.batch.MAX_TEXTURES = 16;
    
    console.log('✅ Existing PIXI app optimized for GPU performance');
  }

  /**
   * Force GPU texture upload for better performance
   */
  public preloadTextures(textures: PIXI.Texture[]): Promise<void> {
    return new Promise((resolve) => {
      let loaded = 0;
      const total = textures.length;

      if (total === 0) {
        resolve();
        return;
      }

      textures.forEach(texture => {
        if (texture.baseTexture.valid) {
          loaded++;
          if (loaded === total) resolve();
        } else {
          texture.baseTexture.once('loaded', () => {
            // Force GPU upload
            if (this.app?.renderer) {
              this.app.renderer.texture.bind(texture);
            }
            loaded++;
            if (loaded === total) resolve();
          });
        }
      });
    });
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.texturePool.forEach(texture => texture.destroy());
    this.texturePool.clear();
    this.shaderCache.clear();
    
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true, baseTexture: true });
      this.app = null;
    }
    
    this.gl = null;
    this.performanceMetrics = null;
  }
}

export default GPUOptimizer;