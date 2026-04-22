# Codeforces Calendar Extension - Development Guide

## Quick Start

### 1. Install Dependencies

```bash
cd src/extension
npm install
```

### 2. Development Options

#### Option A: web-ext (Recommended for Clean Testing)
Best for testing in a clean browser profile without interference from your personal extensions.

```bash
npm run dev
```

This will:
- ✅ Open Chrome with the extension loaded
- ✅ Navigate to Codeforces automatically
- ✅ Auto-reload extension when files change
- ✅ Show console logs in terminal
- ✅ Use isolated profile (no personal data)

**For Firefox:**
```bash
npm run dev:firefox
```

#### Option B: Custom Watch Script (For Existing Profile)
Best when you need to test with your actual Chrome profile and existing Codeforces login.

```bash
npm run watch
```

Then manually:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `src/extension` directory

The extension will auto-reload when you save files!

### 3. Building for Production

```bash
npm run build
```

Builds a packaged `.zip` file in `../../dist/` ready for Chrome Web Store upload.

### 4. Linting

```bash
npm run lint
```

Checks for common extension issues and validates manifest.json.

## Directory Structure

```
src/extension/
├── components/          # UI components (will be created)
│   └── Calendar/
├── services/            # Business logic
│   ├── api.js
│   ├── storage.js
│   └── streak.js
├── utils/              # Utility functions
├── styles/             # CSS files
├── background.js       # Service worker
├── content.js          # Content script
├── config.js           # Configuration
├── manifest.json       # Extension manifest
├── package.json        # npm configuration
├── web-ext-config.js   # web-ext settings
└── scripts/
    └── watch-reload.js # Custom hot-reload script
```

## Development Tips

### Debugging

#### Content Script
1. Open Codeforces page
2. Right-click → Inspect
3. Console tab shows content script logs

#### Background Worker
1. Go to `chrome://extensions/`
2. Find "Codeforces POTD"
3. Click "service worker" link
4. Console opens showing background logs

#### Popup (will be removed in new architecture)
1. Click extension icon
2. Right-click popup → Inspect

### Hot Reload Not Working?

**web-ext:**
- Check if Chrome/Chromium path is correct in `web-ext-config.js`
- Try stopping (Ctrl+C) and running `npm run dev` again

**watch script:**
- Make sure extension is loaded in Developer mode
- Check terminal for error messages
- Try manually reloading extension in `chrome://extensions/`

### Common Issues

**Port 9222 already in use:**
```bash
# Kill existing Chrome debugging instance
pkill -f "chrome.*--remote-debugging-port=9222"
```

**Extension not appearing:**
- Check manifest.json for errors
- Run `npm run lint`
- Check browser console for error messages

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your settings
```

### Development vs Production

The extension uses different API URLs based on environment:

- **Development**: `http://localhost:4000` (local backend)
- **Production**: `https://cf-backend-922736494190.asia-south2.run.app` (Google Cloud Run)

Configure in `config.js`:
```javascript
window.config.current = window.config.development; // or production
```

## Testing Workflow

1. Make code changes
2. Extension auto-reloads
3. Refresh Codeforces page to see changes
4. Check console for logs/errors
5. Test functionality
6. Repeat!

## Next Steps

After setup:
1. Read [../../ARCHITECTURE.md](../../ARCHITECTURE.md) for system overview
2. Check [../../CONTRIBUTING.md](../../CONTRIBUTING.md) for contribution guidelines
3. Review [../../Dev.md](../../Dev.md) for backend setup

Happy coding! 🚀


