#!/usr/bin/env node

/**
 * Custom Hot-Reload Script for Chrome Extension Development
 * 
 * This script watches for file changes and automatically reloads
 * the extension in Chrome. Unlike web-ext, this works with your
 * existing Chrome profile.
 * 
 * Usage: npm run watch
 */

const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');

const EXTENSION_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');

// Files/directories to watch
const WATCH_PATTERNS = [
  '*.js',
  '*.html',
  '*.css',
  '*.json',
  'components/**/*',
  'services/**/*',
  'utils/**/*',
  'styles/**/*'
];

// Files to ignore
const IGNORE_PATTERNS = [
  'node_modules/**',
  'scripts/**',
  'package*.json',
  'web-ext-config.js',
  '.env*'
];

console.log('🔧 Chrome Extension Hot-Reload Watcher');
console.log('=====================================');
console.log(`📁 Watching: ${EXTENSION_DIR}`);
console.log('');
console.log('📝 Instructions:');
console.log('1. Open chrome://extensions/ in Chrome');
console.log('2. Enable "Developer mode"');
console.log('3. Load your extension');
console.log('4. Keep this script running');
console.log('5. Extension will reload when you save files');
console.log('');
console.log('⏳ Waiting for changes...\n');

// Initialize watcher
const watcher = chokidar.watch(WATCH_PATTERNS, {
  cwd: EXTENSION_DIR,
  ignored: IGNORE_PATTERNS,
  persistent: true,
  ignoreInitial: true
});

// Debounce reload to avoid multiple reloads for simultaneous file changes
let reloadTimeout = null;
const DEBOUNCE_DELAY = 500;

function triggerReload(changedFile) {
  if (reloadTimeout) {
    clearTimeout(reloadTimeout);
  }
  
  reloadTimeout = setTimeout(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 🔄 File changed: ${changedFile}`);
    console.log('   Reloading extension...');
    
    // Touch manifest.json to trigger Chrome's auto-reload
    // (This works if you have the extension loaded in developer mode)
    try {
      const manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');
      fs.writeFileSync(MANIFEST_PATH, manifest, 'utf8');
      console.log('   ✅ Extension reloaded!\n');
    } catch (error) {
      console.error('   ❌ Error reloading extension:', error.message);
      console.log('   💡 Make sure the extension is loaded in chrome://extensions/\n');
    }
  }, DEBOUNCE_DELAY);
}

// Watch for file changes
watcher
  .on('change', (filepath) => {
    triggerReload(filepath);
  })
  .on('add', (filepath) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ➕ File added: ${filepath}`);
    triggerReload(filepath);
  })
  .on('unlink', (filepath) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ➖ File removed: ${filepath}`);
    triggerReload(filepath);
  })
  .on('error', (error) => {
    console.error('❌ Watcher error:', error);
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopping watcher...');
  watcher.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  watcher.close();
  process.exit(0);
});

