import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// import { initPixiDeprecationFilter } from './utils/pixiDeprecationFilter'
// import { globalPerformanceValidator } from './utils/performanceValidation'

// Initialize PIXI deprecation warning filter for production readiness
// initPixiDeprecationFilter()

// Initialize performance monitoring in development
// if (process.env.NODE_ENV === 'development') {
//   // Add performance testing to window for manual testing
//   (window as any).testPerformance = async () => {
//     const result = await globalPerformanceValidator.validatePerformanceOptimizations();
//     console.table(result);
//     return result;
//   };

//   // Log that performance testing is available
//   console.log('🚀 Performance testing available: run window.testPerformance() in console');
// }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)