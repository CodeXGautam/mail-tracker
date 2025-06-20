// Email Tracking Status Constants
const TRACKING_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  OPENED: 'opened',
  CLICKED: 'clicked',
  FAILED: 'failed'
};

// Initialize extension state
let extensionState = {
  sentEmails: {},
  trackingEnabled: true,
  lastUpdate: null
};

// Load saved state from storage
browser.storage.local.get(['extensionState'], (result) => {
  if (result.extensionState) {
    extensionState = {
      ...extensionState,
      ...result.extensionState
    };
  }
});

// Main message handler
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case 'prepareEmailTracking':
      handlePrepareEmail(request.email, sendResponse);
      return true; // Required for async response

    case 'updateEmailStatus':
      handleStatusUpdate(request.emailId, request.status, request.details);
      break;

    case 'getTrackingData':
      handleGetTrackingData(request.emailId, sendResponse);
      return true;

    case 'toggleTracking':
      extensionState.trackingEnabled = request.enabled;
      saveExtensionState();
      break;

    default:
      console.warn('Unknown message type:', request.type);
  }
});

// Handle email preparation
function handlePrepareEmail(email, sendResponse) {
  if (!extensionState.trackingEnabled) {
    sendResponse({ trackingEnabled: false });
    return;
  }

  const trackedEmail = prepareEmailTracking(email);
  
  browser.storage.local.get(['sentEmails'], (result) => {
    const sentEmails = result.sentEmails || {};
    sentEmails[trackedEmail.id] = {
      ...trackedEmail,
      status: TRACKING_STATUS.SENT,
      sentTime: new Date().toISOString()
    };
    
    browser.storage.local.set({ sentEmails }, () => {
      extensionState.sentEmails = sentEmails;
      extensionState.lastUpdate = new Date().toISOString();
      saveExtensionState();
      
      sendResponse({
        trackingEnabled: true,
        email: trackedEmail
      });
    });
  });
}

// Prepare email for tracking
function prepareEmailTracking(email) {
  if (!email.isSent) return email;
  
  const trackingData = {
    pixelUrl: generateTrackingPixelUrl(email.id),
    links: []
  };

  // Add tracking pixel
  email.body = addTrackingPixel(email.body, trackingData.pixelUrl);
  
  // Track links if email is HTML
  if (email.isHtml) {
    const { links, updatedBody } = processLinks(email.body, email.id);
    trackingData.links = links;
    email.body = updatedBody;
  }

  return {
    ...email,
    trackingData,
    originalBody: email.body // Store original before modifications
  };
}

// Generate tracking pixel URL
function generateTrackingPixelUrl(emailId) {
  const serverUrl = "http://localhost:4000";
  const pixelUrl = new URL(`${serverUrl}/pixel.png`);
  
  pixelUrl.searchParams.append('emailId', emailId);
  pixelUrl.searchParams.append('time', Date.now());
  pixelUrl.searchParams.append('source', 'firefox_extension');
  
  return pixelUrl.toString();
}

// Add tracking pixel to email body
function addTrackingPixel(body, pixelUrl) {
  const pixelHtml = `
    <!-- Email Tracking Pixel -->
    <img src="${pixelUrl}" 
         width="1" height="1" 
         style="display:none;border:0;" 
         alt="" aria-hidden="true">
  `;

  if (typeof body === 'string') {
    if (body.includes('</body>')) {
      return body.replace('</body>', `${pixelHtml}</body>`);
    }
    return `${body}${pixelHtml}`;
  }
  return body;
}

// Process and track links in email
function processLinks(body, emailId) {
  const linkRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/g;
  const links = [];
  let updatedBody = body;
  let match;

  while ((match = linkRegex.exec(body)) !== null) {
    const [fullMatch, quote, originalUrl] = match;
    const trackedUrl = generateTrackedLinkUrl(originalUrl, emailId);
    
    links.push({
      originalUrl,
      trackedUrl,
      clickCount: 0
    });

    const trackedHtml = fullMatch.replace(
      `href=${quote}${originalUrl}${quote}`,
      `href="${trackedUrl}"`
    );

    updatedBody = updatedBody.replace(fullMatch, trackedHtml);
  }

  return {
    links,
    updatedBody
  };
}

// Generate tracked link URL
function generateTrackedLinkUrl(originalUrl, emailId) {
  const serverUrl = "http://localhost:4000";
  const trackedUrl = new URL(`${serverUrl}/redirect`);
  
  trackedUrl.searchParams.append('to', encodeURIComponent(originalUrl));
  trackedUrl.searchParams.append('emailId', emailId);
  trackedUrl.searchParams.append('linkId', generateId());
  trackedUrl.searchParams.append('time', Date.now());
  
  return trackedUrl.toString();
}

// Handle status updates
function handleStatusUpdate(emailId, status, details = {}) {
  browser.storage.local.get(['sentEmails'], (result) => {
    const sentEmails = result.sentEmails || {};
    const email = sentEmails[emailId];
    
    if (!email) return;

    const update = {
      status,
      lastUpdate: new Date().toISOString(),
      ...details
    };

    if (status === TRACKING_STATUS.CLICKED) {
      update.lastClick = update.lastUpdate;
      if (details.linkIndex !== undefined && email.trackingData?.links[details.linkIndex]) {
        email.trackingData.links[details.linkIndex].clickCount += 1;
      }
    }

    sentEmails[emailId] = { ...email, ...update };
    
    browser.storage.local.set({ sentEmails }, () => {
      extensionState.sentEmails = sentEmails;
      extensionState.lastUpdate = update.lastUpdate;
      saveExtensionState();
      
      showStatusNotification(emailId, status, details);
    });
  });
}

// Show desktop notification
function showStatusNotification(emailId, status, details) {
  if (!extensionState.notificationsEnabled) return;

  const email = extensionState.sentEmails[emailId];
  if (!email) return;

  const statusMessages = {
    [TRACKING_STATUS.DELIVERED]: `Email delivered to ${email.to}`,
    [TRACKING_STATUS.OPENED]: `Email opened by recipient`,
    [TRACKING_STATUS.CLICKED]: `Link clicked: ${details.linkUrl || ''}`,
    [TRACKING_STATUS.FAILED]: `Email failed to deliver`
  };

  const message = statusMessages[status] || 'Email status updated';
  
  browser.notifications.create(`status-${emailId}-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: `Email Update: ${email.subject || 'No Subject'}`,
    message: message,
    contextMessage: `Status: ${status}`
  });
}

// Get tracking data for popup
function handleGetTrackingData(emailId, sendResponse) {
  browser.storage.local.get(['sentEmails'], (result) => {
    const email = result.sentEmails?.[emailId];
    
    if (email) {
      sendResponse({
        success: true,
        email: {
          id: email.id,
          subject: email.subject,
          to: email.to,
          sentTime: email.sentTime,
          status: email.status,
          trackingData: email.trackingData,
          lastUpdate: email.lastUpdate
        }
      });
    } else {
      sendResponse({
        success: false,
        error: 'Email not found'
      });
    }
  });
}

// Helper functions
function generateId() {
  return crypto.randomUUID() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function saveExtensionState() {
  browser.storage.local.set({ extensionState });
}

// Periodic check for updates
setInterval(checkForUpdates, 300000); // Every 5 minutes

function checkForUpdates() {
  if (!extensionState.trackingEnabled) return;

  browser.storage.local.get(['sentEmails'], (result) => {
    const sentEmails = result.sentEmails || {};
    Object.values(sentEmails).forEach(email => {
      // Here you would implement actual update checks
      // For example, query your tracking server for new data
    });
  });
}

// Initialize
browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.clear(() => {
    extensionState = {
      sentEmails: {},
      trackingEnabled: true,
      lastUpdate: null,
      notificationsEnabled: true
    };
    saveExtensionState();
  });
});