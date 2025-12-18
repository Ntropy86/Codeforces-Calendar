module.exports = {
  // Ignore files that shouldn't be packaged
  ignoreFiles: [
    'package.json',
    'package-lock.json',
    'web-ext-config.js',
    'node_modules',
    '.env.example',
    '.env',
    'scripts/',
    '**/*.md'
  ],
  
  // Source directory
  sourceDir: '.',
  
  // Output directory for builds
  artifactsDir: '../../dist',
  
  // Browser-specific settings
  run: {
    // Start with Codeforces open
    startUrl: ['https://codeforces.com'],
    
    // Chromium settings
    chromiumBinary: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    chromiumProfile: './dev-profile',
    
    // Firefox settings (for cross-browser testing)
    firefox: 'firefoxdeveloperedition',
    firefoxProfile: './firefox-dev-profile',
    
    // Keep browser console open
    browserConsole: true,
    
    // Reload on file changes
    reload: true
  },
  
  // Linting configuration
  lint: {
    selfHosted: false,
    warnings: true
  },
  
  // Build configuration
  build: {
    overwriteDest: true
  }
};

