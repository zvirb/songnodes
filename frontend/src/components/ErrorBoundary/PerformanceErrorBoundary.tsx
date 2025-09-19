/**
 * Performance Error Boundary
 * Catches performance-related crashes and provides fallback rendering
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

export class PerformanceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging
    console.error('Performance Error Boundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Automatically retry up to 3 times for certain recoverable errors
    if (this.isRecoverableError(error) && this.state.retryCount < 3) {
      setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prevState.retryCount + 1
        }));
      }, 2000); // Wait 2 seconds before retry
    }
  }

  private isRecoverableError(error: Error): boolean {
    const recoverablePatterns = [
      /Cannot read properties of undefined/,
      /Cannot read property.*of undefined/,
      /Failed to execute.*on.*Canvas/,
      /WebGL context lost/,
      /PIXI\.js.*not initialized/,
      /GPU optimization failed/
    ];

    return recoverablePatterns.some(pattern => pattern.test(error.message));
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  private handleReset = () => {
    // Clear any stored state and reload
    if (typeof window !== 'undefined') {
      localStorage.removeItem('graph-viewport');
      localStorage.removeItem('performance-settings');
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div style={{
          padding: '20px',
          background: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          margin: '20px',
          textAlign: 'center' as const
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '16px' }}>
            Performance Component Error
          </h2>

          <p style={{ marginBottom: '16px', color: '#6c757d' }}>
            The visualization component encountered an error and couldn't render properly.
          </p>

          {this.state.error && (
            <details style={{ marginBottom: '16px', textAlign: 'left' as const }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Error Details
              </summary>
              <pre style={{
                background: '#f8f9fa',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto',
                marginTop: '8px'
              }}>
                {this.state.error.message}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            <button
              onClick={this.handleRetry}
              style={{
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer'
              }}
            >
              Try Again
            </button>

            <button
              onClick={this.handleReset}
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer'
              }}
            >
              Reset & Reload
            </button>
          </div>

          <div style={{ marginTop: '16px', fontSize: '12px', color: '#6c757d' }}>
            Retry count: {this.state.retryCount}/3
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default PerformanceErrorBoundary;