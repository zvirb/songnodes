#!/usr/bin/env node

/**
 * Enhanced Visualization Service Build Script
 * Optimized production build with static asset processing
 */

import { existsSync, mkdirSync, cpSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const distDir = resolve(projectRoot, 'dist');
const publicDir = resolve(projectRoot, 'public');

async function build() {
  console.log('🚀 Starting Enhanced Visualization Service build...');
  
  try {
    // Ensure dist directory exists
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
      console.log('✅ Created dist directory');
    }
    
    // Copy public assets if they exist
    if (existsSync(publicDir)) {
      const assetsDir = resolve(distDir, 'public');
      cpSync(publicDir, assetsDir, { recursive: true });
      console.log('✅ Copied public assets');
    }
    
    console.log('✅ Build completed successfully!');
    console.log(`📦 Output directory: ${distDir}`);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

// Run build if this script is executed directly
if (process.argv[1] === __filename) {
  build();
}

export default build;