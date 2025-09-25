import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Disable right-click context menu for cleaner UX
document.addEventListener('contextmenu', (e) => {
  if (e.target instanceof HTMLCanvasElement) {
    e.preventDefault();
  }
});

// Prevent zoom on mobile double-tap
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) {
    e.preventDefault();
  }
  lastTouchEnd = now;
}, { passive: false });

// Performance monitoring
const startTime = performance.now();

// Hide loading screen once React app is ready
function hideLoadingScreen() {
  const loader = document.getElementById('loading');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => {
      loader.style.display = 'none';
    }, 300);
  }

  // Log performance metrics
  const endTime = performance.now();
  console.log(`🎵 SongNodes DJ Interface loaded in ${Math.round(endTime - startTime)}ms`);
}

// Mount the app
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hide loading screen after initial render
setTimeout(hideLoadingScreen, 100);

// Performance monitoring (basic timing)
if (process.env.NODE_ENV === 'development') {
  // Simple performance logging without web-vitals
  console.log('🎵 SongNodes DJ Interface - Development mode enabled');
}