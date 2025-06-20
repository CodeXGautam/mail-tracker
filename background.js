console.log("Mail Tracker background.js loaded");

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
  console.log("Background received message:", request.type, request); // Debug log
  switch (request.type) {
    case 'emailSent':
      handleEmailSent(request.email, sendResponse);
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

// Handle the definitive "email sent" event from the content script
function handleEmailSent(email, sendResponse) {
  if (!extensionState.trackingEnabled) {
    sendResponse({ success: false, reason: "Tracking is disabled." });
    return;
  }

  // The email object from the content script is now the single source of truth.
  // It is assumed to have the correct pixel and all necessary data.
  const trackedEmail = email;
  
  browser.storage.local.get(['sentEmails'], (result) => {
    const sentEmails = result.sentEmails || {};
    sentEmails[trackedEmail.id] = { // Use Gmail's thread ID as the primary key for storage
      ...trackedEmail,
      status: TRACKING_STATUS.SENT,
      sentTime: new Date().toISOString()
    };
    
    browser.storage.local.set({ sentEmails }, () => {
      extensionState.sentEmails = sentEmails;
      extensionState.lastUpdate = new Date().toISOString();
      saveExtensionState();

      console.log("About to POST to backend /emails with definitive data", trackedEmail);

      fetch("http://localhost:8000/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...trackedEmail,
          status: TRACKING_STATUS.SENT,
          sentTime: new Date().toISOString(),
          // hasTrackingPixel is already set to true by the content script
        })
      });

      sendResponse({
        success: true,
        email: trackedEmail
      });
    });
  });
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

      fetch("http://localhost:8000/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: emailId,
          status,
          lastUpdate: new Date().toISOString()
        })
      });
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