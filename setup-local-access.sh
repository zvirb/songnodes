#!/bin/bash

# Script to set up local network access for SongNodes
# This creates an iptables rule to forward port 80 to 8088 for songnodes.local

echo "Setting up SongNodes local network access..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run with sudo: sudo ./setup-local-access.sh"
    exit 1
fi

# Add entry to /etc/hosts if not exists
if ! grep -q "songnodes.local" /etc/hosts; then
    echo "127.0.0.1 songnodes.local" >> /etc/hosts
    echo "✓ Added songnodes.local to /etc/hosts"
else
    echo "✓ songnodes.local already in /etc/hosts"
fi

# Create iptables rule for port forwarding (only for songnodes.local)
# Note: This is a simple solution. For production, use nginx reverse proxy

echo "Creating port forwarding rule..."
# Remove any existing rules first
iptables -t nat -D OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port 8088 2>/dev/null

# Add new rule
iptables -t nat -A OUTPUT -p tcp -d 127.0.0.1 --dport 80 -j REDIRECT --to-port 8088

# Save iptables rules
if command -v iptables-save &> /dev/null; then
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "SongNodes is now accessible at:"
echo "  - http://songnodes.local:8088 (with port)"
echo "  - http://localhost:8088"
echo ""
echo "Note: For access without port number (http://songnodes.local),"
echo "you need to stop any services using port 80 (like k3s/traefik)"
echo "or use the included nginx reverse proxy on a different port."