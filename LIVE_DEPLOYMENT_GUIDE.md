# 🚀 Live Deployment Guide - Get Your HR Management System Online

## Quick Deploy Options (Get Live URL in 5 minutes!)

### Option 1: Vercel (Recommended) ⭐
**Get instant URL like: `https://hr-business-management-abc123.vercel.app`**

1. **Upload to GitHub**:
   ```bash
   # Initialize git (if not already done)
   git init
   git add .
   git commit -m "Initial HR management system"
   
   # Push to GitHub (create new repo first)
   git remote add origin https://github.com/yourusername/hr-management.git
   git push -u origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - **Important**: Set these configurations:
     - Framework Preset: `Other`
     - Build Command: `bun install && bun run build && cd backend && bun install && bun run build`
     - Output Directory: `dist`
     - Install Command: `bun install`
   - Add Environment Variables:
     ```
     NODE_ENV=production
     JWT_SECRET=your-super-secure-secret-key-here
     FRONTEND_URL=https://your-project-name.vercel.app
     ```
   - Click "Deploy"

3. **Get Your Live URL**: 
   - After deployment: `https://your-project-name.vercel.app`
   - Custom domain available in settings

### Option 2: Netlify
**Get URL like: `https://hr-management-abc123.netlify.app`**

1. **Build locally**:
   ```bash
   bun install
   bun run build
   cd backend && bun install && bun run build
   ```

2. **Deploy**:
   - Go to [netlify.com](https://netlify.com)
   - Drag & drop your `dist` folder to deploy
   - Or connect GitHub repo
   - Set build command: `bun install && bun run build`

### Option 3: Railway
**Get URL like: `https://hr-management-production.up.railway.app`**

1. **Deploy via GitHub**:
   - Go to [railway.app](https://railway.app)
   - Connect GitHub repository
   - Add environment variables:
     ```
     NODE_ENV=production
     JWT_SECRET=your-secure-key
     PORT=3000
     ```

### Option 4: Render
**Get URL like: `https://hr-management.onrender.com`**

1. **Static Site + Web Service**:
   - Go to [render.com](https://render.com)
   - Create new "Static Site" for frontend
   - Create new "Web Service" for backend
   - Connect your GitHub repository

---

## 🛠️ Pre-Deployment Checklist

✅ **Frontend Built Successfully**
```bash
cd /path/to/project
bun install
bun run build
# Should create 'dist' folder
```

✅ **Backend Built Successfully**  
```bash
cd backend
bun install
bun run build
# Should create 'dist' folder with compiled JS
```

✅ **Environment Variables Ready**
- `NODE_ENV=production`
- `JWT_SECRET=your-super-secure-secret-key`
- `FRONTEND_URL=https://your-domain.com`

✅ **Database Configured**
- SQLite database will be created automatically
- Test data will be seeded on first run

---

## 🎯 Fastest Deploy Method (2 minutes)

### Using Vercel CLI:
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy (from project root)
vercel

# Follow prompts:
# - Project name: hr-business-management
# - Framework: Other
# - Build command: bun install && bun run build && cd backend && bun run build
# - Output directory: dist

# Set environment variables
vercel env add NODE_ENV
vercel env add JWT_SECRET
vercel env add FRONTEND_URL

# Deploy again
vercel --prod
```

**Your live URL will be displayed!** 🎉

---

## 📱 Testing Your Live Deployment

1. **Access your URL** (e.g., `https://your-app.vercel.app`)
2. **Login with demo credentials**:
   - Username: `demo`
   - Password: `demo123`
3. **Test HR Features**:
   - Navigate to Employees page
   - Test Work Schedules tab
   - Test Leave Management tab
   - Test Attendance Rules tab

---

## 🔧 Troubleshooting

### Build Errors:
```bash
# Clear cache and rebuild
rm -rf node_modules dist backend/dist
bun install
bun run build
cd backend && bun install && bun run build
```

### Environment Variables:
- Make sure `JWT_SECRET` is set and secure
- Update `FRONTEND_URL` to match your actual domain
- Set `NODE_ENV=production`

### Database Issues:
- SQLite will create automatically
- Check that backend is accessible at `/api/*` routes

---

## 🌟 Features Available After Deployment

✨ **Complete HR Management System**:
- Employee Management with detailed profiles
- Work Schedule Management
- Leave Type & Entitlement Management  
- Attendance Tracking with clock in/out
- Payroll Integration
- Real-time Dashboard
- Mobile-responsive interface

✨ **Advanced HR Features**:
- Late arrival detection
- Half-day marking
- Overtime calculations
- Leave balance tracking
- Attendance reports
- Configurable attendance rules

---

## 📞 Support

If you need help with deployment:
1. Check the build logs in your deployment platform
2. Verify all environment variables are set
3. Test the application locally first
4. Check that both frontend and backend build successfully

**Your HR Management System is ready to go live!** 🚀

---

*Built with React + TypeScript + SQLite + Comprehensive HR Features*