// Mail Tracker Main Page Logic

let currentFilter = 'all';
let emails = [];
let logs = [];
let apiKey = null;

// Initialize main page
async function initDashboard() {
    await getApiKey();
    checkServerStatus();
    loadData();
    setupFilters();
    // Attach refresh button listeners for CSP compliance
    document.getElementById('refresh-emails-btn').addEventListener('click', refreshEmails);
    document.getElementById('refresh-logs-btn').addEventListener('click', refreshLogs);
    // Auto-refresh every 10 seconds for real-time updates
    setInterval(loadData, 10000);
}

// Get API key from extension
async function getApiKey() {
    try {
        if (typeof browser !== 'undefined') {
            const response = await browser.runtime.sendMessage({ type: 'getAuthStatus' });
            if (response.isAuthenticated && response.user) {
                apiKey = response.user.apiKey;
                console.log("✅ API key obtained from extension");
                return true;
            } else {
                console.warn("⚠️ User not authenticated, some features may not work");
                return false;
            }
        }
    } catch (error) {
        console.error("❌ Error getting API key:", error);
        return false;
    }
}

// Refresh API key and retry if needed
async function refreshApiKeyAndRetry() {
    const success = await getApiKey();
    if (success) {
        loadData(); // Retry loading data with new API key
    }
}

// Show authentication error message
function showAuthError() {
    const container = document.getElementById('sent-emails-list');
    container.innerHTML = `
        <div class="auth-error">
            <div class="error-icon">🔐</div>
            <div class="error-message">
                <h3>Authentication Required</h3>
                <p>Please make sure you're on Gmail and the extension is properly initialized.</p>
                <button onclick="refreshApiKeyAndRetry()" class="retry-btn">Retry</button>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', initDashboard);

function checkServerStatus() {
    fetch('https://mail-tracker-k1hl.onrender.com/health')
        .then(response => {
            if (response.ok) {
                document.getElementById('server-status').className = 'status-indicator status-online';
                document.getElementById('server-text').textContent = 'Server Online';
            } else {
                throw new Error('Server error');
            }
        })
        .catch(error => {
            document.getElementById('server-status').className = 'status-indicator status-offline';
            document.getElementById('server-text').textContent = 'Server Offline';
        });
}

function loadData() {
    loadEmails();
    loadLogs();
}

function loadEmails() {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    } else {
        console.warn("⚠️ No API key available, showing authentication error");
        showAuthError();
        return;
    }
    
    // Show loading indicator
    const container = document.getElementById('sent-emails-list');
    container.innerHTML = '<div class="loading">🔄 Loading emails...</div>';
    
    fetch('https://mail-tracker-k1hl.onrender.com/emails', {
        method: 'GET',
        headers: headers
    })
        .then(response => {
            if (!response.ok) {
                if (response.status === 401) {
                    console.error("❌ Authentication failed, refreshing API key...");
                    refreshApiKeyAndRetry();
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data === null) return; // Authentication error handled above
            
            console.log("📧 Fetched emails from backend:", data);
            
            // Update emails array with new data
            emails = data
                .filter(email => email.hasTrackingPixel)
                .map(email => ({
                    id: email.id,
                    subject: email.subject,
                    to: email.to,
                    status: email.status,
                    timestamp: email.sentTime || email.timestamp || new Date().toISOString(),
                    lastUpdate: email.lastUpdate
                }));
            
            console.log("📊 Processed emails:", emails);
            updateEmailDisplay();
            updateStats();
        })
        .catch(error => {
            console.error('❌ Error loading emails from backend:', error);
            if (error.message.includes('401')) {
                showAuthError();
            } else {
                emails = [];
                updateEmailDisplay();
                updateStats();
            }
        });
}

function loadLogs() {
    fetch('https://mail-tracker-k1hl.onrender.com/logs')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            logs = Array.isArray(data) ? data : [];
            updateLogDisplay();
            updateStats();
        })
        .catch(error => {
            console.error('Error loading logs:', error);
            logs = [];
            updateLogDisplay();
        });
}

function updateEmailDisplay() {
    const container = document.getElementById('sent-emails-list');
    const filteredEmails = currentFilter === 'all' 
        ? emails 
        : emails.filter(email => {
            if (currentFilter === 'read') {
                return email.status === 'read' || email.status === 'opened';
            }
            return email.status === currentFilter;
        });

    if (filteredEmails.length === 0) {
        container.innerHTML = '<div class="no-data">No emails found</div>';
        return;
    }

    container.innerHTML = filteredEmails.map(email => {
        // Map status to display status
        let displayStatus = email.status;
        if (email.status === 'read') {
            displayStatus = 'opened';
        }
        
        return `
            <div class="email-item">
                <div class="status-indicator status-${displayStatus}"></div>
                <div class="email-info">
                    <div class="email-subject">${email.subject}</div>
                    <div class="email-details">To: ${email.to}</div>
                </div>
                <div class="email-time">${formatTime(email.timestamp)}</div>
            </div>
        `;
    }).join('');
}

function updateLogDisplay() {
    const container = document.getElementById('tracking-logs');
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="no-data">No tracking activity yet</div>';
        return;
    }

    container.innerHTML = logs.slice(-20).reverse().map(log => `
        <div class="log-item">
            <div>
                <span class="log-timestamp">${formatTime(log.timestamp)}</span>
                <span class="log-email-id">${log.emailId}</span>
                <span class="log-ip">${log.ip}</span>
            </div>
            <div class="log-user-agent">${log.userAgent}</div>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('total-emails').textContent = emails.length;
    document.getElementById('pixels-served').textContent = logs.length;
    document.getElementById('read-emails').textContent = emails.filter(e => e.status === 'read' || e.status === 'opened').length;
    
    // Update last updated time
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
        lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.status;
            updateEmailDisplay();
        });
    });
}

function refreshEmails() {
    loadEmails();
}

function refreshLogs() {
    loadLogs();
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

// Listen for messages from the extension (if running as extension)
if (typeof browser !== 'undefined') {
    browser.runtime.onMessage.addListener((message) => {
        if (message.type === 'emailDetected') {
            // Add new email to the list
            emails.unshift({
                id: message.email.id,
                subject: message.email.subject,
                to: message.email.email,
                status: 'sent',
                timestamp: new Date().toISOString()
            });
            updateEmailDisplay();
            updateStats();
        }
        // Handle status updates
        if (message.type === 'emailStatusUpdate') {
            // Find the email and update its status
            const idx = emails.findIndex(e => e.id === message.emailId);
            if (idx !== -1) {
                emails[idx].status = message.newStatus;
                emails[idx].timestamp = new Date().toISOString();
                updateEmailDisplay();
                updateStats();
            } else {
                // If not found, reload from storage
                loadEmails();
            }
        }
    });
}

// Test function to manually trigger pixel tracking (for debugging)
window.testPixelTracking = function(emailId) {
    console.log("🧪 Testing pixel tracking for emailId:", emailId);
    const pixelUrl = `https://mail-tracker-k1hl.onrender.com/pixel.png?emailId=${encodeURIComponent(emailId)}`;
    
    // Create an image element to simulate the pixel request
    const img = new Image();
    img.onload = function() {
        console.log("✅ Pixel tracking test successful - image loaded");
        // Refresh data after a short delay to see the update
        setTimeout(() => {
            loadData();
        }, 2000);
    };
    img.onerror = function() {
        console.log("❌ Pixel tracking test failed - image failed to load");
    };
    img.src = pixelUrl;
    
    // Also try a direct fetch request to test the endpoint
    fetch(pixelUrl)
        .then(response => {
            console.log("✅ Pixel tracking test successful - fetch response:", response.status);
            if (response.ok) {
                console.log("✅ Pixel endpoint is working correctly");
            } else {
                console.error("❌ Pixel endpoint returned error:", response.status);
            }
        })
        .catch(error => {
            console.log("❌ Pixel tracking test failed - fetch error:", error);
        });
};

// Test function to check server health
window.testServerHealth = function() {
    console.log("🏥 Testing server health...");
    fetch('https://mail-tracker-k1hl.onrender.com/health')
        .then(response => response.json())
        .then(data => {
            console.log("✅ Server health check:", data);
        })
        .catch(error => {
            console.error("❌ Server health check failed:", error);
        });
};

// Test function to check test endpoint
window.testPixelEndpoint = function() {
    console.log("🧪 Testing pixel endpoint...");
    fetch('https://mail-tracker-k1hl.onrender.com/test-pixel?test=true')
        .then(response => response.json())
        .then(data => {
            console.log("✅ Test pixel endpoint response:", data);
        })
        .catch(error => {
            console.error("❌ Test pixel endpoint failed:", error);
        });
};

// Test function to simulate email status update
window.simulateStatusUpdate = function(emailId, status) {
    console.log("🧪 Simulating status update:", emailId, status);
    
    if (apiKey) {
        fetch("https://mail-tracker-k1hl.onrender.com/emails", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "X-API-Key": apiKey
            },
            body: JSON.stringify({
                emailId: emailId,
                status: status,
                lastUpdate: new Date().toISOString()
            })
        })
        .then(response => {
            if (!response.ok) {
                console.error("❌ Status update failed:", response.status);
            } else {
                console.log("✅ Status update successful");
                // Refresh data after a short delay
                setTimeout(() => {
                    loadData();
                }, 2000);
            }
        })
        .catch(error => {
            console.error("❌ Error updating status:", error);
        });
    } else {
        console.error("❌ No API key available");
    }
};