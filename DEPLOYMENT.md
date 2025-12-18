# Deployment Strategy

## Three-Tier Deployment Architecture

```
Development → Staging → Production
(Local)      (HF)      (GCP)
```

### Environment Overview

| Environment | Purpose | Backend | Database | Users |
|------------|---------|---------|----------|-------|
| **Development** | Local testing | Docker (localhost:4000) | Local MongoDB | Developers only |
| **Staging** | Pre-release testing | HuggingFace Spaces | MongoDB Atlas Free | Beta testers |
| **Production** | Live extension | Google Cloud Run | MongoDB Atlas | All users |

---

## Development Environment 🔧

**Purpose:** Local development and testing

**Backend:** Docker Compose on localhost
```bash
docker-compose up
# Available at: http://localhost:4000
```

**Database:** MongoDB in Docker container
- No external setup needed
- Data persists in Docker volumes
- Easy to reset: `docker-compose down -v`

**Extension Config:**
```json
{
  "environment": "development",
  "api": {
    "development": {
      "url": "http://localhost:4000"
    }
  }
}
```

**When to Use:**
- ✅ Writing new features
- ✅ Fixing bugs
- ✅ Testing changes
- ✅ Experimenting

---

## Staging Environment 🧪

**Purpose:** Pre-release testing with real users (beta testers)

**Backend:** HuggingFace Spaces (Free!)
- URL: `https://YOUR-SPACE-NAME.hf.space`
- Free tier available
- Git-based deployment
- Automatic deployments on push

**Database:** MongoDB Atlas (Free tier: 512MB)
- Create free cluster: https://www.mongodb.com/cloud/atlas/register
- Shared tier sufficient for testing
- Separate from production data

**Extension Config:**
```json
{
  "environment": "staging",
  "api": {
    "staging": {
      "url": "https://YOUR-SPACE-NAME.hf.space"
    }
  }
}
```

**Setup HuggingFace Spaces:**
1. Create account: https://huggingface.co/join
2. Create new Space
3. Choose Docker SDK
4. Connect your GitHub repo
5. Add `Dockerfile` to root
6. Configure secrets (MONGO_URL, etc.)

**When to Use:**
- ✅ Testing before production release
- ✅ Beta testing with real users
- ✅ Verifying bug fixes
- ✅ Performance testing with real data

---

## Production Environment 🚀

**Purpose:** Live extension for all users

**Backend:** Google Cloud Run
- URL: `https://cf-backend-922736494190.asia-south2.run.app`
- Auto-scaling
- Pay per use
- High availability

**Database:** MongoDB Atlas (Paid tier recommended)
- Production-grade cluster
- Backups enabled
- Monitoring enabled
- Separate from staging

**Extension Config:**
```json
{
  "environment": "production",
  "api": {
    "production": {
      "url": "https://cf-backend-922736494190.asia-south2.run.app"
    }
  }
}
```

**When to Use:**
- ✅ Stable, tested features only
- ✅ After successful staging testing
- ✅ Critical bug fixes (hotfixes)

---

## Deployment Workflow

### Standard Feature Release

```
1. Development
   └─> Write code locally
   └─> Test with localhost backend
   └─> Commit to feature branch
   
2. Staging
   └─> Merge to staging branch
   └─> Deploy to HuggingFace
   └─> Beta testers test
   └─> Collect feedback
   
3. Production
   └─> Merge to main branch
   └─> Deploy to Google Cloud Run
   └─> Publish to Chrome Web Store
   └─> Monitor for issues
```

### Hotfix Workflow

```
1. Create hotfix branch from main
2. Fix issue locally (development)
3. Quick test in staging
4. Deploy to production immediately
5. Merge back to main and develop
```

---

## Configuration Management

### Backend Configuration

**Development:**
```env
NODE_ENV=development
MONGO_URL=mongodb://mongo:27017/codeforces-calendar
API_PORT=4000
CORS_ORIGIN=*
```

**Staging:**
```env
NODE_ENV=staging
MONGO_URL=mongodb+srv://user:pass@cluster.net/cf-calendar-staging
API_PORT=8000
CORS_ORIGIN=chrome-extension://STAGING_EXTENSION_ID
```

**Production:**
```env
NODE_ENV=production
MONGO_URL=mongodb+srv://user:pass@cluster.net/cf-calendar-prod
API_PORT=8080
CORS_ORIGIN=chrome-extension://kdpcekneldcnkajbmabmfgdpcdjdmcfd
```

### Extension Configuration

**Change environment in `src/extension/config.json`:**

```json
{
  "environment": "development"  // or "staging" or "production"
}
```

The extension automatically loads the correct API URL based on this setting.

---

## Database Strategy

### Separate Databases Per Environment

```
Development DB  → Local Docker MongoDB
    ↓ (test data, can be wiped)
    
Staging DB     → MongoDB Atlas Free
    ↓ (beta user data)
    
Production DB  → MongoDB Atlas Paid
    ↓ (real user data, backed up)
```

**Why separate?**
- ✅ No risk of corrupting production data
- ✅ Test with realistic data in staging
- ✅ Easy to reset development/staging
- ✅ Production data is sacred

---

## Deployment Checklist

### Before Deploying to Staging

- [ ] All tests passing locally
- [ ] No console errors
- [ ] Backend running without crashes
- [ ] Database migrations complete (if any)
- [ ] Environment variables configured
- [ ] Version bumped in manifest.json

### Before Deploying to Production

- [ ] Staging tested for 24+ hours
- [ ] No critical bugs reported
- [ ] Performance metrics acceptable
- [ ] Database backups verified
- [ ] Rollback plan ready
- [ ] Monitoring alerts configured
- [ ] Chrome Web Store listing updated

---

## Monitoring

### Development
- Console logs
- Browser DevTools
- MongoDB Compass

### Staging
- HuggingFace Spaces logs
- MongoDB Atlas metrics
- Beta tester feedback

### Production
- Google Cloud Run logs
- MongoDB Atlas monitoring
- Error tracking (Sentry/etc.)
- User feedback from Chrome Web Store

---

## Cost Breakdown

| Environment | Backend | Database | Total/Month |
|------------|---------|----------|-------------|
| Development | $0 (local) | $0 (local) | **$0** |
| Staging | $0 (HF Free) | $0 (Atlas Free) | **$0** |
| Production | ~$5-20 (GCR) | ~$10-30 (Atlas) | **$15-50** |

---

## Quick Commands

```bash
# Switch to development
cd src/extension
# Edit config.json: "environment": "development"

# Switch to staging
# Edit config.json: "environment": "staging"

# Switch to production
# Edit config.json: "environment": "production"

# Reload extension in Chrome
chrome://extensions/ → Click reload button

# Check which environment you're on
# Open browser console on Codeforces page
# Look for: [Config] Loaded {environment} environment
```

---

## Troubleshooting

**Extension connecting to wrong environment?**
1. Check `src/extension/config.json`
2. Verify `environment` field is correct
3. Reload extension in Chrome
4. Clear extension storage if needed

**Staging deployment failed?**
- Check HuggingFace Spaces logs
- Verify environment secrets are set
- Check MongoDB connection string
- Verify port configuration

**Production issues?**
- Check Google Cloud Run logs
- Verify MongoDB Atlas connection
- Check CORS configuration
- Monitor error rates

---

## Future Enhancements

- [ ] CI/CD pipeline for automatic deployments
- [ ] Blue-green deployments for zero-downtime
- [ ] Feature flags for gradual rollouts
- [ ] Automated testing before staging deployment
- [ ] Slack notifications for deployment status

---

**Remember:** Always test in development, verify in staging, then deploy to production! 🚀

