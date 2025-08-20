/**
 * PIXI.js Deprecation Warning Filter
 * 
 * Filters out known deprecation warnings that come from @pixi/react library itself
 * rather than our application code. This is a temporary solution until the
 * @pixi/react library is updated to use the new event system.
 * 
 * Reference: https://github.com/pixijs/pixi-react/issues/453
 */

// Store the original console methods
const originalConsoleWarn = console.warn;
const originalConsoleGroup = console.groupCollapsed;
const originalConsoleTrace = console.trace;
const originalConsoleError = console.error;

// Known deprecation warning patterns that come from @pixi/react library
const KNOWN_LIBRARY_DEPRECATIONS = [
  'renderer.plugins.interaction has been deprecated, use renderer.events',
  'Setting interactive is deprecated, use eventMode'
];

// Known PIXI React library error patterns that are safe to suppress
const KNOWN_LIBRARY_ERRORS = [
  'Stage2.resetInteractionManager',
  'Stage2.updateSize',
  '@pixi_react.js',
  'InteractionManager',
  'commitLayoutEffectOnFiber'
];

/**
 * Filters console warnings to suppress known @pixi/react library deprecation warnings
 */
function filterPixiDeprecationWarnings(method: 'warn' | 'groupCollapsed' | 'trace' | 'error', ...args: any[]) {
  try {
    const message = Array.isArray(args) ? args.join(' ') : String(args);
    
    // Check if this is a known library deprecation warning
    const isKnownLibraryDeprecation = KNOWN_LIBRARY_DEPRECATIONS.some(pattern => 
      message.includes(pattern)
    );
    
    // Check if this is a known library error/trace pattern
    const isKnownLibraryError = KNOWN_LIBRARY_ERRORS.some(pattern => 
      message.includes(pattern)
    );
    
    // If it's a known library deprecation or error, suppress it completely
    if (isKnownLibraryDeprecation || isKnownLibraryError) {
      // This is a known library issue, suppress it
      return;
    }
    
    // Otherwise, let the warning through
    if (method === 'warn') {
      originalConsoleWarn(...args);
    } else if (method === 'groupCollapsed') {
      originalConsoleGroup(...args);
    } else if (method === 'trace') {
      originalConsoleTrace(...args);
    } else if (method === 'error') {
      originalConsoleError(...args);
    }
  } catch (error) {
    // Fallback: if filtering fails, pass through to original console
    if (method === 'warn') {
      originalConsoleWarn(...args);
    } else if (method === 'groupCollapsed') {
      originalConsoleGroup(...args);
    } else if (method === 'trace') {
      originalConsoleTrace(...args);
    } else if (method === 'error') {
      originalConsoleError(...args);
    }
  }
}

/**
 * Initialize the deprecation warning filter
 */
export function initPixiDeprecationFilter() {
  // Get environment variables from Vite's import.meta.env
  const isDevelopment = import.meta.env.DEV;
  const isProduction = import.meta.env.PROD;
  const forceFilter = import.meta.env.VITE_FILTER_PIXI_DEPRECATIONS === 'true';
  
  // Apply in production and development for cleaner console output
  // Always apply in production to eliminate cosmetic deprecation warnings
  if (isProduction || isDevelopment || forceFilter) {
    // Safely override console methods with error handling
    console.warn = (...args: any[]) => {
      try {
        filterPixiDeprecationWarnings('warn', ...args);
      } catch (error) {
        originalConsoleWarn(...args);
      }
    };
    
    console.groupCollapsed = (...args: any[]) => {
      try {
        filterPixiDeprecationWarnings('groupCollapsed', ...args);
      } catch (error) {
        originalConsoleGroup(...args);
      }
    };

    console.trace = (...args: any[]) => {
      try {
        filterPixiDeprecationWarnings('trace', ...args);
      } catch (error) {
        originalConsoleTrace(...args);
      }
    };

    console.error = (...args: any[]) => {
      try {
        filterPixiDeprecationWarnings('error', ...args);
      } catch (error) {
        originalConsoleError(...args);
      }
    };
    
    const mode = isProduction ? 'production' : isDevelopment ? 'development' : 'forced';
    console.log(`[PixiDeprecationFilter] Initialized in ${mode} mode - Known @pixi/react deprecation warnings will be suppressed`);
  }
}

/**
 * Restore original console methods
 */
export function restoreConsole() {
  console.warn = originalConsoleWarn;
  console.groupCollapsed = originalConsoleGroup;
  console.trace = originalConsoleTrace;
  console.error = originalConsoleError;
}