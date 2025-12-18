# Environment Configuration Management

## Overview

We use **separate `.env` files** for each environment to avoid configuration mistakes.

## File Structure

```
src/backend/
├── .env                    ← Symlink to active environment
├── .env.development        ← Development config (Docker)
├── .env.staging           ← Staging config (HuggingFace)
├── .env.production        ← Production config (Google Cloud)
└── .env.example           ← Template (no secrets)
```

## How It Works

### Development (Local)

**File:** `.env.development`

```env
NODE_ENV=development
MONGO_URL=mongodb://mongo:27017/codeforces-calendar
API_PORT=4000
CORS_ORIGIN=*
```

**Active by default:** `.env` is a symlink to `.env.development`

```bash
# Verify current environment
ls -la .env
# Shows: .env -> .env.development
```

### Staging (HuggingFace Spaces)

**File:** `.env.staging`

```env
NODE_ENV=staging
MONGO_URL=mongodb+srv://user:pass@cluster/staging
API_PORT=8000
CORS_ORIGIN=chrome-extension://STAGING_ID
```

**To deploy to staging:**

```bash
# Option 1: Copy file
cp .env.staging .env

# Option 2: Change symlink
ln -sf .env.staging .env

# Option 3: On HuggingFace, set as secrets
# (Don't use .env file at all, use HF secrets)
```

### Production (Google Cloud Run)

**File:** `.env.production`

```env
NODE_ENV=production
MONGO_URL=mongodb+srv://user:pass@cluster/prod
API_PORT=8080
CORS_ORIGIN=chrome-extension://kdpcekneldcnkajbmabmfgdpcdjdmcfd
```

**To deploy to production:**

```bash
# Option 1: Copy file
cp .env.production .env

# Option 2: Change symlink
ln -sf .env.production .env

# Option 3: On Google Cloud, use Secret Manager
# (Don't use .env file, use GCP secrets)
```

## Switching Environments Locally

### Switch to Development
```bash
cd src/backend
ln -sf .env.development .env
docker-compose restart backend
```

### Switch to Staging (for testing)
```bash
cd src/backend
ln -sf .env.staging .env
# Update .env.staging with your MongoDB Atlas credentials first!
npm run dev
```

### Switch to Production (testing only!)
```bash
cd src/backend
ln -sf .env.production .env
# BE CAREFUL - this connects to production database!
npm run dev
```

## Git Ignore Rules

```gitignore
.env              # The active file (symlink or copy)
.env.*            # All environment-specific files
!.env.example     # Except the template
```

**What gets committed:**
- ✅ `.env.example` (template with placeholders)

**What does NOT get committed:**
- ❌ `.env` (active config)
- ❌ `.env.development` (local config)
- ❌ `.env.staging` (staging secrets)
- ❌ `.env.production` (production secrets)

## Best Practices

### ✅ DO:
1. **Keep separate files** - One per environment
2. **Use descriptive values** - Clear variable names
3. **Document required variables** - In `.env.example`
4. **Use strong credentials** - Especially for production
5. **Backup production .env** - Store securely (password manager)

### ❌ DON'T:
1. **Don't comment/uncomment** - Use separate files instead
2. **Don't commit secrets** - Ever!
3. **Don't share .env files** - Each developer creates their own
4. **Don't use production creds locally** - Too risky
5. **Don't hardcode values** - Always use environment variables

## Deployment Workflows

### Local Development
```bash
# .env points to .env.development (default)
docker-compose up
```

### Deploy to Staging
```bash
# Update .env.staging with MongoDB Atlas staging credentials
cd src/backend
git push staging main

# On HuggingFace Spaces:
# 1. Go to Settings → Variables and secrets
# 2. Add each variable from .env.staging
# 3. HuggingFace loads them automatically
```

### Deploy to Production
```bash
# Update .env.production with MongoDB Atlas production credentials
cd src/backend  
git push production main

# On Google Cloud Run:
# 1. Use Secret Manager to store variables
# 2. Mount them as environment variables
# 3. Never use .env files in production containers
```

## Troubleshooting

### "Cannot find .env file"
```bash
# Create symlink to development
cd src/backend
ln -sf .env.development .env
```

### "Wrong database connected"
```bash
# Check which environment is active
ls -la src/backend/.env

# Should show: .env -> .env.development
```

### "Need to test staging locally"
```bash
# Switch to staging config
cd src/backend
ln -sf .env.staging .env

# Update MongoDB URL in .env.staging first!
npm run dev

# When done, switch back to development
ln -sf .env.development .env
```

## Security Checklist

- [ ] `.env.development` - Contains no real secrets (local Docker only)
- [ ] `.env.staging` - MongoDB Atlas staging credentials only
- [ ] `.env.production` - Strong passwords, backed up securely
- [ ] All `.env.*` files in `.gitignore`
- [ ] `.env.example` has no real values
- [ ] Production credentials never used locally
- [ ] Staging and production use different databases

## Quick Reference

| Environment | File | MongoDB | Port | CORS |
|------------|------|---------|------|------|
| Development | `.env.development` | Docker (mongo:27017) | 4000 | * |
| Staging | `.env.staging` | Atlas Free (staging DB) | 8000 | Staging Extension ID |
| Production | `.env.production` | Atlas Paid (prod DB) | 8080 | Prod Extension ID |

---

**Key Takeaway:** No more commenting/uncommenting! Each environment has its own file. Just switch the symlink or copy the file you need. 🎯

