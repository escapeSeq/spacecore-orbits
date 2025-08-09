@echo off
title SpaceCore Simulation - Docker Manager

echo 🚀 SpaceCore Simulation Docker Manager
echo ======================================

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

:menu
echo.
echo Select an option:
echo 1) Start Production Build (Port 3000)
echo 2) Start Development Build (Port 3001) - Live Reload
echo 3) View Logs
echo 4) Stop All Services
echo 5) Rebuild Containers
echo 6) Clean Up (Remove containers and images)
echo 7) Exit
echo.

set /p choice="Enter your choice [1-7]: "

if "%choice%"=="1" goto production
if "%choice%"=="2" goto development
if "%choice%"=="3" goto logs
if "%choice%"=="4" goto stop
if "%choice%"=="5" goto rebuild
if "%choice%"=="6" goto cleanup
if "%choice%"=="7" goto exit
echo ❌ Invalid option. Please choose 1-7.
pause
goto menu

:production
echo 🔨 Building and starting production build...
docker-compose up -d
echo ✅ Application started! Access at: http://localhost:3000
pause
goto menu

:development
echo 🔨 Building and starting development build...
docker-compose --profile dev up -d spacecore-dev
echo ✅ Development server started! Access at: http://localhost:3001
echo 📝 Files will hot-reload automatically when changed.
pause
goto menu

:logs
echo 📋 Showing logs (Press Ctrl+C to exit logs)...
docker-compose logs -f
goto menu

:stop
echo 🛑 Stopping all services...
docker-compose down
echo ✅ All services stopped.
pause
goto menu

:rebuild
echo 🔄 Rebuilding containers...
docker-compose down
docker-compose up -d --build
echo ✅ Containers rebuilt and started!
pause
goto menu

:cleanup
echo 🧹 Cleaning up containers and images...
docker-compose down -v
docker system prune -f
echo ✅ Cleanup completed.
pause
goto menu

:exit
echo 👋 Goodbye!
pause
exit