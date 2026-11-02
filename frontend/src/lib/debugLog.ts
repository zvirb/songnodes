/**
 * Debug logging for development only. In a production build `import.meta.env.DEV` is false,
 * so these calls log nothing (warnings and errors still use console.warn / console.error).
 */
export const debugLog: (...args: unknown[]) => void = import.meta.env.DEV
  ? (...args) => console.log(...args)
  : () => {};
