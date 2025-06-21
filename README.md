# Mail Tracker Pro - Firefox Extension

A powerful email tracking extension for Gmail that provides real-time tracking of when your emails are opened.

![Dashboard](icons/dashboard.png)

## Features

- **Real-time Email Tracking** - Track when your emails are opened
- **Dashboard Analytics** - Beautiful dashboard with detailed statistics
- **Instant Notifications** - Get notified when emails are opened
- **Gmail Integration** - Seamless integration with Gmail
- **Tracking Analytics** - View detailed tracking logs and statistics

## Installation

### For Testing (Development Mode)

1. **Download the Extension**
   - Download or clone this repository
   - Extract the files to a folder on your computer

2. **Generate Icons** (if not already included)
   - Open `generate-icons.html` in your browser
   - Click "Generate Icons" then download each size
   - Save the PNG files to the `icons/` folder as:
     - `icon16.png` (16x16 pixels)
     - `icon48.png` (48x48 pixels)
     - `icon128.png` (128x128 pixels)

3. **Install in Firefox**
   - Open Firefox and go to `about:debugging`
   - Click "This Firefox" in the left sidebar
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file from the extension folder
   - The extension will be installed temporarily

4. **Test the Extension**
   - Go to Gmail (mail.google.com)
   - The extension will automatically initialize when you're on Gmail
   - Click the extension icon in the toolbar to open the popup
   - Click "Open Dashboard" to view the main tracking interface

### For Distribution

1. **Package the Extension**
   - Create a ZIP file containing all extension files:
     - `manifest.json`
     - `background.js`
     - `popup.html`
     - `popup.js`
     - `script.js`
     - `index.html`
     - `app.js`
     - `icons/` folder with all icon files
     - `README.md`

2. **Submit to Firefox Add-ons**
   - Go to [Firefox Add-ons Developer Hub](https://addons.mozilla.org/developers/)
   - Create an account and submit your extension
   - Follow the review process

## How It Works

1. **Email Detection**: The extension detects when you send emails in Gmail
2. **Pixel Injection**: A tracking pixel is automatically added to your emails
3. **Real-time Tracking**: When recipients open your email, the pixel loads and tracks the event
4. **Dashboard Updates**: The dashboard shows real-time statistics and tracking data

## Backend Requirements

The extension requires a backend server running at `https://mail-tracker-k1hl.onrender.com`. The backend handles:
- User authentication
- Email storage and tracking
- Pixel serving
- Analytics and statistics

## File Structure

```
Firefox extension/
├── manifest.json          # Extension configuration
├── background.js          # Background script for extension logic
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── script.js             # Content script for Gmail integration
├── index.html            # Main dashboard
├── app.js                # Dashboard functionality
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── dashboard.png     # Dashboard screenshot
├── generate-icons.html   # Icon generator tool
└── README.md            # This file
```

## Permissions

The extension requires the following permissions:
- `storage`: To save user data and settings
- `activeTab`: To interact with Gmail tabs
- `notifications`: To show tracking notifications
- `webRequest`: To monitor network requests
- `*://mail.google.com/*`: To access Gmail
- `*://mail-tracker-k1hl.onrender.com/*`: To communicate with the backend

## Troubleshooting

### Extension Not Working
1. Make sure you're on Gmail (mail.google.com)
2. Check the browser console for error messages
3. Try refreshing the page
4. Check if the backend server is running

### Icons Not Showing
1. Generate icons using `generate-icons.html`
2. Make sure icon files are in the `icons/` folder
3. Verify icon file names match the manifest

### Tracking Not Working
1. Check if you're authenticated (extension popup should show status)
2. Verify the backend server is accessible
3. Check browser console for network errors

## Development

### Local Development
1. Set up the backend server (see backend/README.md)
2. Update the backend URL in `background.js` and `app.js`
3. Test locally before deployment

### Testing
- Use the test functions in the browser console:
  - `testPixelTracking(emailId)` - Test pixel tracking
  - `testServerHealth()` - Check server status
  - `simulateStatusUpdate(emailId, status)` - Simulate status updates

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify all files are present and properly configured
3. Ensure the backend server is running and accessible

## License

This project is for educational and personal use. Please respect privacy and email tracking laws in your jurisdiction. 