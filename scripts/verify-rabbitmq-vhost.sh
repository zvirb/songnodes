#!/bin/bash
# verify-rabbitmq-vhost.sh
# Verifies that the RabbitMQ musicdb vhost lifecycle hook is working correctly

set -e

NAMESPACE="songnodes"
POD_NAME="rabbitmq-0"

echo "========================================="
echo "RabbitMQ musicdb Vhost Verification"
echo "========================================="
echo ""

# 1. Check pod status
echo "1. Checking RabbitMQ pod status..."
if ! kubectl get pod "$POD_NAME" -n "$NAMESPACE" &>/dev/null; then
    echo "❌ ERROR: Pod $POD_NAME not found in namespace $NAMESPACE"
    exit 1
fi

POD_STATUS=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.phase}')
if [ "$POD_STATUS" != "Running" ]; then
    echo "❌ ERROR: Pod is not running. Current status: $POD_STATUS"
    exit 1
fi

POD_READY=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')
if [ "$POD_READY" != "True" ]; then
    echo "❌ ERROR: Pod is not ready"
    exit 1
fi

echo "✅ Pod is running and ready"
echo ""

# 2. Check lifecycle hook exists in StatefulSet
echo "2. Verifying lifecycle hook in StatefulSet..."
LIFECYCLE=$(kubectl get statefulset rabbitmq -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].lifecycle.postStart.exec.command}')
if [ -z "$LIFECYCLE" ]; then
    echo "❌ ERROR: Lifecycle hook not found in StatefulSet"
    exit 1
fi

if echo "$LIFECYCLE" | grep -q "add_vhost musicdb"; then
    echo "✅ Lifecycle hook configured correctly"
else
    echo "❌ ERROR: Lifecycle hook does not contain 'add_vhost musicdb'"
    exit 1
fi
echo ""

# 3. List all vhosts
echo "3. Listing RabbitMQ vhosts..."
VHOSTS=$(kubectl exec -n "$NAMESPACE" "$POD_NAME" -- rabbitmqctl list_vhosts 2>/dev/null)
echo "$VHOSTS"
echo ""

if echo "$VHOSTS" | grep -q "musicdb"; then
    echo "✅ musicdb vhost exists"
else
    echo "❌ ERROR: musicdb vhost not found"
    exit 1
fi
echo ""

# 4. Check permissions
echo "4. Checking permissions for songnodesuser on musicdb vhost..."
PERMISSIONS=$(kubectl exec -n "$NAMESPACE" "$POD_NAME" -- rabbitmqctl list_permissions -p musicdb 2>/dev/null)
echo "$PERMISSIONS"
echo ""

if echo "$PERMISSIONS" | grep -q "songnodesuser"; then
    echo "✅ songnodesuser has permissions on musicdb vhost"
else
    echo "❌ ERROR: songnodesuser permissions not found on musicdb vhost"
    exit 1
fi
echo ""

# 5. Test persistence by restarting pod
echo "5. Testing vhost persistence across pod restart..."
echo "   Deleting pod $POD_NAME..."
kubectl delete pod "$POD_NAME" -n "$NAMESPACE" --wait=false

echo "   Waiting for pod to restart..."
sleep 5

# Wait for pod to be running again (up to 2 minutes)
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    POD_STATUS=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.phase}' 2>/dev/null || echo "NotFound")
    POD_READY=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")

    if [ "$POD_STATUS" = "Running" ] && [ "$POD_READY" = "True" ]; then
        echo "✅ Pod restarted successfully"
        break
    fi

    echo "   Pod status: $POD_STATUS, Ready: $POD_READY (waiting...)"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "❌ ERROR: Pod did not become ready within $TIMEOUT seconds"
    exit 1
fi
echo ""

# 6. Verify vhost still exists after restart
echo "6. Verifying vhost exists after pod restart..."
sleep 10  # Give postStart hook time to run

VHOSTS_AFTER=$(kubectl exec -n "$NAMESPACE" "$POD_NAME" -- rabbitmqctl list_vhosts 2>/dev/null)
if echo "$VHOSTS_AFTER" | grep -q "musicdb"; then
    echo "✅ musicdb vhost persisted across restart"
else
    echo "❌ ERROR: musicdb vhost not found after restart"
    exit 1
fi
echo ""

# 7. Test WebSocket API connection
echo "7. Testing WebSocket API RabbitMQ connection..."
WS_POD=$(kubectl get pod -n "$NAMESPACE" -l app=websocket-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
if [ -z "$WS_POD" ]; then
    echo "⚠️  WARNING: websocket-api pod not found, skipping connection test"
else
    echo "   Checking websocket-api logs for RabbitMQ errors..."
    WS_LOGS=$(kubectl logs -n "$NAMESPACE" "$WS_POD" --tail=100 2>/dev/null)

    if echo "$WS_LOGS" | grep -q "NOT_FOUND - vhost musicdb not found"; then
        echo "❌ ERROR: websocket-api still cannot connect to musicdb vhost"
        echo "   Recent logs:"
        echo "$WS_LOGS" | grep -A 5 -B 5 "musicdb"
        exit 1
    else
        echo "✅ No vhost connection errors in websocket-api logs"
    fi
fi
echo ""

echo "========================================="
echo "✅ ALL CHECKS PASSED"
echo "========================================="
echo ""
echo "Summary:"
echo "  - RabbitMQ pod is running and healthy"
echo "  - Lifecycle postStart hook is configured"
echo "  - musicdb vhost exists"
echo "  - songnodesuser has permissions on musicdb"
echo "  - Vhost persists across pod restarts"
echo "  - No connection errors in websocket-api"
echo ""
echo "The permanent fix is working correctly!"
