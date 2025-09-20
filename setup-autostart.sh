#!/bin/bash
# Setup script for SongNodes automatic startup
# Run this script with sudo privileges

echo "Setting up SongNodes for automatic startup..."

# Copy systemd service file
cp songnodes.service /etc/systemd/system/

# Reload systemd daemon
systemctl daemon-reload

# Enable the service
systemctl enable songnodes.service

# Start the service
systemctl start songnodes.service

# Check status
systemctl status songnodes.service

echo "SongNodes service has been installed and enabled!"
echo "The stack will now start automatically on system boot."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status songnodes    # Check service status"
echo "  sudo systemctl restart songnodes  # Restart the stack"
echo "  sudo systemctl stop songnodes     # Stop the stack"
echo "  sudo systemctl start songnodes    # Start the stack"
echo "  sudo journalctl -u songnodes -f   # View service logs"