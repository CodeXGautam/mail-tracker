console.log("Mail Tracker script.js loaded");

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

// --- Compose window tracking pixel insertion ---
// Only observe for new compose windows, not for Sent folder rows
const composeObserver = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Only act if this is a new compose window
          const composeArea = node.querySelector('[role="textbox"][aria-label*="Message Body"], [role="textbox"][aria-label*="Compose"], [contenteditable="true"][aria-label*="Message Body"], [contenteditable="true"][aria-label*="Compose"], [data-tooltip*="Message Body"], .Am.Al.editable');
          if (composeArea && !composeArea.innerHTML.includes('pixel.png')) {
            setTimeout(() => {
              const emailId = generateEmailId();
              insertTrackingPixel(emailId);
              // Optionally, you can store the emailId for later use when the email is sent
              composeArea.setAttribute('data-tracker-email-id', emailId);
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
    console.log("observeMailLists called");
    observers.forEach(obs => obs.disconnect());
    observers = [];
    const mailContainers = [
      document.querySelector('div.Cp')
    ].filter(Boolean);
    mailContainers.forEach(container => {
      if (!container || container.hasAttribute('data-email-tracker-observed')) return;
      container.setAttribute('data-email-tracker-observed', 'true');
      console.log("Setting up observer on", container);
      const observer = new MutationObserver(handleMailListChanges);
      observer.observe(container, {
        childList: true,
        subtree: true
      });
      observers.push(observer);
      processVisibleEmails(getCurrentFolder());
    });
  };
  const handleMailListChanges = (mutations) => {
    console.log("handleMailListChanges called", mutations);
    const folder = getCurrentFolder();
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        processVisibleEmails(folder);
      } else if (mutation.attributeName === 'aria-label') {
        processVisibleEmails(getCurrentFolder());
      }
    });
  };
  function getCurrentFolder() {
    // Try to get folder from URL hash
    const hash = window.location.hash;
    if (hash) {
      if (/^#sent/i.test(hash)) {
        console.log("Detected folder from URL hash: Sent");
        return "Sent";
      }
      if (/^#inbox/i.test(hash)) {
        console.log("Detected folder from URL hash: Inbox");
        return "Inbox";
      }
      // Add more as needed
      console.log("Detected folder from URL hash:", hash);
      return hash.replace(/^#/, '').replace(/\/.*/, '').replace(/-/g, ' ').replace(/\d+/g, '').trim();
    }
    // Fallbacks
    let el = document.querySelector('.nU .J-Ke.n0[aria-label]');
    if (!el) {
      el = document.querySelector('[role="navigation"] [aria-selected="true"]');
    }
    if (!el) {
      el = document.querySelector('.J-Ke.n0[aria-label]');
    }
    if (!el) {
      el = document.querySelector('[aria-label][href*="#"]');
    }
    console.log("Detected folder element:", el);
    const folder = el?.getAttribute('aria-label') || 'unknown';
    console.log("Detected folder name:", folder);
    return folder;
  }
  window.getCurrentFolder = getCurrentFolder;
  function processVisibleEmails(folder) {
    console.log("processVisibleEmails called for folder:", folder);
    const isSentFolder = /sent/i.test(folder);
    console.log("isSentFolder:", isSentFolder, "folder:", folder);
    const emailElements = Array.from(document.querySelectorAll('tr[role="row"]'));
    console.log("Found", emailElements.length, "email rows");
    emailElements.forEach(element => {
      try {
        const email = extractEmailData(element, isSentFolder);
        if (!email) {
          console.log("extractEmailData returned null for element:", element);
          return;
        }
        if (emailMap.has(email.id)) {
          console.log("Email already processed:", email.id);
          return;
        }
        console.log("Processing email element:", email);
        emailMap.set(email.id, true);
        email.folder = folder;
        email.isSent = isSentFolder;
        if (isSentFolder) {
          email.deliveryStatus = getDeliveryStatus(element);
          setupSentEmailTracking(email, element);
          // Send prepareEmailTracking message to background
          console.log("Sending prepareEmailTracking message to background", email);
          browser.runtime.sendMessage({
            type: "prepareEmailTracking",
            email
          });
        }
        console.log("Sending emailDetected message to background", email);
        browser.runtime.sendMessage({
          type: "emailDetected",
          email
        });
      } catch (error) {
        console.error('Error processing email element:', error);
      }
    });
  }
  window.processVisibleEmails = processVisibleEmails;
  function extractEmailData(element, isSentFolder) {
    // Get all <td> in the row
    const tds = element.querySelectorAll('td');
    if (tds.length < 4) return null;

    // Recipient (for Sent folder)
    let to = "";
    let toName = "";
    // Try multiple selectors for recipient
    let toSpan = element.querySelector('span[email], span[email][data-hovercard-id], span.g2');
    if (toSpan) {
      to = toSpan.getAttribute('email') || toSpan.getAttribute('data-hovercard-id') || "";
      toName = toSpan.textContent.trim();
    } else {
      // Try to find in title attribute or fallback
      const toCell = Array.from(tds).find(td => td.getAttribute('title'));
      if (toCell) {
        to = toCell.getAttribute('title');
        toName = toCell.textContent.trim();
      }
    }
    if (!to) {
      console.log('Could not extract recipient (to) for element:', element);
    }

    // Subject
    let subject = "";
    let subjectSpan = element.querySelector('span.bog');
    if (subjectSpan) {
      subject = subjectSpan.textContent.trim();
    }

    // ID
    let id = "";
    if (subjectSpan) {
      id = subjectSpan.getAttribute('data-thread-id') ||
           subjectSpan.getAttribute('data-legacy-thread-id') ||
           subjectSpan.getAttribute('data-legacy-last-message-id') ||
           element.id;
    } else {
      id = element.id;
    }

    // Date (try multiple selectors)
    let date = "";
    let dateSpan = element.querySelector('span.Zt, td.xW span, td.xW, td.xT span');
    if (dateSpan) {
      date = dateSpan.textContent.trim();
    } else if (tds.length > 0) {
      date = tds[tds.length - 1].textContent.trim();
    }
    if (!date) {
      console.log('Could not extract date for element:', element);
    }

    // --- Extract body/snippet ---
    let body = "";
    // Gmail often puts the snippet in span.y2
    const snippetSpan = element.querySelector('span.y2');
    if (snippetSpan) {
      body = snippetSpan.textContent.trim();
    }

    if (!id || !subject) return null;

    return {
      id,
      to,
      toName,
      subject,
      date,
      read: !element.classList.contains('zE'), // zE = unread
      elementId: element.id,
      body // <-- include the snippet/body
    };
  }
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

// Periodic fallback: call processVisibleEmails every 5 seconds
setInterval(() => {
  processVisibleEmails(getCurrentFolder());
}, 5000); // every 5 seconds