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

// Show notification using Bootstrap alerts
function showNotification(message, type = 'info') {
    const existing = document.getElementById('global-bootstrap-alert');
    if (existing) {
        existing.remove();
    }

    const alertType = {
        success: 'alert-success',
        error: 'alert-danger',
        danger: 'alert-danger',
        warning: 'alert-warning',
        info: 'alert-info'
    }[type] || 'alert-info';

    const alertDiv = document.createElement('div');
    alertDiv.id = 'global-bootstrap-alert';
    alertDiv.className = `alert ${alertType} alert-dismissible fade show position-fixed top-0 end-0 m-3`;
    alertDiv.role = 'alert';
    alertDiv.style.zIndex = 1060;
    alertDiv.innerHTML = `
        <span>${message}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    document.body.appendChild(alertDiv);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
        const alertInstance = bootstrap.Alert.getOrCreateInstance(alertDiv);
        alertInstance.close();
    }, 160000);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN');
}

// Close modal when clicking outside
window.addEventListener('click', function (event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Close modal with Escape key
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }
});

// ========== AUDIT LOGS FUNCTIONALITY ==========

// Initialize audit logs page
(function () {
    // Check if we're on the audit logs page
    var logsDataScript = document.getElementById('logsDataScript');
    if (!logsDataScript) return;

    var logsData = [];
    try {
        logsData = JSON.parse(logsDataScript.textContent);
    } catch (e) {
        console.error('Failed to parse logs data:', e);
        return;
    }

    // Socket connection for realtime updates
    var statusSpan = document.getElementById('connection-status');
    var tableBody = document.getElementById('audit-table-body');
    var noLogsRow = document.getElementById('no-logs-row');

    if (typeof io !== 'undefined') {
        var socket = io();

        socket.on('connect', function () {
            if (statusSpan) {
                statusSpan.textContent = 'Live';
                statusSpan.className = 'badge bg-success me-3 shadow-sm';
            }
        });

        socket.on('disconnect', function () {
            if (statusSpan) {
                statusSpan.textContent = 'Disconnected';
                statusSpan.className = 'badge bg-danger me-3';
            }
        });

        socket.on('db_change', function (data) {
            if (noLogsRow) noLogsRow.remove();

            var badgeClass = 'bg-secondary';
            if (data.action === 'CREATE') badgeClass = 'bg-success';
            if (data.action === 'UPDATE') badgeClass = 'bg-warning text-dark';
            if (data.action === 'DELETE') badgeClass = 'bg-danger';

            var row = document.createElement('tr');
            row.className = 'audit-row highlight-new';
            row.style.backgroundColor = '#f0f9ff';
            setTimeout(function () { row.style.backgroundColor = ''; }, 2000);

            row.innerHTML = '<td class="text-muted"><small>' + new Date(data.timestamp).toLocaleString() + '</small></td>' +
                '<td><span class="badge ' + badgeClass + '">' + data.action + '</span></td>' +
                '<td class="fw-bold">' + data.collectionName + '</td>' +
                '<td><code class="text-primary">' + data.documentId + '</code></td>' +
                '<td><div class="d-flex align-items-center"><div style="background-color: #95a5a6; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;"><i class="fas fa-clock" style="font-size: 14px;"></i></div><span class="text-muted ms-2">Pending...</span></div></td>' +
                '<td><button class="btn btn-sm btn-outline-secondary" disabled><i class="fas fa-spinner fa-spin"></i></button></td>';

            if (tableBody && tableBody.firstChild) {
                tableBody.insertBefore(row, tableBody.firstChild);
            } else if (tableBody) {
                tableBody.appendChild(row);
            }

            if (tableBody && tableBody.children.length > 50) {
                tableBody.lastChild.remove();
            }

            setTimeout(function () { location.reload(); }, 2000);
        });
    }

    // Event delegation for View Data buttons
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.view-data-btn');
        if (btn) {
            var index = parseInt(btn.getAttribute('data-index'));
            showAuditLogDetail(logsData, index);
        }
    });
})();

function showAuditLogDetail(logsData, index) {
    var log = logsData[index];
    if (!log) {
        console.error('Log not found at index:', index);
        return;
    }

    var colors = ['#3498db', '#e74c3c', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#e91e63'];
    var email = (log.performedBy && log.performedBy.email) ? log.performedBy.email : '';
    var colorIndex = email ? email.charCodeAt(0) % colors.length : 0;
    var avatarColor = colors[colorIndex];
    var avatarLetter = email ? email.charAt(0).toUpperCase() : 'S';
    var userAvatar = (log.performedBy && log.performedBy.userId && log.performedBy.userId.profile && log.performedBy.userId.profile.avatar) ? log.performedBy.userId.profile.avatar : null;

    var badgeClass = 'bg-secondary';
    if (log.action === 'CREATE') badgeClass = 'bg-success';
    if (log.action === 'UPDATE') badgeClass = 'bg-warning text-dark';
    if (log.action === 'DELETE') badgeClass = 'bg-danger';

    var performedByHtml = '';
    if (log.performedBy && log.performedBy.email && log.performedBy.email !== 'System / ChangeStream') {
        var avatarHtml = userAvatar
            ? '<img src="' + userAvatar + '" alt="Avatar" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">'
            : '<div style="background-color: ' + avatarColor + '; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 20px;">' + avatarLetter + '</div>';
        performedByHtml = '<div class="d-flex align-items-center">' + avatarHtml + '<div class="ms-3" style="word-break: break-word;"><div class="fw-bold">' + log.performedBy.email + '</div><span class="badge bg-secondary">' + log.performedBy.role + '</span></div></div>';
    } else {
        performedByHtml = '<div class="d-flex align-items-center"><div style="background-color: #95a5a6; width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white;"><i class="fas fa-robot" style="font-size: 20px;"></i></div><div class="ms-3"><div class="fw-bold">System</div><span class="badge bg-secondary">system</span></div></div>';
    }

    var content = '<div class="row">' +
        '<div class="col-md-6">' +
        '<div class="mb-4"><label class="text-muted small">LOG ID</label><div><code>' + log._id + '</code></div></div>' +
        '<div class="mb-4"><label class="text-muted small">ACTION</label><div><span class="badge ' + badgeClass + '">' + log.action + '</span></div></div>' +
        '<div class="mb-4"><label class="text-muted small">COLLECTION</label><div class="fw-bold">' + log.collectionName + '</div></div>' +
        '<div class="mb-4"><label class="text-muted small">DOCUMENT ID</label><div><code class="text-primary">' + log.documentId + '</code></div></div>' +
        '</div>' +
        '<div class="col-md-6">' +
        '<div class="mb-4"><label class="text-muted small">TIMESTAMP</label><div>' + new Date(log.timestamp).toLocaleString() + '</div></div>' +
        '<div class="mb-4"><label class="text-muted small">PERFORMED BY</label><div class="mt-2">' + performedByHtml + '</div></div>' +
        (log.ipAddress ? '<div class="mb-4"><label class="text-muted small">IP ADDRESS</label><div>' + log.ipAddress + '</div></div>' : '') +
        '</div>' +
        '</div>' +
        '<hr>' +
        '<div class="mb-3"><label class="text-muted small">DOCUMENT DATA</label><pre class="bg-light p-3 rounded mt-2" style="max-height: 300px; overflow: auto;"><code>' + JSON.stringify(log.documentData, null, 2) + '</code></pre></div>';

    var contentEl = document.getElementById('logDetailContent');
    if (contentEl) {
        contentEl.innerHTML = content;
    }

    var modalEl = document.getElementById('logDetailModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
        // Use getOrCreateInstance to prevent multiple backdrops
        var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }
}
