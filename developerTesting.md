# Codeforces Calendar Browser Extension

A browser extension that provides a problem of the day (POTD) functionality for Codeforces users, helping them maintain a consistent practice streak.

## Features

- *Daily Problems*: Get a new Codeforces problem every day based on your rating
- *Streak Tracking*: Build and maintain your daily solving streak
- *Calendar View*: Track your progress with a clean, interactive calendar
- *Automatic Verification*: Extension automatically verifies when you've solved the daily problem
- *Profile Integration*: Seamlessly integrates with your Codeforces profile

## Installation

### Chrome Web Store (Coming Soon)
The extension will be available on the Chrome Web Store in the near future.

### Manual Installation (Developer Mode)

1. *Clone the repository*
   bash
   git clone https://github.com/Ntropy86/Codeforces-Calendar.git
   cd Codeforces-Calendar
   

2. *Open Chrome Extensions page*
   - Navigate to chrome://extensions/ in your Chrome browser
   - Enable "Developer mode" using the toggle in the top-right corner

3. *Load the extension*
   - Click "Load unpacked"
   - Select the root folder of the cloned repository (the folder containing manifest.json)

4. *Verify installation*
   - The extension icon should appear in your browser toolbar
   - Click on the icon to set up your Codeforces handle

## Usage

1. *Initial Setup*
   - Click the extension icon in your browser toolbar
   - Enter your Codeforces handle and click "Go!"
   - The extension will fetch your rating and set up personalized problems

2. *Daily Problem*
   - Visit any Codeforces page to see your calendar in the sidebar
   - Today's problem will be highlighted in the calendar
   - Click on the day to open the problem

3. *Building Your Streak*
   - Solve the daily problem on Codeforces
   - The extension will automatically verify your submission
   - Your streak count will update once verification is complete

4. *View History*
   - Your solving history is displayed on the calendar
   - Days with solved problems are marked with a checkmark
   - Your current streak is displayed at the top of the calendar

## Backend Setup (Optional, for Developers)

If you want to run your own backend instance:

1. *Clone the backend repository*
   bash
   git clone https://github.com/Ntropy86/Codeforces-Calendar-Backend.git
   cd Codeforces-Calendar-Backend
   

2. *Install dependencies*
   bash
   npm install
   

3. *Set up environment variables*
   - Create a .env file with the following variables:
     
     MONGO_URL=your_mongodb_connection_string
     API_PORT=4000
     

4. *Run the backend*
   bash
   node index.js
   

5. *Update the extension to use your backend*
   - Edit config.js in the extension directory:
     javascript
     window.config.current = window.config.development;
     window.config.development.API_URL = 'http://localhost:4000';
     

## Contributing

Contributions are welcome! If you'd like to help improve the extension:

1. Fork the repository
2. Create a feature branch (git checkout -b feature/amazing-feature)
3. Commit your changes (git commit -m 'Add some amazing feature')
4. Push to the branch (git push origin feature/amazing-feature)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Acknowledgments

- [Codeforces](https://codeforces.com/) for their amazing platform
- All beta testers who helped improve this extension