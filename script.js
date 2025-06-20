console.log("Mail Tracker script.js loaded");

// Map to store Gmail thread/message ID to generated emailId
const sentEmailIds = new Map();

function insertTrackingPixel(emailId) {
  // Failsafe: if emailId looks like a Gmail ID, try to look up the mapped value
  if (emailId && emailId.startsWith(':')) {
    const mapped = localStorage.getItem('mailtrack-' + emailId);
    if (mapped) {
      console.log('Failsafe: replacing Gmail ID with mapped emailId:', mapped);
      emailId = mapped;
    }
  }
  console.log("insertTrackingPixel called with emailId:", emailId);
  const pixelUrl = `https://mail-tracker-k1hl.onrender.com/pixel.png?emailId=${encodeURIComponent(emailId)}`;
  
  // Create a more email-client-friendly tracking pixel
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" style="display:none; opacity:0; position:absolute; left:-9999px; top:-9999px;" alt="" border="0" />`;

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
    console.log("🔍 Pixel HTML:", pixelTag);
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
  // Use a mock threadId for testing
  const mockThreadId = 'test-thread-id-' + Date.now();
  const emailId = getOrCreateEmailId(mockThreadId);
  const result = insertTrackingPixel(emailId);
  console.log("🧪 Test result:", result);
  return result;
};

// Debug function to test pixel tracking by simulating a request
window.testPixelTracking = function(emailId) {
  console.log("🧪 Testing pixel tracking for emailId:", emailId);
  const pixelUrl = `https://mail-tracker-k1hl.onrender.com/pixel.png?emailId=${encodeURIComponent(emailId)}`;
  
  // Create an image element to simulate the pixel request
  const img = new Image();
  img.onload = function() {
    console.log("✅ Pixel tracking test successful - image loaded");
  };
  img.onerror = function() {
    console.log("❌ Pixel tracking test failed - image failed to load");
  };
  img.src = pixelUrl;
  
  // Also try a direct fetch request
  fetch(pixelUrl)
    .then(response => {
      console.log("✅ Pixel tracking test successful - fetch response:", response.status);
    })
    .catch(error => {
      console.log("❌ Pixel tracking test failed - fetch error:", error);
    });
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

// Utility to get or create a persistent emailId for a thread/message
function getOrCreateEmailId(threadId) {
  let emailId = localStorage.getItem('mailtrack-' + threadId);
  if (!emailId) {
    emailId = generateEmailId();
    localStorage.setItem('mailtrack-' + threadId, emailId);
  }
  return emailId;
}

// This function attaches a "pre-send" listener to a newly found Send button.
function attachListenerToNewSendButton(sendButton) {
    if (sendButton.hasAttribute('data-tracker-send-listener')) {
        return; // Listener already attached
    }
    sendButton.setAttribute('data-tracker-send-listener', 'true');
    console.log('Found new Send button, attaching listener:', sendButton);

    sendButton.addEventListener('click', (event) => {
        console.log('Send button clicked, capturing email data.');
        
        const dialog = sendButton.closest('div[role="dialog"], div[role="region"]');
        if (!dialog) {
            console.error('Could not find dialog for send button.');
            return;
        }

        const composeArea = dialog.querySelector('[role="textbox"][aria-label*="Message Body"], [contenteditable="true"]');
        if (!composeArea) {
            console.error('Could not find compose area for send button.');
            return;
        }

        // Extract all data directly from the compose window
        const toFields = dialog.querySelectorAll('input[name="to"], textarea[name="to"], input[aria-label*="To"], textarea[aria-label*="To"], .wO.nr.l1 input, .wO.nr.l1 textarea');
        console.log('🔍 Found recipient fields:', toFields.length);
        toFields.forEach((field, i) => {
            console.log(`  Field ${i + 1}:`, {
                tagName: field.tagName,
                name: field.name,
                ariaLabel: field.getAttribute('aria-label'),
                value: field.value,
                className: field.className
            });
        });
        
        // Try multiple approaches to get recipient information
        let toRecipients = "";
        
        // Approach 1: Direct field values
        if (toFields.length > 0) {
            toRecipients = Array.from(toFields).map(input => input.value).join(', ');
        }
        
        // Approach 2: Look for email chips (Gmail's way of showing selected recipients)
        if (!toRecipients) {
            const emailChips = dialog.querySelectorAll('[data-email], [data-hovercard-id], .vR, .aXjCH');
            if (emailChips.length > 0) {
                toRecipients = Array.from(emailChips).map(chip => {
                    return chip.getAttribute('data-email') || 
                           chip.getAttribute('data-hovercard-id') || 
                           chip.textContent.trim();
                }).join(', ');
                console.log('📧 Found recipients from email chips:', toRecipients);
            }
        }
        
        // Approach 3: Look for any elements with email addresses
        if (!toRecipients) {
            const allElements = dialog.querySelectorAll('*');
            const emailElements = Array.from(allElements).filter(el => {
                const text = el.textContent || '';
                return text.includes('@') && text.includes('.');
            });
            if (emailElements.length > 0) {
                toRecipients = emailElements.map(el => el.textContent.trim()).join(', ');
                console.log('📧 Found recipients from email elements:', toRecipients);
            }
        }
        
        console.log('📧 Final extracted recipients:', toRecipients);
        
        const subjectInput = dialog.querySelector('input[name="subjectbox"], input[aria-label*="Subject"], .aoD.az6 input');
        const subject = subjectInput ? subjectInput.value : '';

        const threadId = getThreadIdFromElement(composeArea);
        if (!threadId) {
            console.error('Could not determine threadId for compose area.');
            return;
        }

        const emailId = getOrCreateEmailId(threadId);
        
        // Ensure pixel is in the body before capturing it
        if (!composeArea.innerHTML.includes('pixel.png')) {
            insertTrackingPixel(emailId);
        }

        const emailData = {
            id: threadId,
            emailId: emailId,
            to: toRecipients,
            subject: subject,
            body: composeArea.innerHTML,
            isSent: true,
            folder: 'Sent',
            deliveryStatus: 'sent',
            hasTrackingPixel: true // We are ensuring it's there
        };

        // Send the complete data package to the background script
        console.log('Sending emailSent message with complete data:', emailData);
        browser.runtime.sendMessage({
            type: "emailSent",
            email: emailData
        });

    }, { capture: true });
}

// --- Observer to find Send buttons dynamically ---
const sendButtonObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches('div[role="button"][data-tooltip^="Send"]')) {
                        attachListenerToNewSendButton(node);
                    }
                    node.querySelectorAll('div[role="button"][data-tooltip^="Send"]').forEach(attachListenerToNewSendButton);
                }
            });
        }
    });
});

// Start observing the whole document for Send buttons
sendButtonObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Always use persistent emailId for the thread
function getThreadIdFromElement(element) {
  let threadId = "";
  const row = element.closest('tr[role="row"]');
  if (row) {
    const subjectSpan = row.querySelector('span.bog');
    if (subjectSpan) {
      threadId = subjectSpan.getAttribute('data-thread-id') ||
                 subjectSpan.getAttribute('data-legacy-thread-id') ||
                 subjectSpan.getAttribute('data-legacy-last-message-id') ||
                 row.id;
    } else {
      threadId = row.id;
    }
  }
  if (!threadId && element.id) {
    threadId = element.id;
  }
  return threadId;
}

console.log("📡 Mail tracker extension script loaded - using Send button capture method only"); 