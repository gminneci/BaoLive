// Common utilities shared across all pages

// API URL configuration
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : 'https://baolive-production.up.railway.app/api';

// Alert utility function
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        console.warn('Alert container not found');
        return;
    }
    
    alertContainer.innerHTML = `
        <div class="alert alert-${type}">
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Fetch JSON with cache busting and basic error handling
async function fetchJSON(url, options = {}) {
    const resp = await fetch(url, { cache: 'no-store', ...options });
    if (!resp.ok) {
        let errMsg = resp.statusText;
        try {
            const data = await resp.json();
            errMsg = data.error || errMsg;
        } catch {}
        throw new Error(errMsg);
    }
    return resp.json();
}
