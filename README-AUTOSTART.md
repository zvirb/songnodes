# SongNodes Automatic Startup Configuration

This guide explains how to configure SongNodes to automatically start on system boot and restart on failures.

## Quick Setup

1. **Run the setup script** (requires sudo privileges):
   ```bash
   sudo ./setup-autostart.sh
   ```

2. **Verify the service is running**:
   ```bash
   sudo systemctl status songnodes
   ```

## Manual Setup

If you prefer to set up manually:

1. **Copy the systemd service file**:
   ```bash
   sudo cp songnodes.service /etc/systemd/system/
   ```

2. **Reload systemd and enable the service**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable songnodes.service
   sudo systemctl start songnodes.service
   ```

## Service Management Commands

- **Check status**: `sudo systemctl status songnodes`
- **Start stack**: `sudo systemctl start songnodes`
- **Stop stack**: `sudo systemctl stop songnodes`
- **Restart stack**: `sudo systemctl restart songnodes`
- **View logs**: `sudo journalctl -u songnodes -f`
- **Disable autostart**: `sudo systemctl disable songnodes`

## Restart Policies

The setup includes multiple layers of restart protection:

### 1. Docker Container Level
- All containers use `restart: always` policy
- Containers automatically restart if they crash
- Containers restart on Docker daemon restart

### 2. Systemd Service Level
- Service restarts on failure (`Restart=on-failure`)
- 10-second delay between restart attempts (`RestartSec=10`)
- Automatic startup on system boot

### 3. Health Monitoring
- Health checks monitor service status
- Unhealthy containers are automatically restarted
- Prometheus metrics track service health

## Configuration Files

- `songnodes.service` - Main systemd service definition
- `docker-compose.production.yml` - Production restart policies
- `setup-autostart.sh` - Automated setup script

## Troubleshooting

### Service won't start
```bash
# Check service logs
sudo journalctl -u songnodes -n 50

# Check Docker daemon status
sudo systemctl status docker

# Verify file permissions
ls -la songnodes.service
```

### Containers not restarting
```bash
# Check container restart policies
docker compose ps

# View Docker daemon logs
sudo journalctl -u docker -n 50

# Manually test restart
docker compose restart nlp-processor
```

### Port conflicts
```bash
# Check port usage
ss -tlnp | grep :8082

# Stop conflicting services
sudo systemctl stop conflicting-service
```

## Testing Restart Behavior

1. **Test container restart**:
   ```bash
   # Kill a container
   docker kill nlp-processor

   # Verify it restarts automatically
   docker compose ps nlp-processor
   ```

2. **Test system service restart**:
   ```bash
   # Stop the service
   sudo systemctl stop songnodes

   # Verify it starts automatically on boot
   sudo systemctl start songnodes
   ```

3. **Test full system restart**:
   ```bash
   sudo reboot
   # After reboot, check if services are running
   sudo systemctl status songnodes
   ```

## Service Status

Once configured, you can check the complete stack status:
```bash
# System service status
sudo systemctl status songnodes

# Docker containers status
docker compose ps

# Health check endpoints
curl http://localhost:8080/health  # API Gateway
curl http://localhost:8021/health  # NLP Processor
```

The SongNodes platform will now automatically:
- Start on system boot
- Restart failed containers
- Recover from system failures
- Maintain service availability