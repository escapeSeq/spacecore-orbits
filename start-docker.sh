#!/bin/bash

# SpaceCore Simulation - Docker Startup Script

echo "🚀 SpaceCore Simulation Docker Manager"
echo "======================================"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Function to display menu
show_menu() {
    echo ""
    echo "Select an option:"
    echo "1) Start Production Build (Port 3000)"
    echo "2) Start Development Build (Port 3001) - Live Reload"
    echo "3) View Logs"
    echo "4) Stop All Services"
    echo "5) Rebuild Containers"
    echo "6) Clean Up (Remove containers and images)"
    echo "7) Exit"
    echo ""
}

# Function to wait for user input
wait_for_enter() {
    echo ""
    read -p "Press Enter to continue..."
}

while true; do
    show_menu
    read -p "Enter your choice [1-7]: " choice

    case $choice in
        1)
            echo "🔨 Building and starting production build..."
            docker-compose up -d
            echo "✅ Application started! Access at: http://localhost:3000"
            wait_for_enter
            ;;
        2)
            echo "🔨 Building and starting development build..."
            docker-compose --profile dev up -d spacecore-dev
            echo "✅ Development server started! Access at: http://localhost:3001"
            echo "📝 Files will hot-reload automatically when changed."
            wait_for_enter
            ;;
        3)
            echo "📋 Showing logs (Press Ctrl+C to exit logs)..."
            docker-compose logs -f
            ;;
        4)
            echo "🛑 Stopping all services..."
            docker-compose down
            echo "✅ All services stopped."
            wait_for_enter
            ;;
        5)
            echo "🔄 Rebuilding containers..."
            docker-compose down
            docker-compose up -d --build
            echo "✅ Containers rebuilt and started!"
            wait_for_enter
            ;;
        6)
            echo "🧹 Cleaning up containers and images..."
            docker-compose down -v
            docker system prune -f
            echo "✅ Cleanup completed."
            wait_for_enter
            ;;
        7)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please choose 1-7."
            wait_for_enter
            ;;
    esac
done