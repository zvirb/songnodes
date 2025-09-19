#!/usr/bin/env node

const http = require('http');

async function checkReactMount() {
  console.log('🔍 Checking React mounting status...');

  try {
    // First, get the HTML
    const response = await new Promise((resolve, reject) => {
      const req = http.request('http://localhost:3009', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.end();
    });

    if (response.status !== 200) {
      console.log('❌ Server not responding:', response.status);
      return;
    }

    const html = response.data;

    // Check for key indicators
    const hasErrorOverlay = html.includes('Application Error');
    const hasLoadingSpinner = html.includes('loading-spinner');
    const hasReactRoot = html.includes('id="root"');
    const hasViteScript = html.includes('/src/main.tsx');

    console.log('📊 HTML Analysis:');
    console.log(`  - React root element: ${hasReactRoot ? '✅' : '❌'}`);
    console.log(`  - Vite script loaded: ${hasViteScript ? '✅' : '❌'}`);
    console.log(`  - Loading spinner: ${hasLoadingSpinner ? '⏳' : '✅'}`);
    console.log(`  - Error overlay: ${hasErrorOverlay ? '❌' : '✅'}`);

    // Check TypeScript compilation
    console.log('\n🔍 Checking TypeScript compilation...');
    const { exec } = require('child_process');

    exec('cd /mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend && npm run type-check 2>&1',
      (error, stdout, stderr) => {
        if (error) {
          console.log('❌ TypeScript compilation has errors');
          const lines = stdout.split('\n');
          const errorLines = lines.filter(line => line.includes('error TS'));
          console.log(`Found ${errorLines.length} TypeScript errors`);

          // Show first few critical errors
          errorLines.slice(0, 5).forEach(line => {
            console.log(`  - ${line.trim()}`);
          });

          if (errorLines.length > 5) {
            console.log(`  ... and ${errorLines.length - 5} more errors`);
          }
        } else {
          console.log('✅ TypeScript compilation successful');
        }

        // Check dev server status
        console.log('\n🔍 Checking dev server...');
        exec('cd /mnt/7ac3bfed-9d8e-4829-b134-b5e98ff7c013/programming/songnodes/frontend && npm run build 2>&1',
          (buildError, buildStdout, buildStderr) => {
            if (buildError) {
              console.log('❌ Build failed - React app cannot mount');
              console.log('Build errors:');
              const buildLines = buildStdout.split('\n');
              const buildErrorLines = buildLines.filter(line =>
                line.includes('error') || line.includes('Error') || line.includes('Failed')
              );
              buildErrorLines.slice(0, 3).forEach(line => {
                console.log(`  - ${line.trim()}`);
              });
            } else {
              console.log('✅ Build successful - React should be able to mount');
            }

            // Final recommendation
            console.log('\n🎯 Diagnosis:');
            if (hasErrorOverlay) {
              console.log('❌ Application showing error overlay - fix TypeScript/JavaScript errors');
            } else if (hasLoadingSpinner) {
              console.log('⏳ Application stuck on loading - check build process and dependencies');
            } else {
              console.log('✅ Application appears to be loading correctly');
            }
          }
        );
      }
    );

  } catch (error) {
    console.log('❌ Failed to check React mount:', error.message);
  }
}

checkReactMount();