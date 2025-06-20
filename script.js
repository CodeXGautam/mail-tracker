function insertTrackingPixel(emailId) {
  const pixelUrl = `http://localhost:8000/pixel.png?emailId=${encodeURIComponent(emailId)}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="opacity:0.01;" alt="tracker">`;

  // Try multiple selectors for Gmail's compose area
  const composeSelectors = [
    '[role="textbox"][aria-label*="Message Body"]',
    '[role="textbox"][aria-label*="Compose"]',
    '[contenteditable="true"][aria-label*="Message Body"]',
    '[contenteditable="true"][aria-label*="Compose"]',
    '[data-tooltip*="Message Body"]',
    '.Am.Al.editable'
  ];

  let composeArea = null;
  for (const selector of composeSelectors) {
    composeArea = document.querySelector(selector);
    if (composeArea) {
      console.log("🎯 Found compose area with selector:", selector);
      break;
    }
  }

  if (composeArea && !composeArea.innerHTML.includes(pixelUrl)) {
    // Insert pixel at the end of the content
    composeArea.innerHTML += pixelTag;
    console.log("📩 Pixel inserted into email body:", pixelUrl);
    console.log("📝 Compose area content length:", composeArea.innerHTML.length);
    return true;
  } else if (composeArea) {
    console.log("⚠️ Compose area found but pixel already exists or insertion failed");
    return false;
  } else {
    console.log("❌ No compose area found with any selector");
    console.log("🔍 Available elements with role='textbox':", document.querySelectorAll('[role="textbox"]').length);
    console.log("🔍 Available contenteditable elements:", document.querySelectorAll('[contenteditable="true"]').length);
    return false;
  }
}

// Debug function to manually test pixel insertion
window.testPixelInsertion = function() {
  console.log("🧪 Testing pixel insertion...");
  const emailId = generateEmailId();
  const result = insertTrackingPixel(emailId);
  console.log("🧪 Test result:", result);
  return result;
};

// Debug function to show all potential compose areas
window.showComposeAreas = function() {
  console.log("🔍 Searching for compose areas...");
  const selectors = [
    '[role="textbox"]',
    '[contenteditable="true"]',
    '[aria-label*="Message"]',
    '[aria-label*="Compose"]',
    '.Am.Al'
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`🔍 ${selector}:`, elements.length, "elements found");
    elements.forEach((el, i) => {
      console.log(`  ${i + 1}.`, {
        ariaLabel: el.getAttribute('aria-label'),
        role: el.getAttribute('role'),
        contenteditable: el.getAttribute('contenteditable'),
        className: el.className,
        id: el.id
      });
    });
  });
};

function generateEmailId() {
  // Optionally add user ID logic here
  return `mailtrack-${Date.now()}`;
}

function waitForComposeBox(callback) {
  const interval = setInterval(() => {
    const composeSelectors = [
      '[role="textbox"][aria-label*="Message Body"]',
      '[role="textbox"][aria-label*="Compose"]',
      '[contenteditable="true"][aria-label*="Message Body"]',
      '[contenteditable="true"][aria-label*="Compose"]',
      '[data-tooltip*="Message Body"]',
      '.Am.Al.editable'
    ];

    let composeArea = null;
    for (const selector of composeSelectors) {
      composeArea = document.querySelector(selector);
      if (composeArea) break;
    }

    if (composeArea) {
      clearInterval(interval);
      callback(composeArea);
    }
  }, 500);
}

// Improved observer for compose windows
const composeObserver = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if this is a new compose window
          const composeArea = node.querySelector('[role="textbox"][aria-label*="Message Body"], [role="textbox"][aria-label*="Compose"], [contenteditable="true"][aria-label*="Message Body"], [contenteditable="true"][aria-label*="Compose"], [data-tooltip*="Message Body"], .Am.Al.editable');
          
          if (composeArea) {
            // Wait a bit for the compose area to be fully initialized
            setTimeout(() => {
              const emailId = generateEmailId();
              if (insertTrackingPixel(emailId)) {
                console.log("✅ Tracking pixel inserted in new compose window");
              }
            }, 1000);
          }
        }
      });
    }
  });
});

// Start observing for compose windows
composeObserver.observe(document.body, {
  childList: true,
  subtree: true
});

// Also try to insert pixel when user starts typing
document.addEventListener('input', (event) => {
  const target = event.target;
  const composeSelectors = [
    '[role="textbox"][aria-label*="Message Body"]',
    '[role="textbox"][aria-label*="Compose"]',
    '[contenteditable="true"][aria-label*="Message Body"]',
    '[contenteditable="true"][aria-label*="Compose"]',
    '[data-tooltip*="Message Body"]',
    '.Am.Al.editable'
  ];

  let isComposeArea = false;
  for (const selector of composeSelectors) {
    if (target.matches(selector)) {
      isComposeArea = true;
      break;
    }
  }

  if (isComposeArea && target.textContent.length > 0 && !target.innerHTML.includes('pixel.png')) {
    const emailId = generateEmailId();
    if (insertTrackingPixel(emailId)) {
      console.log("✅ Tracking pixel inserted when user started typing");
    }
  }
});

// Additional event listeners for compose window interactions
document.addEventListener('focusin', (event) => {
  const target = event.target;
  const composeSelectors = [
    '[role="textbox"][aria-label*="Message Body"]',
    '[role="textbox"][aria-label*="Compose"]',
    '[contenteditable="true"][aria-label*="Message Body"]',
    '[contenteditable="true"][aria-label*="Compose"]',
    '[data-tooltip*="Message Body"]',
    '.Am.Al.editable'
  ];

  let isComposeArea = false;
  for (const selector of composeSelectors) {
    if (target.matches(selector)) {
      isComposeArea = true;
      break;
    }
  }

  if (isComposeArea && !target.innerHTML.includes('pixel.png')) {
    setTimeout(() => {
      const emailId = generateEmailId();
      if (insertTrackingPixel(emailId)) {
        console.log("✅ Tracking pixel inserted on compose area focus");
      }
    }, 500);
  }
});

// Periodic check for compose areas that might have been missed
setInterval(() => {
  const composeSelectors = [
    '[role="textbox"][aria-label*="Message Body"]',
    '[role="textbox"][aria-label*="Compose"]',
    '[contenteditable="true"][aria-label*="Message Body"]',
    '[contenteditable="true"][aria-label*="Compose"]',
    '[data-tooltip*="Message Body"]',
    '.Am.Al.editable'
  ];

  for (const selector of composeSelectors) {
    const composeAreas = document.querySelectorAll(selector);
    composeAreas.forEach(area => {
      if (area.textContent.length > 0 && !area.innerHTML.includes('pixel.png')) {
        const emailId = generateEmailId();
        if (insertTrackingPixel(emailId)) {
          console.log("✅ Tracking pixel inserted via periodic check");
        }
      }
    });
  }
}, 3000); // Check every 3 seconds

// Enhanced compose window detection
function detectAndSetupComposeWindows() {
  // Look for compose windows that might not have been detected yet
  const composeWindowSelectors = [
    '[role="dialog"]',
    '[aria-label*="Compose"]',
    '.Am.Al',
    '[data-tooltip*="Compose"]'
  ];

  composeWindowSelectors.forEach(selector => {
    const windows = document.querySelectorAll(selector);
    windows.forEach(window => {
      if (!window.hasAttribute('data-tracker-setup')) {
        window.setAttribute('data-tracker-setup', 'true');
        
        // Set up observer for this specific compose window
        const windowObserver = new MutationObserver((mutations) => {
          mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
              mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                  const composeArea = node.querySelector('[role="textbox"], [contenteditable="true"]');
                  if (composeArea && !composeArea.innerHTML.includes('pixel.png')) {
                    setTimeout(() => {
                      const emailId = generateEmailId();
                      if (insertTrackingPixel(emailId)) {
                        console.log("✅ Tracking pixel inserted in compose window");
                      }
                    }, 1000);
                  }
                }
              });
            }
          });
        });

        windowObserver.observe(window, {
          childList: true,
          subtree: true
        });

        observers.push(windowObserver);
      }
    });
  });
}

// Run compose window detection periodically
setInterval(detectAndSetupComposeWindows, 2000);

// Also run it immediately
detectAndSetupComposeWindows();

console.log("📡 Mail tracker extension script loaded");




// --- 2. Detect emails in inbox/sent and send to background script ---
let observers = [];
let initialized = false;
const emailMap = new Map(); // Track emails we've already processed

if (window.location.hostname.includes('mail.google.com')) {
  if (document.readyState === 'complete') {
    initGmailTracker();
  } else {
    document.addEventListener('DOMContentLoaded', initGmailTracker);
  }
}

function initGmailTracker() {
  if (initialized) return;
  initialized = true;
  
  // Main observer for email lists
  const observeMailLists = () => {
    observers.forEach(obs => obs.disconnect());
    observers = [];
    const mailContainers = [
      document.querySelector('[role="main"]'), 
      ...document.querySelectorAll('[role="grid"]')
    ].filter(Boolean);
    mailContainers.forEach(container => {
      const list = container.querySelector('[role="list"]');
      if (!list || list.hasAttribute('data-email-tracker-observed')) return;
      list.setAttribute('data-email-tracker-observed', 'true');
      const observer = new MutationObserver(handleMailListChanges);
      observer.observe(list, {
        childList: true,
        subtree: true,
        attributeFilter: ['aria-label']
      });
      observers.push(observer);
      processVisibleEmails(getCurrentFolder());
    });
  };
  const handleMailListChanges = (mutations) => {
    const folder = getCurrentFolder();
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        processVisibleEmails(folder);
      } else if (mutation.attributeName === 'aria-label') {
        processVisibleEmails(getCurrentFolder());
      }
    });
  };
  const getCurrentFolder = () => {
    const activeItems = [
      document.querySelector('[role="navigation"] [aria-selected="true"]'),
      document.querySelector('[role="tablist"] [aria-selected="true"]')
    ].filter(Boolean);
    return activeItems[0]?.getAttribute('aria-label') || 'unknown';
  };
  const processVisibleEmails = (folder) => {
    const isSentFolder = folder.toLowerCase().includes('sent');
    const emailElements = Array.from(document.querySelectorAll('[role="listitem"]'));
    emailElements.forEach(element => {
      try {
        const email = extractEmailData(element, isSentFolder);
        if (!email || emailMap.has(email.id)) return;
        emailMap.set(email.id, true);
        email.folder = folder;
        email.isSent = isSentFolder;
        if (isSentFolder) {
          email.deliveryStatus = getDeliveryStatus(element);
          setupSentEmailTracking(email, element);
        }
        browser.runtime.sendMessage({
          type: "emailDetected",
          email
        });
      } catch (error) {
        console.error('Error processing email element:', error);
      }
    });
  };
  const extractEmailData = (element, isSentFolder) => {
    const id = element.getAttribute('data-legacy-thread-id') || 
               element.getAttribute('data-message-id') || 
               element.id;
    if (!id) return null;
    const subjectEl = element.querySelector('[data-thread-perm-id]') || 
                     element.querySelector('[data-message-id]');
    const dateEl = element.querySelector('[data-tooltip]');
    const fromEl = isSentFolder 
      ? element.querySelector('[email][aria-label^="To:"]')
      : element.querySelector('[email]:not([aria-label^="To:"])');
    if (!subjectEl || !fromEl) return null;
    return {
      id,
      from: fromEl.getAttribute('name') || fromEl.textContent.trim(),
      email: fromEl.getAttribute('email'),
      subject: subjectEl.textContent.trim(),
      date: dateEl?.getAttribute('data-tooltip') || new Date().toISOString(),
      read: element.getAttribute('aria-read') === 'true',
      starred: !!element.querySelector('[aria-label^="Starred"]'),
      labels: Array.from(element.querySelectorAll('[aria-label^="Label:"]'))
        .map(el => el.getAttribute('aria-label').replace('Label:', '').trim()),
      elementId: element.id
    };
  };
  const getDeliveryStatus = (element) => {
    const statusIndicator = element.querySelector('[aria-label*="delivery status:"]');
    if (!statusIndicator) return 'sent';
    const statusText = statusIndicator.getAttribute('aria-label').toLowerCase();
    if (statusText.includes('delivered')) return 'delivered';
    if (statusText.includes('failed')) return 'failed';
    if (statusText.includes('read')) return 'read';
    return 'sent';
  };
  const setupSentEmailTracking = (email, element) => {
    const statusObserver = new MutationObserver(() => {
      const newStatus = getDeliveryStatus(element);
      if (newStatus !== email.deliveryStatus) {
        email.deliveryStatus = newStatus;
        browser.runtime.sendMessage({
          type: "emailStatusUpdate",
          emailId: email.id,
          newStatus,
          email
        });
      }
    });
    statusObserver.observe(element, {
      attributes: true,
      attributeFilter: ['aria-label'],
      subtree: true
    });
    observers.push(statusObserver);
    const clickHandler = (event) => {
      const link = event.target.closest('a[href]');
      if (link && link.href.includes('your-tracking-server.com')) {
        browser.runtime.sendMessage({
          type: "linkClicked",
          emailId: email.id,
          linkUrl: link.href,
          elementId: element.id
        });
      }
    };
    element.addEventListener('click', clickHandler);
    const cleanupObserver = new MutationObserver((mutations, obs) => {
      if (!document.body.contains(element)) {
        obs.disconnect();
        element.removeEventListener('click', clickHandler);
        emailMap.delete(email.id);
      }
    });
    cleanupObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    observers.push(cleanupObserver);
  };
  const navObserver = new MutationObserver(observeMailLists);
  const navElement = document.querySelector('[role="navigation"]') || 
                     document.querySelector('[role="tablist"]');
  if (navElement) {
    navObserver.observe(navElement, {
      childList: true,
      subtree: true
    });
    observers.push(navObserver);
  }
  observeMailLists();
  const bodyObserver = new MutationObserver((mutations) => {
    if (mutations.some(m => m.addedNodes.length > 0)) {
      observeMailLists();
    }
  });
  bodyObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  observers.push(bodyObserver);
}

// Clean up on script unload
window.addEventListener('unload', () => {
  observers.forEach(obs => obs.disconnect());
});