# Environment Management - Quick Guide 🚀

## The Problem We Solved

**Before (❌ Bad):**
```env
# For development
MONGO_URL=mongodb://mongo:27017/codeforces-calendar

# For staging (need to uncomment this and comment above)
# MONGO_URL=mongodb+srv://user:pass@cluster.net/staging

# For production (need to uncomment this and comment others)
# MONGO_URL=mongodb+srv://user:pass@cluster.net/prod
```

**Problem:** You have to manually comment/uncomment lines → Error-prone!

---

## The Solution (✅ Good)

**Separate files for each environment:**

```
src/backend/
├── .env → .env.development    ← Symlink (active config)
├── .env.development           ← Dev config
├── .env.staging              ← Staging config
├── .env.production           ← Production config
└── .env.example              ← Template (safe to commit)
```

**Each file has its own complete configuration. No commenting needed!**

---

## How It Works

### 🔧 Development (Default)

`.env.development` contains:
```env
NODE_ENV=development
MONGO_URL=mongodb://mongo:27017/codeforces-calendar
API_PORT=4000
CORS_ORIGIN=*
```

**Active by default:** `.env` is a symlink to `.env.development`

```bash
# Check which is active
ls -la src/backend/.env
# Output: .env -> .env.development ✅
```

### 🧪 Staging

`.env.staging` contains:
```env
NODE_ENV=staging
MONGO_URL=mongodb+srv://YOUR_USER:YOUR_PASS@cluster/cf-calendar-staging
API_PORT=8000
CORS_ORIGIN=chrome-extension://STAGING_ID
```

**To switch to staging:**
```bash
cd src/backend
ln -sf .env.staging .env
npm run dev
```

### 🚀 Production

`.env.production` contains:
```env
NODE_ENV=production
MONGO_URL=mongodb+srv://YOUR_USER:YOUR_PASS@cluster/cf-calendar-prod
API_PORT=8080
CORS_ORIGIN=chrome-extension://kdpcekneldcnkajbmabmfgdpcdjdmcfd
```

**To switch to production:**
```bash
cd src/backend
ln -sf .env.production .env
npm start
```

---

## Quick Commands

### Switch Environment Locally

```bash
# Switch to development
cd src/backend && ln -sf .env.development .env

# Switch to staging
cd src/backend && ln -sf .env.staging .env

# Switch to production
cd src/backend && ln -sf .env.production .env

# Check current environment
ls -la src/backend/.env
```

### Start Backend

```bash
# For development (Docker Compose)
docker-compose up

# For staging/production (manual)
cd src/backend
npm start
```

---

## Git Security

### What's Ignored (NOT committed)
```
.env                 ← Active config (symlink)
.env.development     ← Dev config (local credentials)
.env.staging        ← Staging credentials
.env.production     ← Production credentials
```

### What's Committed
```
.env.example        ← Template with placeholders
```

**Verify:**
```bash
git check-ignore src/backend/.env
git check-ignore src/backend/.env.development
# Both should be ignored ✅
```

---

## Benefits

✅ **No commenting/uncommenting** - Each env has its own file  
✅ **No mistakes** - Can't accidentally use wrong config  
✅ **Easy switching** - Just change symlink  
✅ **Secure** - All real configs are gitignored  
✅ **Clear** - Always know which environment you're using  

---

## Setup for New Developers

When setting up the project for the first time:

```bash
# 1. Clone repo
git clone <repo>
cd Codeforces-Calendar

# 2. Create development config from template
cd src/backend
cp .env.example .env.development

# 3. Edit .env.development with local settings
nano .env.development
# (For Docker, defaults are usually fine)

# 4. Create symlink
ln -sf .env.development .env

# 5. Start Docker
cd ../..
docker-compose up
```

---

## Deployment Checklist

### Before Deploying to Staging

1. Create `.env.staging` from `.env.example`
2. Update MongoDB Atlas staging credentials
3. Update CORS to staging extension ID
4. Test locally by switching symlink
5. Deploy to HuggingFace (use HF secrets, not .env)

### Before Deploying to Production

1. Create `.env.production` from `.env.example`
2. Use strong MongoDB credentials
3. Update CORS to production extension ID
4. Test locally (carefully!)
5. Deploy to Google Cloud (use Secret Manager)
6. **Backup `.env.production` securely!**

---

## Troubleshooting

**"Module not found" or "Connection refused"**
```bash
# Check which environment is active
ls -la src/backend/.env
# Should point to .env.development for local work
```

**"Need to test staging locally"**
```bash
# Switch to staging
cd src/backend
ln -sf .env.staging .env
npm run dev

# Remember to switch back!
ln -sf .env.development .env
```

**".env file not found"**
```bash
# Create symlink
cd src/backend
ln -sf .env.development .env
```

---

## Summary

**Before:** One `.env` with comments → Manual editing → Error-prone  
**After:** Three `.env.*` files → Switch symlink → Clean & safe  

**One command to switch:**
```bash
ln -sf .env.development .env  # or .env.staging or .env.production
```

**Zero commenting. Zero mistakes. ✨**

---

For detailed information, see: `src/backend/ENV_MANAGEMENT.md`

