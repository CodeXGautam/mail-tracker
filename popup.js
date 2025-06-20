// Popup script for Mail Tracker extension

document.addEventListener('DOMContentLoaded', function() {
  checkStatus();
});

async function checkStatus() {
  try {
    const response = await browser.runtime.sendMessage({ type: 'getAuthStatus' });
    updateUI(response);
  } catch (error) {
    console.error('Error checking status:', error);
    updateUI({ isAuthenticated: false, isInitialized: false });
  }
}

function updateUI(status) {
  const statusIcon = document.getElementById('statusIcon');
  const statusText = document.getElementById('statusText');
  const userInfo = document.getElementById('userInfo');
  const userEmail = document.getElementById('userEmail');
  const userStatus = document.getElementById('userStatus');
  const initBtn = document.getElementById('initBtn');
  const btnText = initBtn.querySelector('.btn-text');
  const loading = initBtn.querySelector('.loading');

  if (status.isAuthenticated) {
    statusIcon.textContent = '✅';
    statusText.textContent = 'Authenticated';
    userInfo.style.display = 'block';
    userEmail.textContent = status.user ? 'Connected' : 'Unknown';
    userStatus.textContent = 'Active';
    initBtn.style.display = 'none';
  } else if (status.isInitialized) {
    statusIcon.textContent = '⚠️';
    statusText.textContent = 'Initialized but not authenticated';
    userInfo.style.display = 'none';
    initBtn.style.display = 'block';
    btnText.textContent = 'Retry Authentication';
  } else {
    statusIcon.textContent = '❌';
    statusText.textContent = 'Not initialized';
    userInfo.style.display = 'none';
    initBtn.style.display = 'block';
    btnText.textContent = 'Initialize User';
  }
}

async function initializeUser() {
  const initBtn = document.getElementById('initBtn');
  const btnText = initBtn.querySelector('.btn-text');
  const loading = initBtn.querySelector('.loading');
  const message = document.getElementById('message');

  // Show loading state
  initBtn.disabled = true;
  btnText.style.display = 'none';
  loading.style.display = 'inline';
  message.innerHTML = '';

  try {
    const response = await browser.runtime.sendMessage({ type: 'initializeUser' });
    
    if (response.success) {
      message.innerHTML = '<div class="success">✅ User initialized successfully!</div>';
      updateUI(response);
    } else {
      message.innerHTML = '<div class="error">❌ Failed to initialize user. Make sure you\'re on Gmail.</div>';
    }
  } catch (error) {
    console.error('Initialization error:', error);
    message.innerHTML = '<div class="error">❌ Error during initialization</div>';
  } finally {
    // Reset button state
    initBtn.disabled = false;
    btnText.style.display = 'inline';
    loading.style.display = 'none';
  }
}

// Refresh status every 5 seconds
setInterval(checkStatus, 5000); 