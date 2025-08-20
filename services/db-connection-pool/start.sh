#!/bin/bash

# Database Connection Pool Service Startup Script
set -e

echo "Starting Database Connection Pool Manager..."

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be available..."
until pg_isready -h ${POSTGRES_HOST:-postgres} -p ${POSTGRES_PORT:-5432} -U ${POSTGRES_USER:-musicdb_user}; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

echo "PostgreSQL is ready!"

# Always regenerate PgBouncer userlist with current environment variables
echo "Generating PgBouncer userlist with environment variables..."

# Remove existing userlist to force regeneration
rm -f /etc/pgbouncer/userlist.txt

# Create userlist with environment credentials
cat > /etc/pgbouncer/userlist.txt << EOF
"${POSTGRES_USER:-musicdb_user}" "${POSTGRES_PASSWORD:-musicdb_secure_pass}"
"${PGBOUNCER_ADMIN_USER:-pgbouncer}" "${PGBOUNCER_ADMIN_PASSWORD:-pgbouncer}"
EOF

chown pgbouncer:pgbouncer /etc/pgbouncer/userlist.txt
chmod 600 /etc/pgbouncer/userlist.txt

echo "Generated userlist.txt with passwords from environment"

# Update PgBouncer configuration with environment variables
echo "Configuring PgBouncer..."
sed -i "s/host=postgres/host=${POSTGRES_HOST:-postgres}/g" /etc/pgbouncer/pgbouncer.ini
sed -i "s/port=5432/port=${POSTGRES_PORT:-5432}/g" /etc/pgbouncer/pgbouncer.ini
sed -i "s/user=musicdb_user/user=${POSTGRES_USER:-musicdb_user}/g" /etc/pgbouncer/pgbouncer.ini
sed -i "s/dbname=musicdb/dbname=${POSTGRES_DB:-musicdb}/g" /etc/pgbouncer/pgbouncer.ini

# Start PgBouncer in background
echo "Starting PgBouncer..."
su pgbouncer -s /bin/bash -c "pgbouncer -d /etc/pgbouncer/pgbouncer.ini"

# Wait for PgBouncer to start
sleep 3

# Verify PgBouncer is running
if ! pgrep pgbouncer > /dev/null; then
    echo "ERROR: PgBouncer failed to start"
    exit 1
fi

echo "PgBouncer started successfully"

# Start the Python monitoring service
echo "Starting Connection Pool Manager API..."
exec python main.py