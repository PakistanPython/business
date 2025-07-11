#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}🚀 Business Management System - Live Deployment${NC}"
echo -e "${BLUE}================================================${NC}"

# Check if required tools are installed
check_dependencies() {
    echo -e "${YELLOW}🔍 Checking dependencies...${NC}"
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is required but not installed.${NC}"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is required but not installed.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All dependencies are available${NC}"
}

# Build backend for production
build_backend() {
    echo -e "${YELLOW}🔨 Building backend for production...${NC}"
    cd backend
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ backend/package.json not found${NC}"
        exit 1
    fi
    
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Backend npm install failed${NC}"
        exit 1
    fi
    
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Backend build failed${NC}"
        exit 1
    fi
    
    # Seed database with demo data
    echo -e "${YELLOW}📊 Setting up demo data...${NC}"
    node seed_data.js
    
    cd ..
    echo -e "${GREEN}✅ Backend built successfully${NC}"
}

# Build frontend for production
build_frontend() {
    echo -e "${YELLOW}🔨 Building frontend for production...${NC}"
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found in root directory${NC}"
        exit 1
    fi
    
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Frontend npm install failed${NC}"
        exit 1
    fi
    
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Frontend build failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
}

# Deploy to Railway (Backend)
deploy_to_railway() {
    echo -e "${YELLOW}🚂 Deploying backend to Railway...${NC}"
    
    if ! command -v railway &> /dev/null; then
        echo -e "${YELLOW}📦 Installing Railway CLI...${NC}"
        npm install -g @railway/cli
    fi
    
    cd backend
    
    echo -e "${BLUE}Please follow these steps:${NC}"
    echo -e "${BLUE}1. Login to Railway: ${YELLOW}railway login${NC}"
    echo -e "${BLUE}2. Create new project: ${YELLOW}railway new${NC}"
    echo -e "${BLUE}3. Deploy: ${YELLOW}railway up${NC}"
    echo -e "${BLUE}4. Set environment variables in Railway dashboard:${NC}"
    echo -e "${YELLOW}   NODE_ENV=production${NC}"
    echo -e "${YELLOW}   JWT_SECRET=your-super-secret-production-key${NC}"
    echo -e "${YELLOW}   FRONTEND_URL=https://yourdomain.vercel.app${NC}"
    
    read -p "Press Enter when you've completed Railway deployment..."
    
    cd ..
}

# Deploy to Vercel (Frontend)
deploy_to_vercel() {
    echo -e "${YELLOW}⚡ Deploying frontend to Vercel...${NC}"
    
    if ! command -v vercel &> /dev/null; then
        echo -e "${YELLOW}📦 Installing Vercel CLI...${NC}"
        npm install -g vercel
    fi
    
    echo -e "${BLUE}Please follow these steps:${NC}"
    echo -e "${BLUE}1. Enter your Railway backend URL when prompted${NC}"
    echo -e "${BLUE}2. Deploy: ${YELLOW}vercel --prod${NC}"
    
    read -p "Enter your Railway backend URL (e.g., https://your-app.railway.app): " BACKEND_URL
    
    if [ -n "$BACKEND_URL" ]; then
        echo "VITE_API_URL=${BACKEND_URL}/api" > .env.production
        echo -e "${GREEN}✅ Updated API URL to: ${BACKEND_URL}/api${NC}"
    fi
    
    vercel --prod
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Frontend deployed to Vercel successfully!${NC}"
    else
        echo -e "${RED}❌ Vercel deployment failed${NC}"
        exit 1
    fi
}

# Create a simple one-command deployment
quick_deploy() {
    echo -e "${YELLOW}⚡ Quick Deploy Option${NC}"
    echo -e "${BLUE}This will build everything and guide you through deployment${NC}"
    
    build_backend
    build_frontend
    
    echo -e "\n${GREEN}🎉 Build completed successfully!${NC}"
    echo -e "${BLUE}Choose your deployment option:${NC}"
    echo -e "${YELLOW}1) Railway + Vercel (Recommended)${NC}"
    echo -e "${YELLOW}2) Manual deployment${NC}"
    echo -e "${YELLOW}3) Exit${NC}"
    
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            deploy_to_railway
            deploy_to_vercel
            ;;
        2)
            echo -e "${BLUE}Please refer to DEPLOYMENT_GUIDE.md for manual deployment instructions${NC}"
            ;;
        3)
            echo -e "${YELLOW}Exiting...${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
}

# Test local build
test_local() {
    echo -e "${YELLOW}🧪 Testing local build...${NC}"
    
    # Start backend
    echo -e "${BLUE}Starting backend server...${NC}"
    cd backend
    npm start &
    BACKEND_PID=$!
    cd ..
    
    # Start frontend preview
    echo -e "${BLUE}Starting frontend preview...${NC}"
    npm run preview &
    FRONTEND_PID=$!
    
    echo -e "${GREEN}✅ Local test servers started!${NC}"
    echo -e "${BLUE}Backend: http://localhost:5000${NC}"
    echo -e "${BLUE}Frontend: http://localhost:4173${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop test servers${NC}"
    
    # Wait for user to stop
    wait
    
    # Clean up
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
}

# Show deployment status
show_status() {
    echo -e "\n${GREEN}📊 Deployment Status:${NC}"
    
    if [ -d "backend/dist" ]; then
        echo -e "${GREEN}✅ Backend: Built and ready${NC}"
    else
        echo -e "${RED}❌ Backend: Not built${NC}"
    fi
    
    if [ -d "dist" ]; then
        echo -e "${GREEN}✅ Frontend: Built and ready${NC}"
    else
        echo -e "${RED}❌ Frontend: Not built${NC}"
    fi
    
    if [ -f "backend/database.sqlite" ]; then
        echo -e "${GREEN}✅ Database: Present with demo data${NC}"
    else
        echo -e "${YELLOW}⚠️  Database: Will be created on first run${NC}"
    fi
}

# Main menu
show_menu() {
    echo -e "\n${BLUE}Choose an option:${NC}"
    echo -e "${YELLOW}1) Quick Deploy (Build + Deploy)${NC}"
    echo -e "${YELLOW}2) Build Only${NC}"
    echo -e "${YELLOW}3) Test Local Build${NC}"
    echo -e "${YELLOW}4) Show Status${NC}"
    echo -e "${YELLOW}5) View Deployment Guide${NC}"
    echo -e "${YELLOW}6) Exit${NC}"
    
    read -p "Enter your choice (1-6): " choice
    
    case $choice in
        1)
            quick_deploy
            ;;
        2)
            build_backend
            build_frontend
            show_status
            ;;
        3)
            build_backend
            build_frontend
            test_local
            ;;
        4)
            show_status
            ;;
        5)
            if [ -f "DEPLOYMENT_GUIDE.md" ]; then
                less DEPLOYMENT_GUIDE.md
            else
                echo -e "${RED}❌ DEPLOYMENT_GUIDE.md not found${NC}"
            fi
            ;;
        6)
            echo -e "${YELLOW}Goodbye! 👋${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            show_menu
            ;;
    esac
}

# Main execution
main() {
    check_dependencies
    show_status
    show_menu
    
    echo -e "\n${GREEN}🎉 Deployment process completed!${NC}"
    echo -e "${BLUE}Your business management system is ready to go live!${NC}"
    echo -e "\n${YELLOW}🔑 Demo Credentials:${NC}"
    echo -e "${BLUE}   Username: demo${NC}"
    echo -e "${BLUE}   Password: demo123${NC}"
    echo -e "\n${YELLOW}📖 Next Steps:${NC}"
    echo -e "${BLUE}   1. Test your live application${NC}"
    echo -e "${BLUE}   2. Update environment variables${NC}"
    echo -e "${BLUE}   3. Set up custom domain (optional)${NC}"
    echo -e "${BLUE}   4. Share with your users!${NC}"
}

# Run main function
main