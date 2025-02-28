// Environment configuration
window.config = {
    development: {
      API_URL: 'http://localhost:4000'
    },
    production: {
      API_URL: 'https://api.yourdomain.com'
    }
  };
  
  // Select environment based on build flag
  // Change this to 'production' for production builds
  window.config.current = window.config.development;