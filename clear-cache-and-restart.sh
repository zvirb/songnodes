#!/bin/bash

echo "🧹 Clearing all caches and restarting frontend..."

# Stop the frontend container
echo "Stopping frontend container..."
docker compose stop frontend

# Remove any cached files in the container
echo "Removing container to clear caches..."
docker compose rm -f frontend

# Clear Vite cache on host
echo "Clearing Vite cache..."
cd frontend
rm -rf node_modules/.vite
rm -rf .parcel-cache
rm -rf dist

# Clear any service worker registrations
echo "Creating cache-bust index.html..."
cat > public/cache-bust.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
<script>
// Unregister all service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('Unregistered service worker:', registration);
    }
  });
}
// Clear all caches
if ('caches' in window) {
  caches.keys().then(function(names) {
    for (let name of names) {
      caches.delete(name);
      console.log('Deleted cache:', name);
    }
  });
}
// Clear local storage
localStorage.clear();
sessionStorage.clear();
console.log('Cleared all storage');

// Redirect to main page after clearing
setTimeout(() => {
  window.location.href = '/';
}, 1000);
</script>
</head>
<body>
<h1>Clearing all caches...</h1>
</body>
</html>
EOF

cd ..

# Rebuild and start the frontend
echo "Rebuilding frontend..."
docker compose build frontend --no-cache

echo "Starting fresh frontend..."
docker compose up -d frontend

# Wait for it to start
sleep 5

echo "✅ Frontend restarted with all caches cleared!"
echo "📝 To fully clear browser cache:"
echo "   1. Visit http://localhost:3006/cache-bust.html"
echo "   2. Then hard refresh with Ctrl+Shift+R"
echo "   3. The app will automatically redirect to the main page"