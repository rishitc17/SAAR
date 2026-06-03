/**
 * ekRAAH - Shared UI Components Module
 *
 * Vanilla JavaScript SPA components that render HTML strings and attach event listeners.
 * Uses: window.EkraahState, window.EkraahRouter, window.EkraahAuth, window.EkraahDBHelpers
 *
 * Components:
 *  - EkraahToast        : Toast notification system
 *  - EkraahNotifications: Notification panel & bell icon
 *  - EkraahChatbot      : Floating chatbot assistant
 *  - EkraahModal        : Modal dialog system
 *  - EkraahBottomNav    : Bottom navigation bar
 *  - EkraahSidebar      : Sidebar navigation
 *  - EkraahComponents   : Utility components (tricolour bar, badges, spinners, etc.)
 *
 * Initialization:
 *  - PWA install prompt handler
 *  - Notification subscription on login
 */

/* ==========================================================================
   1. TOAST SYSTEM
   ========================================================================== */

window.EkraahToast = (() => {
    // Toast type configuration: icon (FontAwesome) and color
    const TYPE_CONFIG = {
        success: { icon: 'fa-circle-check', color: '#2e7d32' },
        error: { icon: 'fa-circle-exclamation', color: '#d32f2f' },
        info: { icon: 'fa-circle-info', color: '#1565c0' },
        warning: { icon: 'fa-triangle-exclamation', color: '#f57c00' },
    };

    let toastCounter = 0;

    /**
     * Show a toast notification
     * @param {string} message  - Toast message text
     * @param {string} type     - 'success' | 'error' | 'info' | 'warning'
     * @param {number} duration - Auto-dismiss duration in ms (default 4000)
     */
    function show(message, type = 'info', duration = 4000) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
        const toastId = `toast-${++toastCounter}`;

        // Build toast HTML
        const toastEl = document.createElement('div');
        toastEl.id = toastId;
        toastEl.className = 'toast toast-slide-in';
        toastEl.setAttribute('role', 'alert');
        toastEl.style.cssText = `
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      margin-bottom: 8px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.14);
      border-left: 4px solid ${config.color};
      max-width: 380px;
      width: 100%;
      position: relative;
      overflow: hidden;
      cursor: pointer;
      animation: toastSlideIn 0.3s ease forwards;
    `;

        toastEl.innerHTML = `
      <i class="fas ${config.icon}" style="color:${config.color}; font-size:18px; margin-top:1px; flex-shrink:0;"></i>
      <span style="flex:1; font-size:14px; line-height:1.4; color:#1a1a2e;">${message}</span>
      <button style="background:none; border:none; cursor:pointer; color:#9aa0a6; font-size:14px; padding:0; flex-shrink:0; margin-top:1px;" aria-label="Dismiss">
        <i class="fas fa-times"></i>
      </button>
      <div class="toast-progress" style="
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: ${config.color};
        border-radius: 0 0 0 8px;
        animation: toastProgress ${duration}ms linear forwards;
      "></div>
    `;

        container.appendChild(toastEl);

        // Click to dismiss
        toastEl.addEventListener('click', () => dismiss(toastId));

        // Auto-dismiss after duration
        const timer = setTimeout(() => dismiss(toastId), duration);
        toastEl._dismissTimer = timer;
    }

    /**
     * Dismiss a toast with slide-out animation
     * @param {string} toastId - The toast element ID
     */
    function dismiss(toastId) {
        const toastEl = document.getElementById(toastId);
        if (!toastEl) return;

        // Clear auto-dismiss timer
        if (toastEl._dismissTimer) {
            clearTimeout(toastEl._dismissTimer);
        }

        // Slide out animation
        toastEl.style.animation = 'toastSlideOut 0.25s ease forwards';
        toastEl.addEventListener(
            'animationend',
            () => {
                toastEl.remove();
            },
            { once: true },
        );
    }

    return { show, dismiss };
})();

/* ==========================================================================
   2. NOTIFICATION PANEL
   ========================================================================== */

window.EkraahNotifications = (() => {
    const DB = () => window.EkraahDBHelpers;
    const State = () => window.EkraahState;

    /**
     * Open the notification panel and refresh notifications
     */
    async function open() {
        const panel = document.getElementById('notification-panel');
        const overlay = document.getElementById('notification-overlay');
        if (!panel || !overlay) return;

        overlay.style.display = 'block';
        panel.style.display = 'flex';

        // Trigger animations on next frame
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            panel.classList.add('open');
        });

        // Refresh notification list
        await refresh();

        // Close on backdrop click
        overlay.onclick = close;
    }

    /**
     * Close the notification panel
     */
    async function close() {
        const panel = document.getElementById('notification-panel');
        const overlay = document.getElementById('notification-overlay');
        if (!panel || !overlay) return;

        overlay.classList.remove('active');
        panel.classList.remove('open');

        // Wait for animation then hide
        setTimeout(() => {
            overlay.style.display = 'none';
            panel.style.display = 'none';
        }, 250);
    }

    /**
     * Toggle notification panel open/close
     */
    async function toggle() {
        const panel = document.getElementById('notification-panel');
        if (!panel) return;
        if (panel.classList.contains('open')) {
            await close();
        } else {
            await open();
        }
    }

    /**
     * Refresh notification list from DB and re-render
     */
    async function refresh() {
        const panel = document.getElementById('notification-panel');
        if (!panel) return;

        const user = State()?.get('currentUser');
        const profile = State()?.get('profile');
        const userId = user?.id || profile?.id;

        let notifications = [];
        if (userId && DB()) {
            try {
                notifications = await DB().getNotifications(userId);
                State()?.set('notifications', notifications);
            } catch (err) {
                console.error('Error fetching notifications:', err);
            }
        }

        // Render the full panel content
        panel.innerHTML = renderPanelContent(notifications);

        // Attach event listeners after rendering
        requestAnimationFrame(() => attachPanelListeners(notifications));
    }

    /**
     * Render the notification panel inner HTML
     * @param {Array} notifications - Array of notification objects
     * @returns {string} HTML string
     */
    function renderPanelContent(notifications) {
        const unreadCount = notifications.filter((n) => !n.read).length;
        const listHtml =
            notifications.length > 0
                ? notifications.map((n) => renderNotificationItem(n)).join('')
                : `
        <div class="notification-empty">
          <i class="fas fa-bell-slash"></i>
          <p>No notifications yet</p>
        </div>
      `;

        return `
      <div class="notification-panel-header">
        <h3 class="notification-panel-title">Notifications</h3>
        <div class="notification-panel-actions">
          ${
              unreadCount > 0
                  ? `
            <button class="btn btn-sm btn-text" id="notif-mark-all-read" style="color:var(--saffron); font-size:12px; font-weight:500;">
              Mark all as read
            </button>
          `
                  : ''
          }
          <button class="btn btn-icon btn-sm" id="notif-close-btn" style="color:var(--text-light);">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="notification-list" id="notification-list">
        ${listHtml}
      </div>
    `;
    }

    /**
     * Render a single notification item HTML
     * @param {Object} notif - Notification object from DB
     * @returns {string} HTML string
     */
    function renderNotificationItem(notif) {
        const isUnread = !notif.read;
        const timeAgo = window.EkraahComponents?.timeAgo(notif.created_at) || '';

        // Determine icon & color based on notification type
        let iconClass = 'fas fa-bell';
        let colorClass = 'blue';
        if (notif.type === 'application') {
            iconClass = 'fas fa-file-lines';
            colorClass = 'saffron';
        } else if (notif.type === 'approval') {
            iconClass = 'fas fa-circle-check';
            colorClass = 'green';
        } else if (notif.type === 'rejection') {
            iconClass = 'fas fa-circle-xmark';
            colorClass = 'red';
        } else if (notif.type === 'reminder') {
            iconClass = 'fas fa-clock';
            colorClass = 'saffron';
        }

        return `
      <div class="notification-item ${isUnread ? 'unread' : ''}" data-notif-id="${notif.id}">
        <div class="notification-icon ${colorClass}">
          <i class="${iconClass}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${notif.title || ''}</div>
          <div class="notification-text">${notif.message || ''}</div>
          <div class="notification-time">
            ${timeAgo}
            ${isUnread ? `<span class="notification-mark-read" data-mark-read="${notif.id}">Mark as read</span>` : ''}
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Attach event listeners to panel elements after rendering
     * @param {Array} notifications - Current notifications array
     */
    function attachPanelListeners(notifications) {
        // Close button
        const closeBtn = document.getElementById('notif-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', close);

        // Mark all as read
        const markAllBtn = document.getElementById('notif-mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', async () => {
                const userId = State()?.get('currentUser')?.id;
                if (userId && DB()) {
                    try {
                        await DB().markAllNotificationsRead(userId);
                        await refresh();
                    } catch (err) {
                        console.error('Error marking all as read:', err);
                    }
                }
            });
        }

        // Individual mark as read buttons
        document.querySelectorAll('[data-mark-read]').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const notifId = btn.getAttribute('data-mark-read');
                if (DB()) {
                    try {
                        await DB().markNotificationRead(notifId);
                        await refresh();
                    } catch (err) {
                        console.error('Error marking notification as read:', err);
                    }
                }
            });
        });

        // Click on notification item (optional: navigate or mark as read)
        document.querySelectorAll('.notification-item').forEach((item) => {
            item.addEventListener('click', async () => {
                const notifId = item.getAttribute('data-notif-id');
                const notif = notifications.find((n) => String(n.id) === String(notifId));
                if (notif && !notif.read && DB()) {
                    try {
                        await DB().markNotificationRead(notifId);
                    } catch (err) {
                        // Silently handle
                    }
                }
                // Close panel after interaction
                await close();
            });
        });
    }

    /**
     * Render the notification bell icon with unread count badge
     * @returns {string} HTML string
     */
    function renderBell() {
        const notifications = State()?.get('notifications') || [];
        const unreadCount = notifications.filter((n) => !n.read).length;

        return `
      <button class="btn btn-icon" id="notification-bell-btn" aria-label="Notifications" style="position:relative;">
        <i class="fas fa-bell" style="font-size:20px; color:var(--text-secondary);"></i>
        ${
            unreadCount > 0
                ? `
          <span style="
            position:absolute;
            top:2px;
            right:2px;
            min-width:18px;
            height:18px;
            padding:0 5px;
            background:var(--error);
            color:#fff;
            font-size:11px;
            font-weight:600;
            border-radius:9px;
            display:flex;
            align-items:center;
            justify-content:center;
            line-height:1;
          ">${unreadCount > 99 ? '99+' : unreadCount}</span>
        `
                : ''
        }
      </button>
    `;
    }

    return {
        open,
        close,
        toggle,
        refresh,
        renderBell,
        renderNotificationItem,
    };
})();

/* ==========================================================================
   3. CHATBOT
   ========================================================================== */

window.EkraahChatbot = (() => {
    const Router = () => window.EkraahRouter;
    const State = () => window.EkraahState;

    // Chatbot preset options and their responses
    const PRESET_OPTIONS = [
        {
            id: 'apply-service',
            label: 'How to apply for a service?',
            response:
                'Navigate to the Services page from the bottom navigation bar, search for the service you need, and click on it to start your application.',
            action: null,
        },
        {
            id: 'view-applications',
            label: 'View My Applications',
            response: 'Let me take you there!',
            action: { route: '/citizen/applications', delay: 1000 },
        },
        {
            id: 'check-status',
            label: 'Check Application Status',
            response:
                "You can check the status of your applications in the 'My Applications' section. Each application shows its current stage.",
            action: null,
            actionButton: { label: 'Go to My Applications', route: '/citizen/applications' },
        },
        {
            id: 'view-documents',
            label: 'View My Documents',
            response: "Your issued documents can be found in the 'My Documents' section.",
            action: null,
            actionButton: { label: 'Go to My Documents', route: '/citizen/documents' },
        },
        {
            id: 'contact-support',
            label: 'Contact Support',
            response:
                'For support, you can email us at support@ekraah.gov.in or call our helpline at 1800-XXX-XXXX (toll-free).',
            action: null,
        },
    ];

    let isOpen = false;

    /**
     * Render the chatbot FAB and panel HTML
     * @returns {string} HTML string
     */
    function render() {
        return `
      <!-- Chatbot FAB -->
      <button id="chatbot-fab" class="chatbot-fab" aria-label="Open Assistant">
        <i class="fas fa-headset" style="font-size:24px;"></i>
      </button>

      <!-- Chatbot Panel -->
      <div id="chatbot-panel" class="chatbot-panel" style="display:none;">
        <div class="chatbot-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg, var(--saffron), var(--saffron-dark)); display:flex; align-items:center; justify-content:center;">
              <i class="fas fa-headset" style="font-size:14px; color:#fff;"></i>
            </div>
            <span style="font-size:15px; font-weight:600; color:var(--text-primary);">ekRAAH Assistant</span>
          </div>
          <button id="chatbot-close-btn" class="btn btn-icon btn-sm" style="color:var(--text-light);">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div id="chatbot-messages" class="chatbot-messages">
          <!-- Welcome message from bot -->
          <div class="chat-message bot-message">
            <div class="chat-message-avatar">
              <i class="fas fa-headset"></i>
            </div>
            <div class="chat-message-bubble">
              Hello! I'm your ekRAAH assistant. How can I help you today?
            </div>
          </div>
          <!-- Preset option buttons -->
          <div class="chat-options" id="chatbot-options">
            ${PRESET_OPTIONS.map(
                (opt) => `
              <button class="chat-option-btn" data-option-id="${opt.id}">${opt.label}</button>
            `,
            ).join('')}
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Open the chatbot panel
     */
    function open() {
        const fab = document.getElementById('chatbot-fab');
        const panel = document.getElementById('chatbot-panel');
        if (!fab || !panel) return;

        isOpen = true;
        State()?.set('chatbotOpen', true);

        panel.style.display = 'flex';
        fab.innerHTML = '<i class="fas fa-times" style="font-size:24px;"></i>';

        requestAnimationFrame(() => {
            panel.classList.add('open');
        });

        attachChatListeners();
    }

    /**
     * Attach the FAB click listener immediately after render
     * (separate from attachChatListeners which is called on open)
     */
    function initFabListener() {
        const fab = document.getElementById('chatbot-fab');
        if (fab && !fab._fabListenerAttached) {
            fab.addEventListener('click', function onFabClick(e) {
                e.preventDefault();
                e.stopPropagation();
                toggle();
            });
            fab._fabListenerAttached = true;
        }
    }

    /**
     * Close the chatbot panel
     */
    function close() {
        const fab = document.getElementById('chatbot-fab');
        const panel = document.getElementById('chatbot-panel');
        if (!fab || !panel) return;

        isOpen = false;
        State()?.set('chatbotOpen', false);

        panel.classList.remove('open');

        setTimeout(() => {
            panel.style.display = 'none';
            fab.innerHTML = '<i class="fas fa-headset" style="font-size:24px;"></i>';
        }, 300);
    }

    /**
     * Toggle chatbot open/close
     */
    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    /**
     * Attach event listeners for chatbot interactions
     */
    function attachChatListeners() {
        // FAB click
        const fab = document.getElementById('chatbot-fab');
        if (fab && !fab._listenerAttached) {
            fab.addEventListener('click', toggle);
            fab._listenerAttached = true;
        }

        // Close button
        const closeBtn = document.getElementById('chatbot-close-btn');
        if (closeBtn) {
            closeBtn.onclick = close;
        }

        // Preset option buttons
        const optionBtns = document.querySelectorAll('#chatbot-options .chat-option-btn');
        optionBtns.forEach((btn) => {
            btn.onclick = () => handleOptionClick(btn.getAttribute('data-option-id'));
        });
    }

    /**
     * Handle a preset option click
     * @param {string} optionId - The preset option ID
     */
    function handleOptionClick(optionId) {
        const option = PRESET_OPTIONS.find((o) => o.id === optionId);
        if (!option) return;

        const messagesContainer = document.getElementById('chatbot-messages');
        const optionsContainer = document.getElementById('chatbot-options');
        if (!messagesContainer) return;

        // Hide current options
        if (optionsContainer) optionsContainer.style.display = 'none';

        // Add user message (right-aligned)
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-message user-message';
        userMsg.innerHTML = `
      <div class="chat-message-bubble">${option.label}</div>
    `;
        messagesContainer.appendChild(userMsg);

        // Add bot response (left-aligned with icon) after a brief delay
        setTimeout(() => {
            const botMsg = document.createElement('div');
            botMsg.className = 'chat-message bot-message';

            let actionBtnHtml = '';
            if (option.actionButton) {
                actionBtnHtml = `
          <button class="chat-action-btn" data-route="${option.actionButton.route}">${option.actionButton.label}</button>
        `;
            }

            botMsg.innerHTML = `
        <div class="chat-message-avatar">
          <i class="fas fa-headset"></i>
        </div>
        <div class="chat-message-bubble">
          ${option.response}
          ${actionBtnHtml}
        </div>
      `;
            messagesContainer.appendChild(botMsg);

            // Attach action button listener
            const actionBtn = botMsg.querySelector('.chat-action-btn');
            if (actionBtn) {
                actionBtn.addEventListener('click', () => {
                    const route = actionBtn.getAttribute('data-route');
                    if (route && Router()) {
                        Router().navigate(route);
                        close();
                    }
                });
            }

            // Show options again
            if (optionsContainer) {
                optionsContainer.style.display = 'flex';
                messagesContainer.appendChild(optionsContainer);
            }

            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 400);

        // Handle auto-redirect actions
        if (option.action && option.action.route) {
            setTimeout(() => {
                if (Router()) {
                    Router().navigate(option.action.route);
                    close();
                }
            }, option.action.delay || 1000);
        }

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    return { render, open, close, toggle, initFabListener };
})();

/* ==========================================================================
   4. MODAL
   ========================================================================== */

window.EkraahModal = (() => {
    let _onCloseCallback = null;

    /**
     * Show a modal dialog
     * @param {Object} options
     * @param {string} options.title    - Modal title
     * @param {string} options.content  - Modal body HTML
     * @param {string} options.size     - 'sm' | 'md' | 'lg' (default 'md')
     * @param {Function} options.onClose - Callback when modal closes
     * @param {string} options.footer   - Footer HTML (buttons, etc.)
     */
    function show({ title = '', content = '', size = 'md', onClose = null, footer = '' } = {}) {
        const container = document.getElementById('modal-container');
        if (!container) return;

        _onCloseCallback = onClose;

        // Size mapping
        const sizeMap = { sm: '400px', md: '520px', lg: '720px' };
        const maxWidth = sizeMap[size] || sizeMap.md;

        container.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop"></div>
      <div class="modal-wrapper" id="modal-wrapper">
        <div class="modal" id="modal-dialog" style="max-width:${maxWidth};">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="btn btn-icon btn-sm" id="modal-close-btn" aria-label="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            ${content}
          </div>
          ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
        </div>
      </div>
    `;

        // Trigger animations on next frame
        requestAnimationFrame(() => {
            const backdrop = document.getElementById('modal-backdrop');
            const wrapper = document.getElementById('modal-wrapper');
            if (backdrop) backdrop.classList.add('active');
            if (wrapper) wrapper.classList.add('active');
        });

        // Attach close listeners
        requestAnimationFrame(() => {
            const closeBtn = document.getElementById('modal-close-btn');
            const backdrop = document.getElementById('modal-backdrop');
            if (closeBtn) closeBtn.addEventListener('click', close);
            if (backdrop) backdrop.addEventListener('click', close);
        });
    }

    /**
     * Close the modal
     */
    function close() {
        const container = document.getElementById('modal-container');
        if (!container) return;

        const backdrop = document.getElementById('modal-backdrop');
        const wrapper = document.getElementById('modal-wrapper');

        if (backdrop) backdrop.classList.remove('active');
        if (wrapper) wrapper.classList.remove('active');

        setTimeout(() => {
            container.innerHTML = '';
            if (typeof _onCloseCallback === 'function') {
                _onCloseCallback();
                _onCloseCallback = null;
            }
        }, 300);
    }

    return { show, close };
})();

/* ==========================================================================
   5. BOTTOM NAVIGATION
   ========================================================================== */

window.EkraahBottomNav = (() => {
    const Router = () => window.EkraahRouter;

    /**
     * Render the bottom navigation bar
     * @param {Array} items       - Array of { label, icon, route }
     * @param {number} activeIndex - Index of the active item
     * @returns {string} HTML string
     */
    function render(items, activeIndex = 0) {
        if (!items || items.length === 0) return '';

        const navItems = items
            .map((item, index) => {
                const isActive = index === activeIndex;
                // Use filled icon variant for active state if available
                const iconClass = isActive ? getFilledIcon(item.icon) : item.icon;
                return `
        <a class="bottom-nav-item ${isActive ? 'active' : ''}" 
           href="#${item.route}" 
           data-nav-index="${index}" 
           data-route="${item.route}">
          <i class="${iconClass}"></i>
          <span>${item.label}</span>
        </a>
      `;
            })
            .join('');

        return `<nav class="bottom-nav" id="bottom-nav">${navItems}</nav>`;
    }

    /**
     * Convert a regular (outline) FA icon to its filled/solid variant
     * For FA6, "fas" is solid and "far" is regular. We convert far → fas for active.
     * @param {string} iconClass - e.g., "far fa-home"
     * @returns {string} filled variant - e.g., "fas fa-home"
     */
    function getFilledIcon(iconClass) {
        return iconClass.replace(/^far\b/, 'fas');
    }

    return { render };
})();

/* ==========================================================================
   6. SIDEBAR NAVIGATION
   ========================================================================== */

window.EkraahSidebar = (() => {
    const Router = () => window.EkraahRouter;
    const State = () => window.EkraahState;

    /**
     * Render the sidebar navigation
     * @param {Array} items       - Array of { label, icon, route }
     * @param {string} activeItem - Route of the active item
     * @param {Object} profileData - User profile data { full_name, role }
     * @returns {string} HTML string
     */
    function render(items, activeItem = '', profileData = null) {
        if (!items || items.length === 0) return '';

        const navItems = items
            .map((item) => {
                const isActive = item.route === activeItem;
                return `
        <a class="sidebar-nav-item ${isActive ? 'active' : ''}" 
           href="#${item.route}" 
           data-route="${item.route}">
          <i class="${item.icon}"></i>
          <span>${item.label}</span>
        </a>
      `;
            })
            .join('');

        // Profile section at bottom
        let profileHtml = '';
        if (profileData) {
            const initials = (profileData.full_name || 'U')
                .split(' ')
                .map((w) => w[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
            const roleLabel = formatRole(profileData.role);

            profileHtml = `
        <div class="sidebar-profile">
          <div class="sidebar-profile-avatar">${initials}</div>
          <div class="sidebar-profile-info">
            <div class="sidebar-profile-name">${profileData.full_name || 'User'}</div>
            <div class="sidebar-profile-role">${roleLabel}</div>
          </div>
        </div>
      `;
        }

        return `
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <img src="assets/mini-logo.png" alt="ekRAAH">
          </div>
          <span class="sidebar-brand">ekRAAH</span>
        </div>
        <nav class="sidebar-nav">
          <div class="sidebar-nav-group">
            ${navItems}
          </div>
        </nav>
        ${profileHtml}
      </aside>
    `;
    }

    /**
     * Format role string for display
     * @param {string} role - e.g., 'citizen', 'government_official'
     * @returns {string} Formatted role label
     */
    function formatRole(role) {
        if (!role) return '';
        const map = {
            citizen: 'Citizen',
            government_official: 'Government Official',
            lawyer: 'Lawyer',
            admin: 'Administrator',
        };
        return map[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    /**
     * Toggle sidebar open/close (mobile)
     */
    function toggle() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar) return;

        const isOpen = sidebar.classList.contains('open');
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    /**
     * Open sidebar (mobile)
     */
    function open() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.add('open');
        if (overlay) overlay.classList.add('active');
        State()?.set('sidebarOpen', true);
    }

    /**
     * Close sidebar (mobile)
     */
    function close() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
        State()?.set('sidebarOpen', false);
    }

    return { render, toggle, open, close };
})();

/* ==========================================================================
   7. UTILITY COMPONENTS (EkraahComponents)
   ========================================================================== */

window.EkraahComponents = (() => {
    /* ── Status Color Map ── */
    const STATUS_COLORS = {
        submitted: { bg: '#E3F2FD', color: '#1565c0', label: 'Submitted' },
        in_review: { bg: '#FFF3E0', color: '#f57c00', label: 'In Review' },
        approved: { bg: '#E8F5E9', color: '#2e7d32', label: 'Approved' },
        rejected: { bg: '#FFEBEE', color: '#d32f2f', label: 'Rejected' },
        lawyer_pending: { bg: '#F3E5F5', color: '#7B1FA2', label: 'Lawyer Pending' },
        lawyer_assigned: { bg: '#E0F2F1', color: '#00897B', label: 'Lawyer Assigned' },
        completed: { bg: '#E8F5E9', color: '#1b5e20', label: 'Completed' },
    };

    /**
     * Tricolour Bar — thin saffron-white-green stripe
     * @returns {string} HTML string
     */
    function tricolourBar() {
        return `
      <div class="tricolour-bar" style="
        display: flex;
        width: 100%;
        height: 4px;
        overflow: hidden;
      ">
        <div style="flex:1; background:#FF9933;"></div>
        <div style="flex:1; background:#FFFFFF;"></div>
        <div style="flex:1; background:#138808;"></div>
      </div>
    `;
    }

    /**
     * Status Badge — colored pill badge for application status
     * @param {string} status - Status key (e.g., 'submitted', 'approved')
     * @returns {string} HTML string
     */
    function statusBadge(status) {
        const config = STATUS_COLORS[status] || { bg: '#f5f5f5', color: '#757575', label: status };
        return `
      <span style="
        display: inline-flex;
        align-items: center;
        padding: 3px 10px;
        border-radius: 9999px;
        font-size: 12px;
        font-weight: 600;
        background: ${config.bg};
        color: ${config.color};
        white-space: nowrap;
        line-height: 1.4;
      ">${config.label}</span>
    `;
    }

    /**
     * Progress/Status Track — horizontal stepper showing application stages
     * @param {Array} stages       - Array of { label, department }
     * @param {number} currentStage - 1-based current stage number
     * @param {string} status      - Overall application status
     * @returns {string} HTML string
     */
    function statusTrack(stages, currentStage, status) {
        if (!stages || stages.length === 0) return '';

        const isRejected = status === 'rejected';
        const isCompleted = status === 'completed';

        const stageItems = stages
            .map((stage, index) => {
                const stageNum = index + 1;
                let state = 'pending'; // pending | current | completed | rejected

                if (isRejected && stageNum === currentStage) {
                    state = 'rejected';
                } else if (isCompleted || stageNum < currentStage) {
                    state = 'completed';
                } else if (stageNum === currentStage) {
                    state = 'current';
                }

                // Circle color & icon
                let circleStyle, iconHtml;
                switch (state) {
                    case 'completed':
                        circleStyle = 'background:var(--green); color:#fff; border-color:var(--green);';
                        iconHtml = '<i class="fas fa-check" style="font-size:10px;"></i>';
                        break;
                    case 'current':
                        circleStyle =
                            'background:var(--saffron); color:#fff; border-color:var(--saffron); box-shadow:0 0 0 4px rgba(255,153,51,0.2);';
                        iconHtml = `<span style="font-size:11px; font-weight:700;">${stageNum}</span>`;
                        break;
                    case 'rejected':
                        circleStyle = 'background:var(--error); color:#fff; border-color:var(--error);';
                        iconHtml = '<i class="fas fa-times" style="font-size:10px;"></i>';
                        break;
                    default:
                        circleStyle = 'background:#fff; color:var(--text-light); border:2px solid var(--border);';
                        iconHtml = `<span style="font-size:11px; font-weight:600;">${stageNum}</span>`;
                }

                // Connector line between circles
                const connectorHtml =
                    index < stages.length - 1
                        ? `
        <div style="
          flex: 1;
          height: 2px;
          background: ${stageNum < currentStage || isCompleted ? 'var(--green)' : 'var(--border)'};
          margin: 0 4px;
          align-self: center;
          margin-top: -20px;
        "></div>
      `
                        : '';

                return `
        <div style="display:flex; flex-direction:column; align-items:center; flex:0 0 auto; min-width:60px;">
          <div style="
            width:28px; height:28px; border-radius:50%;
            display:flex; align-items:center; justify-content:center;
            border:2px solid transparent;
            ${circleStyle}
            transition: all 0.3s ease;
          ">${iconHtml}</div>
          <div style="
            font-size:11px; font-weight:500; color:var(--text-secondary);
            text-align:center; margin-top:6px; max-width:80px;
            line-height:1.3;
          ">${stage.label}</div>
          ${stage.department ? `<div style="font-size:10px; color:var(--text-light); text-align:center; margin-top:2px;">${stage.department}</div>` : ''}
        </div>
        ${connectorHtml}
      `;
            })
            .join('');

        return `
      <div style="
        display:flex; align-items:flex-start; gap:0;
        padding:16px 0; overflow-x:auto;
        -webkit-overflow-scrolling: touch;
      ">
        ${stageItems}
      </div>
    `;
    }

    /**
     * Time Ago — human-readable relative time
     * @param {string} dateString - ISO date string
     * @returns {string} e.g., "2 min ago", "1 hour ago", "Yesterday"
     */
    function timeAgo(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);

        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin} min ago`;
        if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        if (diffDay === 1) return 'Yesterday';
        if (diffDay < 7) return `${diffDay} days ago`;
        if (diffWeek < 5) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
        if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
        return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
    }

    /**
     * Loading Spinner
     * @param {string} size - 'sm' | 'md' | 'lg'
     * @returns {string} HTML string
     */
    function spinner(size = 'md') {
        const sizeMap = { sm: '20px', md: '36px', lg: '56px' };
        const borderWidth = size === 'sm' ? '2px' : size === 'lg' ? '5px' : '3px';
        const s = sizeMap[size] || sizeMap.md;

        return `
      <div style="display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="
          width:${s}; height:${s};
          border:${borderWidth} solid var(--border);
          border-top-color: var(--saffron);
          border-radius:50%;
          animation: ekraahSpin 0.7s linear infinite;
        "></div>
      </div>
    `;
    }

    /**
     * Skeleton Loading Placeholder
     * @param {string} type - 'card' | 'list-item' | 'text'
     * @returns {string} HTML string
     */
    function skeleton(type = 'card') {
        const shimmerStyle = `
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: ekraahShimmer 1.5s ease-in-out infinite;
      border-radius: 6px;
    `;

        switch (type) {
            case 'card':
                return `
          <div style="background:#fff; border-radius:12px; padding:16px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
            <div style="${shimmerStyle} width:52px; height:52px; border-radius:12px; margin-bottom:12px;"></div>
            <div style="${shimmerStyle} width:70%; height:14px; margin-bottom:8px;"></div>
            <div style="${shimmerStyle} width:50%; height:12px;"></div>
          </div>
        `;

            case 'list-item':
                return `
          <div style="display:flex; align-items:center; gap:12px; padding:12px 0;">
            <div style="${shimmerStyle} width:44px; height:44px; border-radius:50%; flex-shrink:0;"></div>
            <div style="flex:1;">
              <div style="${shimmerStyle} width:60%; height:14px; margin-bottom:8px;"></div>
              <div style="${shimmerStyle} width:40%; height:12px;"></div>
            </div>
          </div>
        `;

            case 'text':
                return `
          <div style="padding:4px 0;">
            <div style="${shimmerStyle} width:100%; height:14px; margin-bottom:8px;"></div>
            <div style="${shimmerStyle} width:85%; height:14px; margin-bottom:8px;"></div>
            <div style="${shimmerStyle} width:65%; height:14px;"></div>
          </div>
        `;

            default:
                return '';
        }
    }

    /**
     * App Logo
     * @param {string} type - 'full' or 'mini'
     * @returns {string} HTML string
     */
    function logo(type = 'full') {
        if (type === 'mini') {
            return `<img src="assets/mini-logo.png" alt="ekRAAH" style="width:36px; height:36px; object-fit:contain;">`;
        }
        return `<img src="assets/full-logo.png" alt="ekRAAH" style="width:120px; height:auto; object-fit:contain;">`;
    }

    /**
     * Format Date — human-readable date string
     * @param {string} dateString - ISO date string
     * @returns {string} e.g., "12 Jan 2025, 3:45 PM"
     */
    function formatDate(dateString) {
        if (!dateString) return '';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const day = date.getDate();
        const month = months[date.getMonth()];
        const year = date.getFullYear();

        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const minStr = minutes < 10 ? `0${minutes}` : minutes;

        return `${day} ${month} ${year}, ${hours}:${minStr} ${ampm}`;
    }

    return {
        tricolourBar,
        statusBadge,
        statusTrack,
        timeAgo,
        spinner,
        skeleton,
        logo,
        formatDate,
        STATUS_COLORS,
    };
})();

/* ==========================================================================
   8. INITIALIZATION
   ========================================================================== */

(function initEkraahComponents() {
    const State = () => window.EkraahState;
    const DB = () => window.EkraahDBHelpers;
    const Auth = () => window.EkraahAuth;
    const Router = () => window.EkraahRouter;

    /* ── PWA Install Prompt Handler ── */
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the default mini-infobar
        e.preventDefault();
        deferredPrompt = e;

        // Check if user already dismissed this session
        const dismissed = State()?.get('pwaDismissed');
        if (dismissed) return;

        // Only show the PWA install banner on the Welcome page
        const currentRoute = Router()?.getCurrentRoute?.() || window.location.hash.replace('#', '') || '/';
        const isWelcomePage = currentRoute === '/welcome' || currentRoute === '/';
        if (!isWelcomePage) return;

        const banner = document.getElementById('pwa-banner');
        if (banner) {
            banner.style.display = 'flex';
        }
    });

    // PWA Install button
    document.addEventListener('click', async (e) => {
        // Install button
        if (e.target.closest('#pwa-install-btn')) {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;

            if (outcome === 'accepted') {
                window.EkraahToast?.show('ekRAAH has been installed!', 'success');
            }

            deferredPrompt = null;

            // Hide banner
            const banner = document.getElementById('pwa-banner');
            if (banner) banner.style.display = 'none';
        }

        // Dismiss button
        if (e.target.closest('#pwa-dismiss-btn')) {
            const banner = document.getElementById('pwa-banner');
            if (banner) banner.style.display = 'none';

            // Remember dismissal for this session
            State()?.set('pwaDismissed', true);
            sessionStorage.setItem('ekraah_pwa_dismissed', 'true');
        }
    });

    // Hide PWA banner if app is already installed
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        const banner = document.getElementById('pwa-banner');
        if (banner) banner.style.display = 'none';
    });

    // Hide PWA banner when navigating away from the Welcome page
    window.addEventListener('hashchange', () => {
        const currentRoute = window.location.hash.replace('#', '') || '/';
        const isWelcomePage = currentRoute === '/welcome' || currentRoute === '/';
        const banner = document.getElementById('pwa-banner');
        if (banner && !isWelcomePage) {
            banner.style.display = 'none';
        } else if (banner && isWelcomePage && deferredPrompt) {
            const dismissed = State()?.get('pwaDismissed');
            if (!dismissed) banner.style.display = 'flex';
        }
    });

    /* ── Notification Subscription on Login ── */
    if (Auth()?.onAuthStateChange) {
        Auth().onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const userId = session.user.id;

                // Subscribe to realtime notifications
                if (DB()?.subscribeToNotifications) {
                    DB().subscribeToNotifications(userId, (newNotif) => {
                        // Show toast for new notification
                        window.EkraahToast?.show(newNotif.title || 'New notification', 'info', 3000);

                        // Refresh notification state
                        const current = State()?.get('notifications') || [];
                        State()?.set('notifications', [newNotif, ...current]);
                    });
                }

                // Load initial notifications
                try {
                    if (DB()?.getNotifications) {
                        const notifs = await DB().getNotifications(userId);
                        State()?.set('notifications', notifs);
                    }
                } catch (err) {
                    console.error('Error loading initial notifications:', err);
                }
            }

            if (event === 'SIGNED_OUT') {
                // Clean up realtime channels on sign-out
                if (DB()?.unsubscribeAllNotifications) {
                    DB().unsubscribeAllNotifications();
                }
                State()?.set('notifications', []);
            }
        });
    }
})();

/* ==========================================================================
   9. CSS ANIMATIONS (injected once)
   ========================================================================== */

(function injectComponentAnimations() {
    // Avoid duplicate injection
    if (document.getElementById('ekraah-component-animations')) return;

    const style = document.createElement('style');
    style.id = 'ekraah-component-animations';
    style.textContent = `
    /* Toast animations */
    @keyframes toastSlideIn {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    @keyframes toastSlideOut {
      from { transform: translateX(0);    opacity: 1; }
      to   { transform: translateX(100%); opacity: 0; }
    }
    @keyframes toastProgress {
      from { width: 100%; }
      to   { width: 0%; }
    }

    /* Toast container positioning */
    .toast-container {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 500;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      max-width: 380px;
      width: calc(100% - 32px);
    }
    .toast-container .toast {
      pointer-events: auto;
    }

    /* Chatbot FAB */
    .chatbot-fab {
      position: fixed;
      bottom: calc(56px + 16px + env(safe-area-inset-bottom, 0px));
      right: 16px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--saffron), var(--saffron-dark));
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(255,153,51,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 200;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .chatbot-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(255,153,51,0.5);
    }
    .chatbot-fab:active {
      transform: scale(0.95);
    }

    /* Chatbot Panel */
    .chatbot-panel {
      position: fixed;
      bottom: calc(56px + 80px + env(safe-area-inset-bottom, 0px));
      right: 16px;
      width: 340px;
      max-width: calc(100vw - 32px);
      height: 460px;
      max-height: calc(100vh - 200px);
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      display: none;
      flex-direction: column;
      z-index: 200;
      transform: scale(0.9) translateY(20px);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
      overflow: hidden;
    }
    .chatbot-panel.open {
      transform: scale(1) translateY(0);
      opacity: 1;
    }

    /* Chatbot Header */
    .chatbot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
      background: #fff;
    }

    /* Chatbot Messages */
    .chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* Chat Message Bubbles */
    .chat-message {
      display: flex;
      gap: 8px;
      max-width: 85%;
      animation: chatMsgIn 0.3s ease both;
    }
    .chat-message.bot-message {
      align-self: flex-start;
    }
    .chat-message.user-message {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    .chat-message-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--saffron), var(--saffron-dark));
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      color: #fff;
      font-size: 12px;
    }
    .chat-message-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bot-message .chat-message-bubble {
      background: var(--bg-page);
      color: var(--text-primary);
      border-bottom-left-radius: 4px;
    }
    .user-message .chat-message-bubble {
      background: linear-gradient(135deg, var(--saffron), var(--saffron-dark));
      color: #fff;
      border-bottom-right-radius: 4px;
    }

    @keyframes chatMsgIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Chat Option Buttons */
    .chat-options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 4px 0;
    }
    .chat-option-btn {
      padding: 8px 14px;
      border: 1.5px solid var(--border);
      border-radius: 20px;
      background: #fff;
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .chat-option-btn:hover {
      border-color: var(--saffron);
      color: var(--saffron);
      background: var(--light-saffron);
    }
    .chat-option-btn:active {
      transform: scale(0.96);
    }

    /* Chat Action Button (inside bot message) */
    .chat-action-btn {
      display: inline-flex;
      align-items: center;
      padding: 6px 14px;
      background: var(--saffron);
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease;
      align-self: flex-start;
    }
    .chat-action-btn:hover {
      background: var(--saffron-dark);
    }

    /* Modal styles */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 399;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .modal-backdrop.active {
      opacity: 1;
    }
    .modal-wrapper {
      position: fixed;
      inset: 0;
      z-index: 400;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    .modal-wrapper.active {
      opacity: 1;
    }
    .modal {
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      transform: translateY(20px) scale(0.95);
      transition: transform 0.3s ease;
      overflow: hidden;
    }
    .modal-wrapper.active .modal {
      transform: translateY(0) scale(1);
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 20px;
      border-bottom: 1px solid var(--border);
    }
    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
    }
    .modal-body {
      padding: 20px;
      overflow-y: auto;
      flex: 1;
    }
    .modal-footer {
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    /* Spinner animation */
    @keyframes ekraahSpin {
      to { transform: rotate(360deg); }
    }

    /* Skeleton shimmer animation */
    @keyframes ekraahShimmer {
      0%   { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    /* PWA Install Banner */
    .pwa-banner {
      position: fixed;
      bottom: calc(var(--bottom-nav-height) + env(safe-area-inset-bottom, 0px) + 12px);
      left: 12px;
      right: 12px;
      background: var(--bg-white);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4);
      z-index: var(--z-overlay);
      animation: slideUp 0.4s ease both;
      border: 1px solid var(--border);
    }
    .pwa-banner-content {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--text-primary);
    }
    .pwa-banner-content i {
      color: var(--saffron);
      font-size: 18px;
    }
    .pwa-banner-actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    /* General slide up animation */
    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
  `;

    document.head.appendChild(style);
})();
