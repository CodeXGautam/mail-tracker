// Mail Tracker Dashboard Logic

let currentFilter = 'all';
let emails = [];
let logs = [];

// Initialize dashboard
function initDashboard() {
    checkServerStatus();
    loadData();
    setupFilters();
    // Auto-refresh every 30 seconds
    setInterval(loadData, 30000);
}

document.addEventListener('DOMContentLoaded', initDashboard);

function checkServerStatus() {
    fetch('http://localhost:8000/logs')
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
    // This would typically come from your extension's storage
    // For now, we'll simulate with some sample data
    emails = [
        {
            id: 'mailtrack-1234567890',
            subject: 'Meeting Tomorrow',
            to: 'john@example.com',
            status: 'read',
            timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: 'mailtrack-1234567891',
            subject: 'Project Update',
            to: 'sarah@example.com',
            status: 'delivered',
            timestamp: new Date(Date.now() - 7200000).toISOString()
        },
        {
            id: 'mailtrack-1234567892',
            subject: 'Invoice #12345',
            to: 'billing@example.com',
            status: 'sent',
            timestamp: new Date(Date.now() - 10800000).toISOString()
        }
    ];
    updateEmailDisplay();
    updateStats();
}

function loadLogs() {
    fetch('http://localhost:8000/logs')
        .then(response => response.json())
        .then(data => {
            logs = data;
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
        : emails.filter(email => email.status === currentFilter);

    if (filteredEmails.length === 0) {
        container.innerHTML = '<div class="no-data">No emails found</div>';
        return;
    }

    container.innerHTML = filteredEmails.map(email => `
        <div class="email-item">
            <div class="status-indicator status-${email.status}"></div>
            <div class="email-info">
                <div class="email-subject">${email.subject}</div>
                <div class="email-details">To: ${email.to}</div>
            </div>
            <div class="email-time">${formatTime(email.timestamp)}</div>
        </div>
    `).join('');
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
    document.getElementById('read-emails').textContent = emails.filter(e => e.status === 'read').length;
    document.getElementById('delivered-emails').textContent = emails.filter(e => e.status === 'delivered').length;
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
    });
}