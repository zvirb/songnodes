# Local Network Access for SongNodes

This guide explains how to access SongNodes from any device on your local network using the friendly hostname `songnodes.local`.

## Current Access Methods

### 1. Direct Access (Always Works)
- **Local machine**: http://localhost:8088
- **Network access**: http://YOUR_IP:8088 (e.g., http://192.168.1.51:8088)

### 2. Using songnodes.local Hostname

#### Option A: With Port Number (Simplest)
Access the application at: **http://songnodes.local:8088**

This works after running:
```bash
sudo ./setup-local-access.sh
```

#### Option B: Without Port Number (Advanced)
To access at **http://songnodes.local** (no port), you have three options:

**Option 1: Stop conflicting services**
```bash
# If k3s is running and using port 80:
sudo systemctl stop k3s
# Then start our reverse proxy:
docker compose -f docker-compose.local-proxy.yml up -d
```

**Option 2: Use alternative port**
```bash
# Start proxy on port 8000:
docker compose -f docker-compose.local-proxy.yml up -d
# Access at: http://songnodes.local:8000
```

**Option 3: Configure k3s ingress** (if using k3s)
Create a k3s ingress rule to route songnodes.local to the application.

## Files Included

- `songnodes.service` - Avahi mDNS service definition
- `nginx-local-proxy.conf` - Nginx reverse proxy configuration
- `docker-compose.local-proxy.yml` - Docker compose for local proxy
- `setup-local-access.sh` - Quick setup script
- `LOCAL_ACCESS.md` - This documentation

## Troubleshooting

### Port 80 Already in Use
If you see "address already in use" errors:
1. Check what's using port 80: `sudo ss -tlnp | grep :80`
2. Common culprits: k3s, apache2, nginx, traefik
3. Either stop the conflicting service or use a different port

### DNS Not Resolving
If `songnodes.local` doesn't resolve:
1. Ensure Avahi is running: `sudo systemctl status avahi-daemon`
2. Check /etc/hosts: `grep songnodes /etc/hosts`
3. Try the IP address directly: http://192.168.1.51:8088

### From Other Devices
For access from phones/tablets on the same network:
1. Use the IP address: http://192.168.1.51:8088
2. Or install mDNS support on the device (Bonjour for iOS, already included on Android)

## Security Note
This setup is intended for local development and trusted networks only. For production deployments, use proper domain names, SSL certificates, and security configurations.