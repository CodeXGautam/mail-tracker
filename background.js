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
  lastUpdate: null,
  apiKey: null,
  userToken: null,
  isInitialized: false
};

// Load saved state from storage
browser.storage.local.get(['extensionState'], (result) => {
  if (result.extensionState) {
    extensionState = {
      ...extensionState,
      ...result.extensionState
    };
  }
  // Auto-initialize user if not already done
  if (!extensionState.isInitialized) {
    initializeUser();
  }
});

// Auto-initialize user with Gmail email
async function initializeUser() {
  try {
    console.log("Initializing user...");
    
    // Get the current tab to access Gmail
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];
    
    if (currentTab && currentTab.url && currentTab.url.includes('mail.google.com')) {
      // Execute script to get user's Gmail email
      const results = await browser.tabs.executeScript(currentTab.id, {
        code: `
          (function() {
            // Try to get Gmail user email
            const emailElement = document.querySelector('[data-email]') || 
                                document.querySelector('[aria-label*="@"]') ||
                                document.querySelector('.gb_d');
            let email = null;
            
            if (emailElement) {
              email = emailElement.getAttribute('data-email') || 
                     emailElement.getAttribute('aria-label') || 
                     emailElement.textContent;
            }
            
            // Fallback: try to get from page title or other elements
            if (!email) {
              const titleEmail = document.title.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (titleEmail) {
                email = titleEmail[0];
              }
            }
            
            // Additional fallback: look for common Gmail user elements
            if (!email) {
              const userElements = document.querySelectorAll('[data-email], [aria-label*="@"], .gb_d, .gb_e');
              for (let el of userElements) {
                const text = el.textContent || el.getAttribute('aria-label') || el.getAttribute('data-email');
                if (text && text.includes('@')) {
                  email = text;
                  break;
                }
              }
            }
            
            // Clean up the email - extract just the email address if it's wrapped in text
            if (email) {
              const emailMatch = email.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
              if (emailMatch) {
                email = emailMatch[0];
              }
            }
            
            return email;
          })();
        `
      });
      
      const userEmail = results[0];
      
      if (userEmail && userEmail.includes('@')) {
        console.log("Found Gmail user:", userEmail);
        
        // Auto-create user account
        const response = await fetch("https://mail-tracker-k1hl.onrender.com/auth/auto-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            email: userEmail,
            name: userEmail.split('@')[0]
          })
        });
        
        console.log("Auto-create response status:", response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Auto-create failed with status:", response.status, "Response:", errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          extensionState.apiKey = data.user.apiKey;
          extensionState.isInitialized = true;
          saveExtensionState();
          console.log("User auto-created and authenticated:", data.user.email);
          
          // Navigate to the extension's main page after successful initialization
          try {
            const extensionUrl = browser.runtime.getURL('index.html');
            await browser.tabs.create({ url: extensionUrl });
            console.log("Navigated to extension main page");
          } catch (navError) {
            console.error("Navigation error:", navError);
          }
        } else {
          console.error("Failed to auto-create user:", data.error);
        }
      } else {
        console.log("Could not detect Gmail user email - user will be created when first email is sent");
        // Don't create a manual user, just mark as not initialized
        extensionState.isInitialized = false;
        saveExtensionState();
      }
    } else {
      console.log("Not on Gmail - user will be created when first email is sent from Gmail");
      // Don't create a manual user, just mark as not initialized
      extensionState.isInitialized = false;
      saveExtensionState();
    }
  } catch (error) {
    console.error("Auto-initialization error:", error);
    // Don't throw error, just mark as not initialized
    extensionState.isInitialized = false;
    saveExtensionState();
  }
}

// Main message handler
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received message:", request.type, request); // Debug log
  switch (request.type) {
    case 'emailSent':
      handleEmailSent(request.email, sendResponse);
      return true; // Required for async response

    case 'login':
      authenticateUser(request.email, request.password)
        .then(result => sendResponse(result));
      return true;

    case 'register':
      registerUser(request.email, request.name, request.password)
        .then(result => sendResponse(result));
      return true;

    case 'logout':
      extensionState.apiKey = null;
      extensionState.userToken = null;
      saveExtensionState();
      sendResponse({ success: true });
      break;

    case 'getAuthStatus':
      sendResponse({ 
        isAuthenticated: !!extensionState.apiKey,
        isInitialized: extensionState.isInitialized,
        user: extensionState.apiKey ? { apiKey: extensionState.apiKey } : null
      });
      break;

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

    case 'initializeUser':
      initializeUser().then(() => {
        sendResponse({ 
          success: !!extensionState.apiKey,
          isAuthenticated: !!extensionState.apiKey,
          user: extensionState.apiKey ? { apiKey: extensionState.apiKey } : null
        });
      }).catch(error => {
        console.error("Initialisation failed:", error);
        sendResponse({ 
          success: false,
          error: error.message,
          isAuthenticated: false,
          user: null
        });
      });
      return true;

    case 'openDashboard':
      try {
        const extensionUrl = browser.runtime.getURL('index.html');
        browser.tabs.create({ url: extensionUrl });
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error opening main page:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;

    default:
      console.warn('Unknown message type:', request.type);
  }
});

// Handle the definitive "email sent" event from the content script
async function handleEmailSent(email, sendResponse) {
  if (!extensionState.trackingEnabled) {
    sendResponse({ success: false, reason: "Tracking is disabled." });
    return;
  }

  // Check if user is authenticated, if not, try to create user from email sender
  if (!extensionState.apiKey) {
    console.log("User not authenticated, attempting to create user from email sender...");
    
    if (email.from && email.from.includes('@')) {
      try {
        const senderEmail = email.from;
        console.log("Creating user from email sender:", senderEmail);
        
        const response = await fetch("https://mail-tracker-k1hl.onrender.com/auth/auto-create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            email: senderEmail,
            name: senderEmail.split('@')[0]
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("User creation failed:", response.status, "Response:", errorText);
          sendResponse({ 
            success: false, 
            reason: "Could not create user account. Please try again." 
          });
          return;
        }
        
        const data = await response.json();
        
        if (data.success) {
          extensionState.apiKey = data.user.apiKey;
          extensionState.isInitialized = true;
          saveExtensionState();
          console.log("User created and authenticated from email sender:", data.user.email);
        } else {
          console.error("Failed to create user:", data.error);
          sendResponse({ 
            success: false, 
            reason: "Could not create user account. Please try again." 
          });
          return;
        }
      } catch (error) {
        console.error("Error creating user from email sender:", error);
        sendResponse({ 
          success: false, 
          reason: "Could not create user account. Please try again." 
        });
        return;
      }
    } else {
      sendResponse({ 
        success: false, 
        reason: "Could not determine email sender. Please make sure you're sending from Gmail." 
      });
      return;
    }
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

      fetch("https://mail-tracker-k1hl.onrender.com/emails", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": extensionState.apiKey
        },
        body: JSON.stringify({
          ...trackedEmail,
          status: TRACKING_STATUS.SENT,
          sentTime: new Date().toISOString(),
          // hasTrackingPixel is already set to true by the content script
        })
      })
      .then(response => {
        if (!response.ok) {
          console.error("Email storage failed:", response.status, response.statusText);
        } else {
          console.log("Email stored successfully");
        }
      })
      .catch(error => {
        console.error("Network error storing email:", error);
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

      // Send status update to backend with API key
      fetch("https://mail-tracker-k1hl.onrender.com/emails", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-API-Key": extensionState.apiKey
        },
        body: JSON.stringify({
          emailId: emailId,
          status: status,
          lastUpdate: new Date().toISOString()
        })
      })
      .then(response => {
        if (!response.ok) {
          console.error("Status update failed:", response.status, response.statusText);
        } else {
          console.log("Status updated successfully:", status);
        }
      })
      .catch(error => {
        console.error("Network error updating status:", error);
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

// Authentication functions
async function authenticateUser(email, password) {
  try {
    const response = await fetch("https://mail-tracker-k1hl.onrender.com/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      extensionState.apiKey = data.user.apiKey;
      extensionState.userToken = data.token;
      saveExtensionState();
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: "Network error" };
  }
}

async function registerUser(email, name, password) {
  try {
    const response = await fetch("https://mail-tracker-k1hl.onrender.com/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      extensionState.apiKey = data.user.apiKey;
      extensionState.userToken = data.token;
      saveExtensionState();
      return { success: true, user: data.user };
    } else {
      return { success: false, error: data.error };
    }
  } catch (error) {
    return { success: false, error: "Network error" };
  }
}