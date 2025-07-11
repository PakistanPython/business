#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================${NC}"
echo -e "${BLUE} Starting My Business Application ${NC}"
echo -e "${BLUE}==================================${NC}"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun is not installed. Please install Bun first:${NC}"
    echo -e "${YELLOW}   curl -fsSL https://bun.sh/install | bash${NC}"
    exit 1
fi

# Function to start backend
start_backend() {
    echo -e "${YELLOW}📱 Starting Backend Server...${NC}"
    cd backend
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
        bun install
    fi
    
    # Build if dist doesn't exist
    if [ ! -d "dist" ]; then
        echo -e "${YELLOW}🔨 Building backend...${NC}"
        bun run build
    fi
    
    # Start server in background
    echo -e "${GREEN}🚀 Backend server starting on http://localhost:5000${NC}"
    node dist/server_sqlite.js &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    cd ..
}

# Function to start frontend
start_frontend() {
    echo -e "${YELLOW}🌐 Starting Frontend Server...${NC}"
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
        bun install
    fi
    
    # Start frontend server in background
    echo -e "${GREEN}🚀 Frontend server starting on http://localhost:5173${NC}"
    bun run dev &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > frontend.pid
}

# Function to cleanup processes
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down servers...${NC}"
    
    if [ -f "backend.pid" ]; then
        BACKEND_PID=$(cat backend.pid)
        kill $BACKEND_PID 2>/dev/null
        rm backend.pid
        echo -e "${GREEN}✅ Backend server stopped${NC}"
    fi
    
    if [ -f "frontend.pid" ]; then
        FRONTEND_PID=$(cat frontend.pid)
        kill $FRONTEND_PID 2>/dev/null
        rm frontend.pid
        echo -e "${GREEN}✅ Frontend server stopped${NC}"
    fi
    
    exit 0
}

# Set up signal handler for cleanup
trap cleanup SIGINT SIGTERM

# Check if servers are already running
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null; then
    echo -e "${YELLOW}⚠️  Backend server already running on port 5000${NC}"
else
    start_backend
fi

if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null; then
    echo -e "${YELLOW}⚠️  Frontend server already running on port 5173${NC}"
else
    start_frontend
fi

# Wait a moment for servers to start
sleep 3

echo -e "\n${GREEN}==================================${NC}"
echo -e "${GREEN}✅ Application Started Successfully!${NC}"
echo -e "${GREEN}==================================${NC}"
echo -e "${BLUE}🌐 Frontend: http://localhost:5173${NC}"
echo -e "${BLUE}🔧 Backend API: http://localhost:5000${NC}"
echo -e "\n${YELLOW}📋 Demo Credentials:${NC}"
echo -e "${BLUE}   Username: demo${NC}"
echo -e "${BLUE}   Password: demo123${NC}"
echo -e "\n${YELLOW}📖 Features Available:${NC}"
echo -e "${BLUE}   • Dashboard with financial overview${NC}"
echo -e "${BLUE}   • Income & Expense tracking${NC}"
echo -e "${BLUE}   • Purchase & Sales management${NC}"
echo -e "${BLUE}   • Account & Loan management${NC}"
echo -e "${BLUE}   • Charity tracking${NC}"
echo -e "${BLUE}   • Analytics & Reports${NC}"
echo -e "\n${YELLOW}💡 To stop the application, press Ctrl+C${NC}"

# Keep script running
while true; do
    sleep 1
done