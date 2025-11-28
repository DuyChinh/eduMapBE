// Admin Dashboard JavaScript

// Get token from cookie
function getToken() {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'admin_token') {
            return value;
        }
    }
    return '';
}

// API helper function
async function apiCall(url, options = {}) {
    const token = getToken();
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...(options.headers || {})
        }
    };
    
    try {
        const response = await fetch(url, mergedOptions);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API call error:', error);
        throw error;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Simple alert for now, can be enhanced with toast notifications
    alert(message);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN');
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }
});

