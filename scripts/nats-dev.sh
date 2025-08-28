#!/bin/bash

# NATS Development Server Script (Docker)
# Starts NATS server with JetStream enabled using Docker for local development

NATS_CONTAINER_NAME="audibook-nats"
DOCKER_COMPOSE_FILE="docker-compose.nats.yml"

start_nats() {
    echo "🚀 Starting NATS server with JetStream (Docker)..."
    
    # Check if container is already running
    if docker ps --format "table {{.Names}}" | grep -q "^$NATS_CONTAINER_NAME$"; then
        echo "⚠️  NATS container is already running"
        return 0
    fi
    
    # Check if container exists but is stopped
    if docker ps -a --format "table {{.Names}}" | grep -q "^$NATS_CONTAINER_NAME$"; then
        echo "🔄 Starting existing NATS container..."
        docker start $NATS_CONTAINER_NAME
    else
        echo "📦 Creating and starting new NATS container..."
        docker-compose -f $DOCKER_COMPOSE_FILE up -d
    fi
    
    # Wait for container to be ready
    echo "⏳ Waiting for NATS server to be ready..."
    for i in {1..30}; do
        if docker exec $NATS_CONTAINER_NAME nc -z localhost 4222 2>/dev/null; then
            echo "✅ NATS server started successfully"
            echo "📡 Server running at nats://localhost:4222"
            echo "🔧 JetStream enabled"
            echo "📊 Monitoring at http://localhost:8222"
            return 0
        fi
        sleep 1
    done
    
    echo "❌ Failed to start NATS server or health check timeout"
    exit 1
}

stop_nats() {
    echo "🛑 Stopping NATS server (Docker)..."
    
    if docker ps --format "table {{.Names}}" | grep -q "^$NATS_CONTAINER_NAME$"; then
        docker-compose -f $DOCKER_COMPOSE_FILE down
        echo "✅ NATS container stopped"
    else
        echo "⚠️  NATS container was not running"
    fi
}

status_nats() {
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep "^$NATS_CONTAINER_NAME"; then
        echo "✅ NATS container is running"
        echo "📡 Server: nats://localhost:4222"
        echo "📊 Monitoring: http://localhost:8222"
        
        # Show container health if available
        HEALTH=$(docker inspect --format='{{.State.Health.Status}}' $NATS_CONTAINER_NAME 2>/dev/null)
        if [ ! -z "$HEALTH" ]; then
            echo "🏥 Health: $HEALTH"
        fi
    else
        echo "❌ NATS container is not running"
    fi
}

case "$1" in
    start)
        start_nats
        ;;
    stop)
        stop_nats
        ;;
    restart)
        stop_nats
        sleep 1
        start_nats
        ;;
    status)
        status_nats
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start NATS server with JetStream"
        echo "  stop    - Stop NATS server"
        echo "  restart - Restart NATS server"
        echo "  status  - Check NATS server status"
        exit 1
        ;;
esac
