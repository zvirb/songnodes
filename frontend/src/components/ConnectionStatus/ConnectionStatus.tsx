/**
 * Real-time Connection Status Indicator
 * Shows WebSocket connection state and quality
 */

import React from 'react';
import { useAppSelector } from '../../store';
import './ConnectionStatus.css';

export interface ConnectionStatusProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
  showDetails?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  position = 'top-right',
  compact = false,
  showDetails = false,
  className = ''
}) => {
  const websocket = useAppSelector(state => state.websocket);

  const getStatusColor = () => {
    if (!websocket.isConnected) return 'status-disconnected';
    if (websocket.isConnecting) return 'status-connecting';

    switch (websocket.connectionQuality) {
      case 'excellent': return 'status-excellent';
      case 'good': return 'status-good';
      case 'poor': return 'status-poor';
      default: return 'status-unknown';
    }
  };

  const getStatusText = () => {
    if (websocket.isConnecting) return 'Connecting...';
    if (!websocket.isConnected) return 'Disconnected';
    if (websocket.isReceivingUpdates) return 'Live';
    return 'Connected';
  };

  const getStatusIcon = () => {
    if (websocket.isConnecting) return '⟳';
    if (!websocket.isConnected) return '⊗';
    if (websocket.isReceivingUpdates) return '●';
    return '○';
  };

  const formatLatency = (latency: number) => {
    return latency > 0 ? `${Math.round(latency)}ms` : '--';
  };

  const formatLastUpdate = (timestamp: string | null) => {
    if (!timestamp) return '--';
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 1000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return 'Long ago';
  };

  if (compact) {
    return (
      <div className={`connection-status-compact ${getStatusColor()} ${className}`}>
        <span className="status-icon" title={getStatusText()}>
          {getStatusIcon()}
        </span>
      </div>
    );
  }

  return (
    <div className={`connection-status connection-status-${position} ${getStatusColor()} ${className}`}>
      <div className="status-header">
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{getStatusText()}</span>
      </div>

      {showDetails && (
        <div className="status-details">
          <div className="detail-row">
            <span className="detail-label">Quality:</span>
            <span className="detail-value">{websocket.connectionQuality}</span>
          </div>

          {websocket.averageLatency > 0 && (
            <div className="detail-row">
              <span className="detail-label">Latency:</span>
              <span className="detail-value">{formatLatency(websocket.averageLatency)}</span>
            </div>
          )}

          <div className="detail-row">
            <span className="detail-label">Messages:</span>
            <span className="detail-value">
              ↑{websocket.messagesSent} ↓{websocket.messagesReceived}
            </span>
          </div>

          {websocket.lastUpdateReceived && (
            <div className="detail-row">
              <span className="detail-label">Last update:</span>
              <span className="detail-value">{formatLastUpdate(websocket.lastUpdateReceived)}</span>
            </div>
          )}

          {websocket.subscriptions.length > 0 && (
            <div className="detail-row">
              <span className="detail-label">Subscriptions:</span>
              <span className="detail-value">{websocket.subscriptions.length}</span>
            </div>
          )}

          {websocket.reconnectAttempts > 0 && (
            <div className="detail-row">
              <span className="detail-label">Reconnects:</span>
              <span className="detail-value">
                {websocket.reconnectAttempts}/{websocket.maxReconnectAttempts}
              </span>
            </div>
          )}

          {websocket.queuedMessages > 0 && (
            <div className="detail-row">
              <span className="detail-label">Queued:</span>
              <span className="detail-value">{websocket.queuedMessages}</span>
            </div>
          )}

          {websocket.connectionError && (
            <div className="detail-row error">
              <span className="detail-label">Error:</span>
              <span className="detail-value">{websocket.connectionError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;