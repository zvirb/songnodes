import React, { useState } from 'react';
import { Button, Alert, Box, Typography, CircularProgress } from '@mui/material';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

export const ServiceControl: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  const handleShutdown = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to shut down all SongNodes services?\n\n' +
      'This will stop all Docker containers to free up system resources.\n' +
      'You can restart them later by running: docker compose up -d'
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/services/shutdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Services are shutting down. The application will stop responding shortly.'
        });

        // Show instructions after a delay
        setTimeout(() => {
          setMessage({
            type: 'info',
            text: 'Services have been stopped. To restart, run: docker compose up -d'
          });
        }, 3000);
      } else {
        throw new Error('Failed to shutdown services');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to shutdown services. You can manually run: docker compose down'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to restart all SongNodes services?\n\n' +
      'This will restart all Docker containers.'
    );

    if (!confirmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/services/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Services are restarting. Please wait a moment...'
        });
      } else {
        throw new Error('Failed to restart services');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to restart services. You can manually run: docker compose restart'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Service Control
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage Docker containers to control system resource usage
      </Typography>

      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button
          variant="contained"
          color="error"
          startIcon={loading ? <CircularProgress size={20} /> : <PowerSettingsNewIcon />}
          onClick={handleShutdown}
          disabled={loading}
          fullWidth
        >
          Shutdown All Services
        </Button>

        <Button
          variant="contained"
          color="warning"
          startIcon={loading ? <CircularProgress size={20} /> : <RestartAltIcon />}
          onClick={handleRestart}
          disabled={loading}
          fullWidth
        >
          Restart All Services
        </Button>
      </Box>

      <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
        Note: After shutdown, run 'docker compose up -d' in terminal to restart
      </Typography>
    </Box>
  );
};