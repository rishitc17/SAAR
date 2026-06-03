/**
 * ekRAAH - Citizen Pages Module
 *
 * Registers routes for all citizen-facing pages:
 *   /citizen/home
 *   /citizen/application/:slug
 *   /citizen/services
 *   /citizen/applications
 *   /citizen/application-detail/:id
 *   /citizen/documents
 *   /citizen/profile
 *
 * Each route handler renders HTML into #app and attaches event listeners.
 * Returns a cleanup function to remove listeners on navigation.
 */

(function () {
  'use strict';

  // ── Shorthand references ──
  const Router  = () => window.EkraahRouter;
  const Auth    = () => window.EkraahAuth;
  const State   = () => window.EkraahState;
  const DB      = () => window.EkraahDB;
  const DBH     = () => window.EkraahDBHelpers;
  const Toast   = () => window.EkraahToast;
  const Comp    = () => window.EkraahComponents;
  const Nav     = () => window.EkraahBottomNav;
  const Notif   = () => window.EkraahNotifications;
  const Chatbot = () => window.EkraahChatbot;
  const Modal   = () => window.EkraahModal;

  // ═══════════════════════════════════════════════════════════════════════
  // SHARED CONSTANTS
  // ═══════════════════════════════════════════════════════════════════════

  const citizenNavItems = [
    { label: 'Home', icon: 'fas fa-house', route: '/citizen/home' },
    { label: 'Services', icon: 'fas fa-table-cells-large', route: '/citizen/services' },
    { label: 'Applications', icon: 'fas fa-file-lines', route: '/citizen/applications' },
    { label: 'Profile', icon: 'fas fa-user', route: '/citizen/profile' }
  ];

  const CATEGORIES = ['Transport', 'Legal', 'Identity', 'Revenue', 'Health', 'Municipal', 'Welfare', 'Tax'];

  const CATEGORY_ICONS = {
    Transport: 'fa-bus',
    Legal: 'fa-scale-balanced',
    Identity: 'fa-fingerprint',
    Revenue: 'fa-landmark',
    Health: 'fa-heart-pulse',
    Municipal: 'fa-city',
    Welfare: 'fa-hand-holding-heart',
    Tax: 'fa-receipt'
  };

  // ── Hardcoded fallback application types ──
  const HARDCODED_APP_TYPES = [
    {
      id: 'hc-vehicle-reg',
      name: 'Vehicle Registration',
      slug: 'vehicle-registration',
      description: 'Register a new or used vehicle with the Regional Transport Office.',
      category: 'Transport',
      icon: 'fa-car',
      color: '#1a73e8',
      is_active: true,
      workflow_type: 'department_chain',
      workflow_config: {
        stages: [
          { stage: 1, department: 'Transport Department', label: 'Application Intake' },
          { stage: 2, department: 'Police Department', label: 'Vehicle Background Check' },
          { stage: 3, department: 'Transport Department', label: 'Registration Issuance' }
        ]
      },
      form_fields: [
        { name: 'full_name', label: 'Full Name', type: 'text', required: true },
        { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
        { name: 'address', label: 'Address', type: 'textarea', required: true },
        { name: 'vehicle_make', label: 'Vehicle Make', type: 'text', required: true },
        { name: 'vehicle_model', label: 'Vehicle Model', type: 'text', required: true },
        { name: 'year_of_manufacture', label: 'Year of Manufacture', type: 'number', required: true },
        { name: 'chassis_number', label: 'Chassis Number', type: 'text', required: true },
        { name: 'engine_number', label: 'Engine Number', type: 'text', required: true },
        { name: 'vehicle_color', label: 'Vehicle Color', type: 'text', required: true },
        { name: 'fuel_type', label: 'Fuel Type', type: 'select', required: true, options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] },
        { name: 'insurance_policy_number', label: 'Insurance Policy Number', type: 'text', required: true },
        { name: 'insurance_expiry_date', label: 'Insurance Expiry Date', type: 'date', required: true },
        { name: 'previous_owner_name', label: 'Previous Owner Name (if used)', type: 'text', required: false },
        { name: 'previous_owner_contact', label: 'Previous Owner Contact', type: 'text', required: false },
        { name: 'purchase_date', label: 'Purchase Date', type: 'date', required: true },
        { name: 'purchase_price', label: 'Purchase Price', type: 'number', required: true }
      ]
    },
    {
      id: 'hc-land-dispute',
      name: 'Land Dispute Case',
      slug: 'land-dispute',
      description: 'File a land dispute case and get matched with a qualified lawyer.',
      category: 'Legal',
      icon: 'fa-gavel',
      color: '#2e7d32',
      is_active: true,
      workflow_type: 'lawyer_assignment',
      workflow_config: { lawyer_specialization: 'Land Disputes' },
      form_fields: [
        { name: 'full_name', label: 'Full Name', type: 'text', required: true },
        { name: 'address', label: 'Address', type: 'textarea', required: true },
        { name: 'dispute_location', label: 'Dispute Location', type: 'textarea', required: true },
        { name: 'survey_number', label: 'Survey Number', type: 'text', required: true },
        { name: 'land_area', label: 'Land Area (in acres)', type: 'number', required: true },
        { name: 'dispute_description', label: 'Dispute Description', type: 'textarea', required: true },
        { name: 'opposing_party_name', label: 'Opposing Party Name', type: 'text', required: true },
        { name: 'opposing_party_address', label: 'Opposing Party Address', type: 'textarea', required: true },
        { name: 'duration_of_dispute', label: 'Duration of Dispute', type: 'select', required: true, options: ['Less than 1 year', '1-3 years', '3-5 years', 'More than 5 years'] },
        { name: 'previous_legal_action', label: 'Any Previous Legal Action?', type: 'select', required: true, options: ['None', 'District Court', 'High Court', 'Supreme Court', 'Tribunal'] },
        { name: 'expected_resolution', label: 'Expected Resolution', type: 'textarea', required: true }
      ]
    },
    // Coming Soon apps
    { id: 'hc-driving-license', name: 'Driving License', slug: 'driving-license', category: 'Transport', icon: 'fa-car', color: '#1565c0', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-birth-cert', name: 'Birth Certificate', slug: 'birth-certificate', category: 'Identity', icon: 'fa-certificate', color: '#e91e63', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-death-cert', name: 'Death Certificate', slug: 'death-certificate', category: 'Identity', icon: 'fa-scroll', color: '#757575', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-passport', name: 'Passport Application', slug: 'passport-application', category: 'Identity', icon: 'fa-plane-departure', color: '#ff6f00', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-pan-card', name: 'PAN Card', slug: 'pan-card', category: 'Tax', icon: 'fa-credit-card', color: '#4a148c', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-property-tax', name: 'Property Tax', slug: 'property-tax', category: 'Revenue', icon: 'fa-building', color: '#33691e', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-health-ins', name: 'Health Insurance', slug: 'health-insurance', category: 'Health', icon: 'fa-heart-pulse', color: '#c62828', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-trade-lic', name: 'Trade License', slug: 'trade-license', category: 'Municipal', icon: 'fa-store', color: '#00695c', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-pension', name: 'Pension Application', slug: 'pension-application', category: 'Welfare', icon: 'fa-hand-holding-heart', color: '#bf360c', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] },
    { id: 'hc-fir', name: 'FIR Filing', slug: 'fir-filing', category: 'Legal', icon: 'fa-triangle-exclamation', color: '#880e4f', is_active: false, workflow_type: 'department_chain', workflow_config: {}, form_fields: [] }
  ];

  // ── Language options (shared with auth.js) ──
  const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: '\u0939\u093F\u0902\u0926\u0940 (Hindi)' },
    { code: 'bn', label: '\u09AC\u09BE\u0982\u09B2\u09BE (Bengali)' },
    { code: 'te', label: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41 (Telugu)' },
    { code: 'ta', label: '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD (Tamil)' },
    { code: 'mr', label: '\u092E\u0930\u093E\u0920\u0940 (Marathi)' },
    { code: 'gu', label: '\u0A97\u0AC1\u0A9C\u0AB0\u0ABE\u0AA4\u0AC0 (Gujarati)' },
    { code: 'kn', label: '\u0C95\u0CA8\u0CCD\u0CA8\u0CA1 (Kannada)' },
    { code: 'ml', label: '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02 (Malayalam)' },
    { code: 'pa', label: '\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40 (Punjabi)' },
    { code: 'ur', label: '\u0627\u0631\u062F\u0648 (Urdu)' },
    { code: 'or', label: '\u0B13\u0B21\u0B3C\u0B3F\u0B06 (Odia)' }
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // SHARED HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Fetch application types from DB, fall back to hardcoded
   */
  async function fetchAppTypes() {
    try {
      if (DBH()) {
        const active = await DBH().getActiveApplicationTypes();
        const all = await DBH().getApplicationTypes();
        return { active: active || [], all: all || [] };
      }
    } catch (err) {
      console.warn('Failed to fetch app types from DB, using fallback:', err);
    }
    return {
      active: HARDCODED_APP_TYPES.filter(a => a.is_active),
      all: HARDCODED_APP_TYPES
    };
  }

  /**
   * Get app type by slug from either DB data or fallback
   */
  async function getAppTypeBySlug(slug) {
    try {
      if (DBH()) {
        const data = await DBH().getApplicationTypeBySlug(slug);
        if (data) return data;
      }
    } catch (err) {
      console.warn('Failed to fetch app type by slug, using fallback:', err);
    }
    return HARDCODED_APP_TYPES.find(a => a.slug === slug) || null;
  }

  /**
   * Render a single app tile for the home/services grid
   */
  function renderAppTile(app) {
    const isActive = app.is_active;
    const iconClass = app.icon ? `fas ${app.icon}` : 'fas fa-file';
    const color = app.color || '#1a73e8';
    const lighterColor = lightenColor(color, 0.15);

    return `
      <div class="app-tile" data-slug="${app.slug}" data-active="${isActive}" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        padding: 12px 8px;
        border-radius: 12px;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        min-width: 80px;
        max-width: 90px;
        flex: 1;
      " onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseleave="this.style.transform='';this.style.boxShadow=''">
        <div style="
          width: 56px;
          height: 56px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, ${color}, ${lighterColor});
          box-shadow: 0 4px 12px ${color}33;
          position: relative;
        ">
          <i class="${iconClass}" style="font-size: 22px; color: #fff;"></i>
          ${!isActive ? '<span style="position:absolute;bottom:-2px;right:-2px;width:16px;height:16px;background:#ff9800;border-radius:50%;display:flex;align-items:center;justify-content:center;"><i class="fas fa-clock" style="font-size:8px;color:#fff;"></i></span>' : ''}
        </div>
        <span style="
          font-size: 11px;
          font-weight: 500;
          color: var(--text-primary);
          text-align: center;
          line-height: 1.3;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        ">${app.name}</span>
      </div>
    `;
  }

  /**
   * Lighten a hex color by a given factor (0-1)
   */
  function lightenColor(hex, factor) {
    if (!hex || !hex.startsWith('#')) return hex;
    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.round(255 * factor));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * factor));
    const b = Math.min(255, (num & 0xff) + Math.round(255 * factor));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  /**
   * Validation helper: set inline error on a form group
   */
  function setFieldError(groupId, message) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.classList.add('error');
    const existing = group.querySelector('.form-error');
    if (existing) existing.remove();
    if (message) {
      const errEl = document.createElement('span');
      errEl.className = 'form-error';
      errEl.textContent = message;
      group.appendChild(errEl);
    }
  }

  /**
   * Validation helper: clear inline error on a form group
   */
  function clearFieldError(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.classList.remove('error');
    const existing = group.querySelector('.form-error');
    if (existing) existing.remove();
  }

  /**
   * Get current citizen ID from state
   */
  function getCitizenId() {
    const user = State()?.get('currentUser');
    const profile = State()?.get('profile');
    return user?.id || profile?.id;
  }

  /**
   * Pretty-print a form field key
   */
  function prettifyKey(key) {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Render the notification bell button (shared across pages)
   */
  function renderNotifBell() {
    return Notif()?.renderBell() || '';
  }

  /**
   * Attach the notification bell listener
   */
  function attachNotifBell() {
    const bellBtn = document.getElementById('notification-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => {
        Notif()?.toggle();
      });
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 1. CITIZEN HOME PAGE  (/citizen/home)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderCitizenHome(params) {
    const allowed = await Auth().requireRole('citizen');
    if (!allowed) return;

    const app = document.getElementById('app');
    const profile = State()?.get('profile') || {};

    // Show skeleton while loading
    app.innerHTML = `
      <div class="page citizen-home-page">
        ${Comp().tricolourBar()}
        ${Comp().spinner('lg')}
      </div>
    `;

    // Fetch app types
    const { active, all } = await fetchAppTypes();

    // Build category sections
    const categorySections = CATEGORIES.map(cat => {
      const catApps = all.filter(a => a.category === cat);
      if (catApps.length === 0) return '';
      const catIcon = CATEGORY_ICONS[cat] || 'fa-folder';
      return `
        <div class="category-section" data-category="${cat}">
          <div class="category-header" data-cat-toggle="${cat}" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 0;
            cursor: pointer;
            user-select: none;
          ">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="
                width:28px; height:28px; border-radius:8px;
                background: var(--bg-secondary);
                display:flex; align-items:center; justify-content:center;
              ">
                <i class="fas ${catIcon}" style="font-size:12px; color:var(--saffron);"></i>
              </div>
              <span style="font-size:15px; font-weight:600; color:var(--text-primary);">${cat}</span>
              <span style="font-size:12px; color:var(--text-light);">${catApps.length} service${catApps.length > 1 ? 's' : ''}</span>
            </div>
            <i class="fas fa-chevron-down category-chevron" style="font-size:12px; color:var(--text-light); transition:transform 0.2s;"></i>
          </div>
          <div class="category-apps" data-cat-apps="${cat}" style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding-bottom: 8px;
          ">
            ${catApps.map(a => renderAppTile(a)).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Popular services row
    const popularApps = active.length > 0 ? active : all.filter(a => a.is_active);
    const popularRow = popularApps.map(a => renderAppTile(a)).join('');

    app.innerHTML = `
      <div class="page citizen-home-page" style="padding-bottom:80px;">
        ${Comp().tricolourBar()}

        <!-- Top Bar -->
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-primary);
          position: sticky;
          top: 0;
          z-index: 10;
        ">
          <div style="display:flex; align-items:center; gap:10px;">
            ${Comp().logo('mini')}
            <span style="font-size:18px; font-weight:700; color:var(--text-primary);">Services</span>
          </div>
          ${renderNotifBell()}
        </div>

        <!-- Search Bar -->
        <div style="padding:0 16px 8px;">
          <div style="
            position:relative;
            display:flex;
            align-items:center;
          ">
            <i class="fas fa-search" style="
              position:absolute; left:14px; top:50%; transform:translateY(-50%);
              color:var(--text-light); font-size:14px;
            "></i>
            <input type="text" id="home-search" placeholder="Search services..." style="
              width:100%;
              padding:10px 14px 10px 40px;
              border:1.5px solid var(--border);
              border-radius:10px;
              font-size:14px;
              background:var(--bg-secondary);
              color:var(--text-primary);
              outline:none;
              transition:border-color 0.2s;
            " onfocus="this.style.borderColor='var(--saffron)'" onblur="this.style.borderColor='var(--border)'" />
          </div>
        </div>

        <!-- Popular Services -->
        <div id="popular-section" style="padding:8px 16px 0;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <span style="font-size:15px; font-weight:600; color:var(--text-primary);">Popular Services</span>
            <span style="font-size:12px; color:var(--saffron); font-weight:500; cursor:pointer;">See all</span>
          </div>
          <div id="popular-apps-row" style="
            display:flex;
            gap:8px;
            overflow-x:auto;
            padding-bottom:8px;
            -webkit-overflow-scrolling:touch;
            scrollbar-width:none;
          ">
            ${popularRow || '<span style="color:var(--text-light);font-size:13px;">No active services yet</span>'}
          </div>
        </div>

        <!-- Search Results (hidden by default) -->
        <div id="search-results" style="padding:8px 16px; display:none;">
          <span style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:8px; display:block;">Search Results</span>
          <div id="search-results-apps" style="
            display:flex;
            flex-wrap:wrap;
            gap:8px;
          "></div>
        </div>

        <!-- Category Sections -->
        <div id="categories-container" style="padding:0 16px;">
          ${categorySections}
        </div>

        <!-- Bottom Nav -->
        ${Nav().render(citizenNavItems, 0)}

        <!-- Chatbot -->
        ${Chatbot().render()}

        <!-- Notification Panel -->
        <div id="notification-panel" class="notification-panel" style="display:none;"></div>
        <div id="notification-overlay" class="notification-overlay" style="display:none;"></div>
      </div>
    `;

    // ── Event listeners ──
    const searchInput = document.getElementById('home-search');
    const popularSection = document.getElementById('popular-section');
    const categoriesContainer = document.getElementById('categories-container');
    const searchResults = document.getElementById('search-results');
    const searchResultsApps = document.getElementById('search-results-apps');

    function onSearchInput() {
      const query = searchInput.value.trim().toLowerCase();
      if (query.length === 0) {
        // Show normal layout
        popularSection.style.display = '';
        categoriesContainer.style.display = '';
        searchResults.style.display = 'none';
        // Show all category headers
        document.querySelectorAll('.category-header').forEach(h => h.style.display = '');
        return;
      }

      // Search mode
      popularSection.style.display = 'none';
      categoriesContainer.style.display = 'none';
      searchResults.style.display = '';

      const matches = all.filter(a => a.name.toLowerCase().includes(query));
      searchResultsApps.innerHTML = matches.length > 0
        ? matches.map(a => renderAppTile(a)).join('')
        : '<span style="color:var(--text-light);font-size:13px;">No services found</span>';

      // Re-attach click listeners for search results
      requestAnimationFrame(() => attachAppTileListeners());
    }

    function onAppTileClick(e) {
      const tile = e.target.closest('.app-tile');
      if (!tile) return;

      const slug = tile.getAttribute('data-slug');
      const isActive = tile.getAttribute('data-active') === 'true';

      if (isActive) {
        Router().navigate('/citizen/application/' + slug);
      } else {
        Toast().show('Coming Soon! This service will be available shortly.', 'info');
      }
    }

    function attachAppTileListeners() {
      document.querySelectorAll('.app-tile').forEach(tile => {
        tile.addEventListener('click', onAppTileClick);
      });
    }

    function onCategoryToggle(e) {
      const header = e.target.closest('.category-header');
      if (!header) return;
      const cat = header.getAttribute('data-cat-toggle');
      const apps = document.querySelector(`[data-cat-apps="${cat}"]`);
      const chevron = header.querySelector('.category-chevron');
      if (apps) {
        const isHidden = apps.style.display === 'none';
        apps.style.display = isHidden ? 'flex' : 'none';
        if (chevron) {
          chevron.style.transform = isHidden ? '' : 'rotate(-90deg)';
        }
      }
    }

    searchInput.addEventListener('input', onSearchInput);
    document.querySelectorAll('.category-header').forEach(h => {
      h.addEventListener('click', onCategoryToggle);
    });

    attachNotifBell();
    Chatbot().initFabListener();
    requestAnimationFrame(() => attachAppTileListeners());

    // Cleanup
    return function cleanup() {
      searchInput.removeEventListener('input', onSearchInput);
      document.querySelectorAll('.category-header').forEach(h => {
        h.removeEventListener('click', onCategoryToggle);
      });
      document.querySelectorAll('.app-tile').forEach(tile => {
        tile.removeEventListener('click', onAppTileClick);
      });
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 2. APPLICATION PAGE  (/citizen/application/:slug)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderApplicationPage(params) {
    const allowed = await Auth().requireRole('citizen');
    if (!allowed) return;

    const slug = params.slug;
    const app = document.getElementById('app');

    // Show loading
    app.innerHTML = `
      <div class="page" style="min-height:100vh; display:flex; align-items:center; justify-content:center;">
        ${Comp().spinner('lg')}
      </div>
    `;

    const appType = await getAppTypeBySlug(slug);

    if (!appType) {
      Toast().show('Coming Soon! This service will be available shortly.', 'info');
      Router().navigate('/citizen/home');
      return;
    }

    // Check if this is a supported active slug
    if (!appType.is_active && slug !== 'vehicle-registration' && slug !== 'land-dispute') {
      Toast().show('Coming Soon! This service will be available shortly.', 'info');
      Router().navigate('/citizen/home');
      return;
    }

    const iconClass = appType.icon ? `fas ${appType.icon}` : 'fas fa-file';
    const color = appType.color || '#1a73e8';
    const lighterColor = lightenColor(color, 0.15);

    // Build form fields HTML based on slug
    let formFieldsHtml = '';

    if (slug === 'vehicle-registration') {
      formFieldsHtml = renderVehicleRegistrationForm();
    } else if (slug === 'land-dispute') {
      formFieldsHtml = renderLandDisputeForm();
    } else {
      // Generic form from form_fields
      formFieldsHtml = renderGenericForm(appType.form_fields || []);
    }

    app.innerHTML = `
      <div class="page application-page">
        ${Comp().tricolourBar()}

        <!-- Top Bar -->
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; background:var(--bg-primary);
          position:sticky; top:0; z-index:10;
          border-bottom:1px solid var(--border);
        ">
          <button id="app-back-btn" style="
            background:none; border:none; cursor:pointer;
            display:flex; align-items:center; gap:6px;
            color:var(--text-primary); font-size:16px; font-weight:500;
          ">
            <i class="fas fa-arrow-left"></i>
            <span>Back</span>
          </button>
          <span style="font-size:16px; font-weight:600; color:var(--text-primary);">${appType.name}</span>
          ${Comp().logo('mini')}
        </div>

        <!-- Service Header -->
        <div style="padding:20px 16px 12px; text-align:center;">
          <div style="
            width:64px; height:64px; border-radius:16px; margin:0 auto 12px;
            background:linear-gradient(135deg, ${color}, ${lighterColor});
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 6px 20px ${color}44;
          ">
            <i class="${iconClass}" style="font-size:28px; color:#fff;"></i>
          </div>
          <h2 style="font-size:18px; font-weight:700; color:var(--text-primary); margin:0 0 4px;">${appType.name}</h2>
          ${appType.description ? `<p style="font-size:13px; color:var(--text-secondary); margin:0; line-height:1.5;">${appType.description}</p>` : ''}
        </div>

        <!-- Form -->
        <form id="application-form" novalidate style="padding:0 16px 24px;">
          ${formFieldsHtml}

          <!-- Submit Button -->
          <button type="submit" id="btn-submit-app" style="
            display:flex; align-items:center; justify-content:center;
            width:100%; padding:14px; margin-top:24px;
            font-size:16px; font-weight:600; color:#fff;
            background:linear-gradient(135deg, ${color}, ${lighterColor});
            border:none; border-radius:12px;
            box-shadow:0 4px 14px ${color}44;
            cursor:pointer;
            transition:transform 0.15s, box-shadow 0.15s, opacity 0.15s;
          " onmouseenter="this.style.transform='translateY(-1px)';this.style.boxShadow='0 6px 20px ${color}55'" onmouseleave="this.style.transform='';this.style.boxShadow='0 4px 14px ${color}44'">
            Submit Application
          </button>
        </form>
      </div>
    `;

    // ── Event listeners ──
    const backBtn = document.getElementById('app-back-btn');
    const form = document.getElementById('application-form');
    const submitBtn = document.getElementById('btn-submit-app');

    function onBack() {
      Router().navigate('/citizen/home');
    }

    function onUsedVehicleToggle() {
      const toggle = document.getElementById('is-used-vehicle');
      const prevFields = document.getElementById('prev-owner-fields');
      if (toggle && prevFields) {
        prevFields.style.display = toggle.value === 'yes' ? 'block' : 'none';
      }
    }

    // Character counters
    function attachCharCounter(inputId, maxLen) {
      const input = document.getElementById(inputId);
      const counter = document.getElementById(inputId + '-counter');
      if (!input || !counter) return;
      function update() {
        const len = input.value.length;
        counter.textContent = `${len}/${maxLen}`;
        counter.style.color = len > maxLen ? 'var(--error)' : 'var(--text-light)';
      }
      input.addEventListener('input', update);
      update();
    }

    // Attach specific listeners based on slug
    if (slug === 'vehicle-registration') {
      const usedToggle = document.getElementById('is-used-vehicle');
      if (usedToggle) usedToggle.addEventListener('change', onUsedVehicleToggle);
      attachCharCounter('dispute_description', 500);
      attachCharCounter('expected_resolution', 300);
    } else if (slug === 'land-dispute') {
      attachCharCounter('dispute_description', 500);
      attachCharCounter('expected_resolution', 300);
    }

    backBtn.addEventListener('click', onBack);

    // Form submission
    async function onFormSubmit(e) {
      e.preventDefault();

      // Validate and collect form data
      let formData = {};
      let hasError = false;

      if (slug === 'vehicle-registration') {
        const result = validateAndCollectVehicleForm();
        if (result.errors.length > 0) {
          hasError = true;
        } else {
          formData = result.data;
        }
      } else if (slug === 'land-dispute') {
        const result = validateAndCollectLandDisputeForm();
        if (result.errors.length > 0) {
          hasError = true;
        } else {
          formData = result.data;
        }
      }

      if (hasError) {
        Toast().show('Please fill in all required fields correctly.', 'error');
        return;
      }

      // Disable button
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      submitBtn.style.opacity = '0.7';

      try {
        const citizenId = getCitizenId();
        if (!citizenId) {
          Toast().show('Authentication error. Please log in again.', 'error');
          return;
        }

        const typeId = appType.id;

        if (slug === 'vehicle-registration') {
          // Create application with department chain workflow
          const newApp = await DBH().createApplication(citizenId, typeId, formData, 3, 'submitted');

          // Create stage reviews
          await DBH().createStageReviews(newApp.id, [
            { stage: 1, department: 'Transport Department' },
            { stage: 2, department: 'Police Department' },
            { stage: 3, department: 'Transport Department' }
          ]);

          // Create notification
          await DBH().createNotification(
            citizenId,
            'Application Submitted',
            'Your vehicle registration application has been submitted successfully.',
            'application_submitted',
            newApp.id
          );

          Toast().show('Application submitted successfully!', 'success');
        } else if (slug === 'land-dispute') {
          // Create application with lawyer assignment workflow
          const newApp = await DBH().createApplication(citizenId, typeId, formData, 1, 'lawyer_pending');

          // Create notification
          await DBH().createNotification(
            citizenId,
            'Case Filed',
            'Your land dispute case has been filed and is awaiting a lawyer.',
            'application_submitted',
            newApp.id
          );

          Toast().show('Case filed successfully! Awaiting lawyer assignment.', 'success');
        }

        // Navigate to applications after delay
        setTimeout(() => {
          Router().navigate('/citizen/applications');
        }, 1500);

      } catch (err) {
        console.error('Application submission error:', err);
        Toast().show(err?.message || 'Failed to submit application. Please try again.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
        submitBtn.style.opacity = '1';
      }
    }

    form.addEventListener('submit', onFormSubmit);

    // Cleanup
    return function cleanup() {
      backBtn.removeEventListener('click', onBack);
      form.removeEventListener('submit', onFormSubmit);
      const usedToggle = document.getElementById('is-used-vehicle');
      if (usedToggle) usedToggle.removeEventListener('change', onUsedVehicleToggle);
    };
  }

  // ── Vehicle Registration Form HTML ──
  function renderVehicleRegistrationForm() {
    return `
      <!-- Full Name -->
      <div class="form-group" id="fg-vr-fullname">
        <label class="form-label" for="vr-fullname">Full Name <span class="required">*</span></label>
        <input type="text" id="vr-fullname" class="form-input" placeholder="Enter your full name" required />
      </div>

      <!-- Date of Birth -->
      <div class="form-group" id="fg-vr-dob">
        <label class="form-label" for="vr-dob">Date of Birth <span class="required">*</span></label>
        <input type="date" id="vr-dob" class="form-input" required />
      </div>

      <!-- Address -->
      <div class="form-group" id="fg-vr-address">
        <label class="form-label" for="vr-address">Address <span class="required">*</span></label>
        <textarea id="vr-address" class="form-input" rows="3" placeholder="Enter your address" required></textarea>
      </div>

      <!-- Vehicle Make -->
      <div class="form-group" id="fg-vr-make">
        <label class="form-label" for="vr-make">Vehicle Make <span class="required">*</span></label>
        <input type="text" id="vr-make" class="form-input" placeholder="e.g. Maruti Suzuki, Hyundai" required />
      </div>

      <!-- Vehicle Model -->
      <div class="form-group" id="fg-vr-model">
        <label class="form-label" for="vr-model">Vehicle Model <span class="required">*</span></label>
        <input type="text" id="vr-model" class="form-input" placeholder="e.g. Swift, Creta" required />
      </div>

      <!-- Year of Manufacture -->
      <div class="form-group" id="fg-vr-year">
        <label class="form-label" for="vr-year">Year of Manufacture <span class="required">*</span></label>
        <input type="number" id="vr-year" class="form-input" min="2000" max="2026" placeholder="e.g. 2023" required />
      </div>

      <!-- Chassis Number -->
      <div class="form-group" id="fg-vr-chassis">
        <label class="form-label" for="vr-chassis">Chassis Number <span class="required">*</span></label>
        <input type="text" id="vr-chassis" class="form-input" placeholder="17-character alphanumeric" required maxlength="17" />
        <span class="form-helper" style="font-size:11px; color:var(--text-light); margin-top:4px; display:block;">Must be exactly 17 alphanumeric characters</span>
      </div>

      <!-- Engine Number -->
      <div class="form-group" id="fg-vr-engine">
        <label class="form-label" for="vr-engine">Engine Number <span class="required">*</span></label>
        <input type="text" id="vr-engine" class="form-input" placeholder="Enter engine number" required />
      </div>

      <!-- Vehicle Color -->
      <div class="form-group" id="fg-vr-color">
        <label class="form-label" for="vr-color">Vehicle Color <span class="required">*</span></label>
        <select id="vr-color" class="form-select" required>
          <option value="" disabled selected>Select color</option>
          <option value="White">White</option>
          <option value="Black">Black</option>
          <option value="Silver">Silver</option>
          <option value="Red">Red</option>
          <option value="Blue">Blue</option>
          <option value="Grey">Grey</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <!-- Fuel Type -->
      <div class="form-group" id="fg-vr-fuel">
        <label class="form-label" for="vr-fuel">Fuel Type <span class="required">*</span></label>
        <select id="vr-fuel" class="form-select" required>
          <option value="" disabled selected>Select fuel type</option>
          <option value="Petrol">Petrol</option>
          <option value="Diesel">Diesel</option>
          <option value="CNG">CNG</option>
          <option value="Electric">Electric</option>
          <option value="Hybrid">Hybrid</option>
        </select>
      </div>

      <!-- Insurance Policy Number -->
      <div class="form-group" id="fg-vr-insurance">
        <label class="form-label" for="vr-insurance">Insurance Policy Number <span class="required">*</span></label>
        <input type="text" id="vr-insurance" class="form-input" placeholder="Enter insurance policy number" required />
      </div>

      <!-- Insurance Expiry Date -->
      <div class="form-group" id="fg-vr-insurance-exp">
        <label class="form-label" for="vr-insurance-exp">Insurance Expiry Date <span class="required">*</span></label>
        <input type="date" id="vr-insurance-exp" class="form-input" required />
      </div>

      <!-- Is this a used vehicle? Toggle -->
      <div class="form-group">
        <label class="form-label" for="is-used-vehicle">Is this a used vehicle?</label>
        <select id="is-used-vehicle" class="form-select">
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>

      <!-- Previous Owner Fields (hidden by default) -->
      <div id="prev-owner-fields" style="display:none;">
        <div class="form-group" id="fg-vr-prev-owner">
          <label class="form-label" for="vr-prev-owner">Previous Owner Name <span class="required">*</span></label>
          <input type="text" id="vr-prev-owner" class="form-input" placeholder="Enter previous owner name" />
        </div>

        <div class="form-group" id="fg-vr-prev-contact">
          <label class="form-label" for="vr-prev-contact">Previous Owner Contact <span class="required">*</span></label>
          <input type="text" id="vr-prev-contact" class="form-input" placeholder="Enter previous owner contact" />
        </div>
      </div>

      <!-- Purchase Date -->
      <div class="form-group" id="fg-vr-purchase-date">
        <label class="form-label" for="vr-purchase-date">Purchase Date <span class="required">*</span></label>
        <input type="date" id="vr-purchase-date" class="form-input" required />
      </div>

      <!-- Purchase Price -->
      <div class="form-group" id="fg-vr-price">
        <label class="form-label" for="vr-price">Purchase Price <span class="required">*</span></label>
        <input type="number" id="vr-price" class="form-input" placeholder="Enter purchase price" required />
      </div>
    `;
  }

  // ── Land Dispute Form HTML ──
  function renderLandDisputeForm() {
    return `
      <!-- Full Name -->
      <div class="form-group" id="fg-ld-fullname">
        <label class="form-label" for="ld-fullname">Full Name <span class="required">*</span></label>
        <input type="text" id="ld-fullname" class="form-input" placeholder="Enter your full name" required />
      </div>

      <!-- Address -->
      <div class="form-group" id="fg-ld-address">
        <label class="form-label" for="ld-address">Address <span class="required">*</span></label>
        <textarea id="ld-address" class="form-input" rows="3" placeholder="Enter your address" required></textarea>
      </div>

      <!-- Dispute Location -->
      <div class="form-group" id="fg-ld-location">
        <label class="form-label" for="ld-location">Dispute Location <span class="required">*</span></label>
        <textarea id="ld-location" class="form-input" rows="3" placeholder="Enter the location of the disputed land" required></textarea>
      </div>

      <!-- Survey Number -->
      <div class="form-group" id="fg-ld-survey">
        <label class="form-label" for="ld-survey">Survey Number <span class="required">*</span></label>
        <input type="text" id="ld-survey" class="form-input" placeholder="Enter survey number" required />
      </div>

      <!-- Land Area -->
      <div class="form-group" id="fg-ld-area">
        <label class="form-label" for="ld-area">Land Area (in acres) <span class="required">*</span></label>
        <input type="number" id="ld-area" class="form-input" step="0.01" placeholder="e.g. 2.5" required />
      </div>

      <!-- Dispute Description -->
      <div class="form-group" id="fg-ld-description">
        <label class="form-label" for="dispute_description">Dispute Description <span class="required">*</span></label>
        <textarea id="dispute_description" class="form-input" rows="4" maxlength="500" placeholder="Describe the dispute in detail" required></textarea>
        <span id="dispute_description-counter" style="font-size:11px; color:var(--text-light); display:block; text-align:right; margin-top:4px;">0/500</span>
      </div>

      <!-- Opposing Party Name -->
      <div class="form-group" id="fg-ld-opposing-name">
        <label class="form-label" for="ld-opposing-name">Opposing Party Name <span class="required">*</span></label>
        <input type="text" id="ld-opposing-name" class="form-input" placeholder="Enter opposing party name" required />
      </div>

      <!-- Opposing Party Address -->
      <div class="form-group" id="fg-ld-opposing-address">
        <label class="form-label" for="ld-opposing-address">Opposing Party Address <span class="required">*</span></label>
        <textarea id="ld-opposing-address" class="form-input" rows="3" placeholder="Enter opposing party address" required></textarea>
      </div>

      <!-- Duration of Dispute -->
      <div class="form-group" id="fg-ld-duration">
        <label class="form-label" for="ld-duration">Duration of Dispute <span class="required">*</span></label>
        <select id="ld-duration" class="form-select" required>
          <option value="" disabled selected>Select duration</option>
          <option value="Less than 1 year">Less than 1 year</option>
          <option value="1-3 years">1-3 years</option>
          <option value="3-5 years">3-5 years</option>
          <option value="More than 5 years">More than 5 years</option>
        </select>
      </div>

      <!-- Previous Legal Action -->
      <div class="form-group" id="fg-ld-legal">
        <label class="form-label" for="ld-legal">Any Previous Legal Action? <span class="required">*</span></label>
        <select id="ld-legal" class="form-select" required>
          <option value="" disabled selected>Select option</option>
          <option value="None">None</option>
          <option value="District Court">District Court</option>
          <option value="High Court">High Court</option>
          <option value="Supreme Court">Supreme Court</option>
          <option value="Tribunal">Tribunal</option>
        </select>
      </div>

      <!-- Expected Resolution -->
      <div class="form-group" id="fg-ld-resolution">
        <label class="form-label" for="expected_resolution">Expected Resolution <span class="required">*</span></label>
        <textarea id="expected_resolution" class="form-input" rows="3" maxlength="300" placeholder="What resolution do you seek?" required></textarea>
        <span id="expected_resolution-counter" style="font-size:11px; color:var(--text-light); display:block; text-align:right; margin-top:4px;">0/300</span>
      </div>
    `;
  }

  // ── Generic Form HTML (for DB-driven form_fields) ──
  function renderGenericForm(formFields) {
    if (!formFields || formFields.length === 0) {
      return '<p style="color:var(--text-light); text-align:center; padding:24px;">No form fields defined for this service type.</p>';
    }

    return formFields.map((field, index) => {
      const fgId = `fg-gen-${field.name}`;
      const inputId = `gen-${field.name}`;
      const reqMark = field.required ? '<span class="required">*</span>' : '';
      const reqAttr = field.required ? 'required' : '';

      let inputHtml = '';

      if (field.type === 'textarea') {
        inputHtml = `<textarea id="${inputId}" class="form-input" rows="3" placeholder="Enter ${field.label.toLowerCase()}" ${reqAttr}></textarea>`;
      } else if (field.type === 'select') {
        const options = (field.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
        inputHtml = `
          <select id="${inputId}" class="form-select" ${reqAttr}>
            <option value="" disabled selected>Select ${field.label.toLowerCase()}</option>
            ${options}
          </select>
        `;
      } else if (field.type === 'number') {
        inputHtml = `<input type="number" id="${inputId}" class="form-input" placeholder="Enter ${field.label.toLowerCase()}" ${reqAttr} />`;
      } else if (field.type === 'date') {
        inputHtml = `<input type="date" id="${inputId}" class="form-input" ${reqAttr} />`;
      } else {
        inputHtml = `<input type="text" id="${inputId}" class="form-input" placeholder="Enter ${field.label.toLowerCase()}" ${reqAttr} />`;
      }

      return `
        <div class="form-group" id="${fgId}">
          <label class="form-label" for="${inputId}">${field.label} ${reqMark}</label>
          ${inputHtml}
        </div>
      `;
    }).join('');
  }

  // ── Vehicle Registration Validation & Collection ──
  function validateAndCollectVehicleForm() {
    const errors = [];
    const data = {};

    const fields = [
      { id: 'vr-fullname', key: 'full_name', groupId: 'fg-vr-fullname', label: 'Full Name', type: 'text' },
      { id: 'vr-dob', key: 'date_of_birth', groupId: 'fg-vr-dob', label: 'Date of Birth', type: 'date' },
      { id: 'vr-address', key: 'address', groupId: 'fg-vr-address', label: 'Address', type: 'textarea' },
      { id: 'vr-make', key: 'vehicle_make', groupId: 'fg-vr-make', label: 'Vehicle Make', type: 'text' },
      { id: 'vr-model', key: 'vehicle_model', groupId: 'fg-vr-model', label: 'Vehicle Model', type: 'text' },
      { id: 'vr-year', key: 'year_of_manufacture', groupId: 'fg-vr-year', label: 'Year of Manufacture', type: 'number' },
      { id: 'vr-chassis', key: 'chassis_number', groupId: 'fg-vr-chassis', label: 'Chassis Number', type: 'chassis' },
      { id: 'vr-engine', key: 'engine_number', groupId: 'fg-vr-engine', label: 'Engine Number', type: 'text' },
      { id: 'vr-color', key: 'vehicle_color', groupId: 'fg-vr-color', label: 'Vehicle Color', type: 'select' },
      { id: 'vr-fuel', key: 'fuel_type', groupId: 'fg-vr-fuel', label: 'Fuel Type', type: 'select' },
      { id: 'vr-insurance', key: 'insurance_policy_number', groupId: 'fg-vr-insurance', label: 'Insurance Policy Number', type: 'text' },
      { id: 'vr-insurance-exp', key: 'insurance_expiry_date', groupId: 'fg-vr-insurance-exp', label: 'Insurance Expiry Date', type: 'date' },
      { id: 'vr-purchase-date', key: 'purchase_date', groupId: 'fg-vr-purchase-date', label: 'Purchase Date', type: 'date' },
      { id: 'vr-price', key: 'purchase_price', groupId: 'fg-vr-price', label: 'Purchase Price', type: 'number' }
    ];

    // Clear all errors first
    fields.forEach(f => clearFieldError(f.groupId));
    clearFieldError('fg-vr-prev-owner');
    clearFieldError('fg-vr-prev-contact');

    fields.forEach(f => {
      const el = document.getElementById(f.id);
      const val = el ? el.value.trim() : '';

      if (!val) {
        setFieldError(f.groupId, `${f.label} is required`);
        errors.push(f.key);
        return;
      }

      if (f.type === 'number') {
        const num = Number(val);
        if (isNaN(num)) {
          setFieldError(f.groupId, `${f.label} must be a valid number`);
          errors.push(f.key);
          return;
        }
        if (f.key === 'year_of_manufacture' && (num < 2000 || num > 2026)) {
          setFieldError(f.groupId, 'Year must be between 2000 and 2026');
          errors.push(f.key);
          return;
        }
        data[f.key] = num;
      } else if (f.type === 'chassis') {
        if (!/^[A-Za-z0-9]{17}$/.test(val)) {
          setFieldError(f.groupId, 'Chassis number must be exactly 17 alphanumeric characters');
          errors.push(f.key);
          return;
        }
        data[f.key] = val;
      } else {
        data[f.key] = val;
      }
    });

    // Check previous owner fields if used vehicle
    const isUsed = document.getElementById('is-used-vehicle');
    if (isUsed && isUsed.value === 'yes') {
      const prevOwner = document.getElementById('vr-prev-owner');
      const prevContact = document.getElementById('vr-prev-contact');

      if (!prevOwner.value.trim()) {
        setFieldError('fg-vr-prev-owner', 'Previous owner name is required');
        errors.push('previous_owner_name');
      } else {
        data.previous_owner_name = prevOwner.value.trim();
      }

      if (!prevContact.value.trim()) {
        setFieldError('fg-vr-prev-contact', 'Previous owner contact is required');
        errors.push('previous_owner_contact');
      } else {
        data.previous_owner_contact = prevContact.value.trim();
      }
    }

    return { data, errors };
  }

  // ── Land Dispute Validation & Collection ──
  function validateAndCollectLandDisputeForm() {
    const errors = [];
    const data = {};

    const fields = [
      { id: 'ld-fullname', key: 'full_name', groupId: 'fg-ld-fullname', label: 'Full Name' },
      { id: 'ld-address', key: 'address', groupId: 'fg-ld-address', label: 'Address' },
      { id: 'ld-location', key: 'dispute_location', groupId: 'fg-ld-location', label: 'Dispute Location' },
      { id: 'ld-survey', key: 'survey_number', groupId: 'fg-ld-survey', label: 'Survey Number' },
      { id: 'ld-area', key: 'land_area', groupId: 'fg-ld-area', label: 'Land Area', type: 'number' },
      { id: 'ld-opposing-name', key: 'opposing_party_name', groupId: 'fg-ld-opposing-name', label: 'Opposing Party Name' },
      { id: 'ld-opposing-address', key: 'opposing_party_address', groupId: 'fg-ld-opposing-address', label: 'Opposing Party Address' },
      { id: 'ld-duration', key: 'duration_of_dispute', groupId: 'fg-ld-duration', label: 'Duration of Dispute' },
      { id: 'ld-legal', key: 'previous_legal_action', groupId: 'fg-ld-legal', label: 'Previous Legal Action' }
    ];

    // Clear all errors
    fields.forEach(f => clearFieldError(f.groupId));
    clearFieldError('fg-ld-description');
    clearFieldError('fg-ld-resolution');

    fields.forEach(f => {
      const el = document.getElementById(f.id);
      const val = el ? el.value.trim() : '';

      if (!val) {
        setFieldError(f.groupId, `${f.label} is required`);
        errors.push(f.key);
        return;
      }

      if (f.type === 'number') {
        const num = Number(val);
        if (isNaN(num) || num <= 0) {
          setFieldError(f.groupId, `${f.label} must be a valid positive number`);
          errors.push(f.key);
          return;
        }
        data[f.key] = num;
      } else {
        data[f.key] = val;
      }
    });

    // Dispute description with max length
    const descEl = document.getElementById('dispute_description');
    if (descEl) {
      const desc = descEl.value.trim();
      if (!desc) {
        setFieldError('fg-ld-description', 'Dispute description is required');
        errors.push('dispute_description');
      } else if (desc.length > 500) {
        setFieldError('fg-ld-description', 'Description cannot exceed 500 characters');
        errors.push('dispute_description');
      } else {
        data.dispute_description = desc;
      }
    }

    // Expected resolution with max length
    const resEl = document.getElementById('expected_resolution');
    if (resEl) {
      const res = resEl.value.trim();
      if (!res) {
        setFieldError('fg-ld-resolution', 'Expected resolution is required');
        errors.push('expected_resolution');
      } else if (res.length > 300) {
        setFieldError('fg-ld-resolution', 'Resolution cannot exceed 300 characters');
        errors.push('expected_resolution');
      } else {
        data.expected_resolution = res;
      }
    }

    return { data, errors };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 3. SERVICES PAGE  (/citizen/services)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderServicesPage(params) {
    const allowed = await Auth().requireRole('citizen');
    if (!allowed) return;

    const appEl = document.getElementById('app');
    const profile = State()?.get('profile') || {};

    // Show skeleton while loading
    appEl.innerHTML = `
      <div class="page citizen-services-page">
        ${Comp().tricolourBar()}
        ${Comp().spinner('lg')}
      </div>
    `;

    const { active, all } = await fetchAppTypes();

    // Build category sections
    const categorySections = CATEGORIES.map(cat => {
      const catApps = all.filter(a => a.category === cat);
      if (catApps.length === 0) return '';
      const catIcon = CATEGORY_ICONS[cat] || 'fa-folder';
      return `
        <div class="category-section" data-category="${cat}">
          <div class="category-header" data-cat-toggle="${cat}" style="
            display:flex; align-items:center; justify-content:space-between;
            padding:12px 0; cursor:pointer; user-select:none;
          ">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:28px; height:28px; border-radius:8px; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center;">
                <i class="fas ${catIcon}" style="font-size:12px; color:var(--saffron);"></i>
              </div>
              <span style="font-size:15px; font-weight:600; color:var(--text-primary);">${cat}</span>
              <span style="font-size:12px; color:var(--text-light);">${catApps.length} service${catApps.length > 1 ? 's' : ''}</span>
            </div>
            <i class="fas fa-chevron-down category-chevron" style="font-size:12px; color:var(--text-light); transition:transform 0.2s;"></i>
          </div>
          <div class="category-apps" data-cat-apps="${cat}" style="
            display:flex; flex-wrap:wrap; gap:8px; padding-bottom:8px;
          ">
            ${catApps.map(a => renderAppTile(a)).join('')}
          </div>
        </div>
      `;
    }).join('');

    appEl.innerHTML = `
      <div class="page citizen-services-page" style="padding-bottom:80px;">
        ${Comp().tricolourBar()}

        <!-- Top Bar -->
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; background:var(--bg-primary);
          position:sticky; top:0; z-index:10;
        ">
          <div style="display:flex; align-items:center; gap:10px;">
            ${Comp().logo('mini')}
            <span style="font-size:18px; font-weight:700; color:var(--text-primary);">All Services</span>
          </div>
          ${renderNotifBell()}
        </div>

        <!-- Search Bar (auto-focused) -->
        <div style="padding:0 16px 8px;">
          <div style="position:relative; display:flex; align-items:center;">
            <i class="fas fa-search" style="
              position:absolute; left:14px; top:50%; transform:translateY(-50%);
              color:var(--text-light); font-size:14px;
            "></i>
            <input type="text" id="services-search" placeholder="Search services..." autofocus style="
              width:100%; padding:10px 14px 10px 40px;
              border:1.5px solid var(--border); border-radius:10px;
              font-size:14px; background:var(--bg-secondary);
              color:var(--text-primary); outline:none;
              transition:border-color 0.2s;
            " onfocus="this.style.borderColor='var(--saffron)'" onblur="this.style.borderColor='var(--border)'" />
          </div>
        </div>

        <!-- Search Results -->
        <div id="services-search-results" style="padding:8px 16px; display:none;">
          <span style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:8px; display:block;">Search Results</span>
          <div id="services-search-results-apps" style="display:flex; flex-wrap:wrap; gap:8px;"></div>
        </div>

        <!-- Category Sections -->
        <div id="services-categories" style="padding:0 16px;">
          ${categorySections}
        </div>

        <!-- Bottom Nav -->
        ${Nav().render(citizenNavItems, 1)}

        <!-- Chatbot -->
        ${Chatbot().render()}

        <!-- Notification Panel -->
        <div id="notification-panel" class="notification-panel" style="display:none;"></div>
        <div id="notification-overlay" class="notification-overlay" style="display:none;"></div>
      </div>
    `;

    // ── Event listeners ──
    const searchInput = document.getElementById('services-search');
    const categoriesContainer = document.getElementById('services-categories');
    const searchResults = document.getElementById('services-search-results');
    const searchResultsApps = document.getElementById('services-search-results-apps');

    function onSearchInput() {
      const query = searchInput.value.trim().toLowerCase();
      if (query.length === 0) {
        categoriesContainer.style.display = '';
        searchResults.style.display = 'none';
        document.querySelectorAll('.category-header').forEach(h => h.style.display = '');
        return;
      }

      categoriesContainer.style.display = 'none';
      searchResults.style.display = '';

      const matches = all.filter(a => a.name.toLowerCase().includes(query));
      searchResultsApps.innerHTML = matches.length > 0
        ? matches.map(a => renderAppTile(a)).join('')
        : '<span style="color:var(--text-light);font-size:13px;">No services found</span>';

      requestAnimationFrame(() => attachAppTileListeners());
    }

    function onAppTileClick(e) {
      const tile = e.target.closest('.app-tile');
      if (!tile) return;
      const slug = tile.getAttribute('data-slug');
      const isActive = tile.getAttribute('data-active') === 'true';
      if (isActive) {
        Router().navigate('/citizen/application/' + slug);
      } else {
        Toast().show('Coming Soon! This service will be available shortly.', 'info');
      }
    }

    function attachAppTileListeners() {
      document.querySelectorAll('.app-tile').forEach(tile => {
        tile.addEventListener('click', onAppTileClick);
      });
    }

    function onCategoryToggle(e) {
      const header = e.target.closest('.category-header');
      if (!header) return;
      const cat = header.getAttribute('data-cat-toggle');
      const apps = document.querySelector(`[data-cat-apps="${cat}"]`);
      const chevron = header.querySelector('.category-chevron');
      if (apps) {
        const isHidden = apps.style.display === 'none';
        apps.style.display = isHidden ? 'flex' : 'none';
        if (chevron) chevron.style.transform = isHidden ? '' : 'rotate(-90deg)';
      }
    }

    searchInput.addEventListener('input', onSearchInput);
    document.querySelectorAll('.category-header').forEach(h => {
      h.addEventListener('click', onCategoryToggle);
    });

    attachNotifBell();
    Chatbot().initFabListener();
    requestAnimationFrame(() => {
      attachAppTileListeners();
      searchInput.focus();
    });

    return function cleanup() {
      searchInput.removeEventListener('input', onSearchInput);
      document.querySelectorAll('.category-header').forEach(h => {
        h.removeEventListener('click', onCategoryToggle);
      });
      document.querySelectorAll('.app-tile').forEach(tile => {
        tile.removeEventListener('click', onAppTileClick);
      });
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 4. MY APPLICATIONS PAGE  (/citizen/applications)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderMyApplications(params) {
    const allowed = await Auth().requireRole('citizen');
    if (!allowed) return;

    const appEl = document.getElementById('app');

    // Show loading
    appEl.innerHTML = `
      <div class="page" style="padding-bottom:80px;">
        ${Comp().tricolourBar()}
        <div style="padding:16px;">
          ${Comp().skeleton('list-item')}
          ${Comp().skeleton('list-item')}
          ${Comp().skeleton('list-item')}
        </div>
      </div>
    `;

    // Fetch applications
    const citizenId = getCitizenId();
    let applications = [];
    try {
      if (citizenId && DBH()) {
        applications = await DBH().getCitizenApplications(citizenId);
      }
    } catch (err) {
      console.warn('Failed to fetch applications:', err);
    }

    const filterTabs = ['All', 'In Progress', 'Approved', 'Rejected'];

    function renderAppList(filter) {
      let filtered = applications;
      if (filter === 'In Progress') {
        filtered = applications.filter(a =>
          ['submitted', 'in_review', 'lawyer_pending', 'lawyer_assigned'].includes(a.status)
        );
      } else if (filter === 'Approved') {
        filtered = applications.filter(a => a.status === 'approved' || a.status === 'completed');
      } else if (filter === 'Rejected') {
        filtered = applications.filter(a => a.status === 'rejected');
      }

      if (filtered.length === 0) {
        return `
          <div style="
            text-align:center; padding:48px 16px;
          ">
            <i class="fas fa-file-lines" style="font-size:48px; color:var(--border); margin-bottom:16px;"></i>
            <p style="font-size:15px; color:var(--text-secondary); margin:0;">No applications yet. Browse services to get started!</p>
            <button onclick="window.EkraahRouter.navigate('/citizen/home')" style="
              margin-top:16px; padding:10px 24px;
              background:linear-gradient(135deg, var(--saffron), var(--saffron-dark));
              color:#fff; border:none; border-radius:8px;
              font-size:14px; font-weight:600; cursor:pointer;
            ">Browse Services</button>
          </div>
        `;
      }

      return filtered.map(a => {
        const typeName = a.application_types?.name || 'Application';
        const typeIcon = a.application_types?.icon || 'fa-file-lines';
        const typeColor = a.application_types?.color || '#1a73e8';
        const iconClass = typeIcon.startsWith('fa-') ? `fas ${typeIcon}` : `fas fa-file-lines`;
        const submittedDate = Comp().formatDate(a.created_at);
        const statusBadge = Comp().statusBadge(a.status);

        // Stage indicator for department chain workflows
        let stageIndicator = '';
        if (a.total_stages && a.total_stages > 1) {
          stageIndicator = `<span style="font-size:11px; color:var(--text-light);">Stage ${a.current_stage} of ${a.total_stages}</span>`;
        }

        return `
          <div class="app-list-item" data-app-id="${a.id}" style="
            display:flex; align-items:center; gap:12px;
            padding:14px 0; border-bottom:1px solid var(--border);
            cursor:pointer;
            transition: background 0.15s;
          " onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            <div style="
              width:44px; height:44px; border-radius:12px;
              background:linear-gradient(135deg, ${typeColor}, ${lightenColor(typeColor, 0.15)});
              display:flex; align-items:center; justify-content:center;
              flex-shrink:0;
            ">
              <i class="${iconClass}" style="font-size:18px; color:#fff;"></i>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:2px;">${typeName}</div>
              <div style="font-size:12px; color:var(--text-light); margin-bottom:4px;">${submittedDate}</div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${statusBadge}
                ${stageIndicator}
              </div>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:14px;"></i>
          </div>
        `;
      }).join('');
    }

    const tabsHtml = filterTabs.map((tab, i) => `
      <button class="filter-tab ${i === 0 ? 'active' : ''}" data-filter="${tab}" style="
        padding:8px 16px;
        border:none;
        border-radius:8px;
        font-size:13px;
        font-weight:${i === 0 ? '600' : '500'};
        cursor:pointer;
        background:${i === 0 ? 'var(--saffron)' : 'var(--bg-secondary)'};
        color:${i === 0 ? '#fff' : 'var(--text-secondary)'};
        white-space:nowrap;
        transition:background 0.15s, color 0.15s;
      ">${tab}</button>
    `).join('');

    appEl.innerHTML = `
      <div class="page citizen-applications-page" style="padding-bottom:80px;">
        ${Comp().tricolourBar()}

        <!-- Top Bar -->
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; background:var(--bg-primary);
          position:sticky; top:0; z-index:10;
        ">
          <span style="font-size:18px; font-weight:700; color:var(--text-primary);">My Applications</span>
          ${renderNotifBell()}
        </div>

        <!-- Filter Tabs -->
        <div style="
          display:flex; gap:8px; padding:8px 16px;
          overflow-x:auto; -webkit-overflow-scrolling:touch;
          scrollbar-width:none;
        ">
          ${tabsHtml}
        </div>

        <!-- Application List -->
        <div id="applications-list" style="padding:0 16px;">
          ${renderAppList('All')}
        </div>

        <!-- Bottom Nav -->
        ${Nav().render(citizenNavItems, 2)}

        <!-- Chatbot -->
        ${Chatbot().render()}

        <!-- Notification Panel -->
        <div id="notification-panel" class="notification-panel" style="display:none;"></div>
        <div id="notification-overlay" class="notification-overlay" style="display:none;"></div>
      </div>
    `;

    // ── Event listeners ──
    let currentFilter = 'All';

    function onFilterClick(e) {
      const tab = e.target.closest('.filter-tab');
      if (!tab) return;

      currentFilter = tab.getAttribute('data-filter');

      // Update tab styles
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('active');
        t.style.background = 'var(--bg-secondary)';
        t.style.color = 'var(--text-secondary)';
        t.style.fontWeight = '500';
      });
      tab.classList.add('active');
      tab.style.background = 'var(--saffron)';
      tab.style.color = '#fff';
      tab.style.fontWeight = '600';

      // Re-render list
      const list = document.getElementById('applications-list');
      if (list) {
        list.innerHTML = renderAppList(currentFilter);
        requestAnimationFrame(() => attachAppItemClickListeners());
      }
    }

    function onAppItemClick(e) {
      const item = e.target.closest('.app-list-item');
      if (!item) return;
      const appId = item.getAttribute('data-app-id');
      Router().navigate('/citizen/application-detail/' + appId);
    }

    function attachAppItemClickListeners() {
      document.querySelectorAll('.app-list-item').forEach(item => {
        item.addEventListener('click', onAppItemClick);
      });
    }

    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', onFilterClick);
    });

    attachNotifBell();
    Chatbot().initFabListener();
    requestAnimationFrame(() => attachAppItemClickListeners());

    return function cleanup() {
      document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.removeEventListener('click', onFilterClick);
      });
      document.querySelectorAll('.app-list-item').forEach(item => {
        item.removeEventListener('click', onAppItemClick);
      });
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 5. APPLICATION DETAIL PAGE  (/citizen/application-detail/:id)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderApplicationDetail(params) {
    const allowed = await Auth().requireRole('citizen');
    if (!allowed) return;

    const appId = params.id;
    const appEl = document.getElementById('app');

    // Show loading
    appEl.innerHTML = `
      <div class="page" style="min-height:100vh; display:flex; align-items:center; justify-content:center;">
        ${Comp().spinner('lg')}
      </div>
    `;

    // Fetch application details
    let application = null;
    let stageReviews = [];
    let workNotes = [];
    let appType = null;

    try {
      if (DBH()) {
        application = await DBH().getApplicationById(appId);
        if (application) {
          stageReviews = application.application_stage_reviews || [];
          workNotes = application.work_notes || [];
          appType = application.application_types || null;
        }
      }
    } catch (err) {
      console.error('Failed to fetch application details:', err);
    }

    if (!application) {
      appEl.innerHTML = `
        <div class="page" style="min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px;">
          <i class="fas fa-exclamation-circle" style="font-size:48px; color:var(--error); margin-bottom:16px;"></i>
          <p style="font-size:16px; color:var(--text-secondary); margin-bottom:16px;">Application not found</p>
          <button id="detail-back-btn" style="
            padding:10px 24px; background:var(--saffron); color:#fff;
            border:none; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer;
          ">Go Back</button>
        </div>
      `;
      const backBtn = document.getElementById('detail-back-btn');
      backBtn.addEventListener('click', () => Router().navigate('/citizen/applications'));
      return function cleanup() {
        backBtn.removeEventListener('click', () => Router().navigate('/citizen/applications'));
      };
    }

    const typeName = appType?.name || 'Application';
    const typeIcon = appType?.icon || 'fa-file-lines';
    const typeColor = appType?.color || '#1a73e8';
    const iconClass = typeIcon.startsWith('fa-') ? `fas ${typeIcon}` : 'fas fa-file-lines';
    const shortId = (application.id || '').substring(0, 8).toUpperCase();
    const submittedDate = Comp().formatDate(application.created_at);
    const statusBadge = Comp().statusBadge(application.status);

    // Determine workflow type
    const isDeptChain = appType?.workflow_type === 'department_chain' || (application.total_stages > 0 && !application.assigned_lawyer_id);
    const isLawyerAssignment = appType?.workflow_type === 'lawyer_assignment' ||
      ['lawyer_pending', 'lawyer_assigned'].includes(application.status);

    // ── Build status track for department chain ──
    let statusTrackHtml = '';
    if (isDeptChain && stageReviews.length > 0) {
      const stages = stageReviews.map(sr => ({
        label: sr.department,
        department: sr.department
      }));
      statusTrackHtml = `
        <div style="padding:16px; margin:0 16px; background:var(--bg-primary); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:16px;">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 8px;">Application Progress</h3>
          ${Comp().statusTrack(stages, application.current_stage, application.status)}
        </div>
      `;

      // Stage review details
      const reviewDetails = stageReviews.map(sr => {
        let reviewStatusIcon = '';
        let reviewStatusColor = '';
        if (sr.status === 'approved') {
          reviewStatusIcon = 'fa-circle-check';
          reviewStatusColor = 'var(--green)';
        } else if (sr.status === 'rejected') {
          reviewStatusIcon = 'fa-circle-xmark';
          reviewStatusColor = 'var(--error)';
        } else {
          reviewStatusIcon = 'fa-clock';
          reviewStatusColor = 'var(--text-light)';
        }

        return `
          <div style="padding:12px 0; border-bottom:1px solid var(--border);">
            <div style="display:flex; align-items:center; justify-content:space-between;">
              <div style="display:flex; align-items:center; gap:8px;">
                <i class="fas ${reviewStatusIcon}" style="color:${reviewStatusColor}; font-size:16px;"></i>
                <div>
                  <div style="font-size:13px; font-weight:600; color:var(--text-primary);">${sr.department}</div>
                  <div style="font-size:11px; color:var(--text-light);">Stage ${sr.stage_number}</div>
                </div>
              </div>
              <div style="text-align:right;">
                <span style="font-size:12px; font-weight:500; color:${reviewStatusColor}; text-transform:capitalize;">${sr.status}</span>
                ${sr.reviewed_at ? `<div style="font-size:11px; color:var(--text-light);">${Comp().formatDate(sr.reviewed_at)}</div>` : ''}
              </div>
            </div>
            ${sr.rejection_reason ? `
              <div style="margin-top:8px; padding:8px 12px; background:#FFF5F5; border-radius:8px; border-left:3px solid var(--error);">
                <span style="font-size:11px; font-weight:600; color:var(--error);">Rejection Reason:</span>
                <p style="font-size:12px; color:var(--text-secondary); margin:4px 0 0;">${sr.rejection_reason}</p>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      statusTrackHtml += `
        <div style="padding:0 16px; margin-bottom:16px;">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 8px;">Stage Details</h3>
          ${reviewDetails}
        </div>
      `;
    }

    // ── Build lawyer assignment section ──
    let lawyerSectionHtml = '';
    if (isLawyerAssignment) {
      const isLawyerAssigned = application.status === 'lawyer_assigned' || application.assigned_lawyer_id;
      const lawyerName = application.lawyer_details?.full_name ||
        (application.profiles?.full_name) ||
        (application.assigned_lawyer_id ? 'Assigned Lawyer' : '');

      lawyerSectionHtml = `
        <div style="padding:16px; margin:0 16px 16px; background:var(--bg-primary); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 12px;">Lawyer Status</h3>
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="
              width:40px; height:40px; border-radius:50%;
              background:${isLawyerAssigned ? 'var(--green)' : 'var(--saffron)'};
              display:flex; align-items:center; justify-content:center;
            ">
              <i class="fas ${isLawyerAssigned ? 'fa-user-check' : 'fa-user-clock'}" style="color:#fff; font-size:16px;"></i>
            </div>
            <div>
              <div style="font-size:14px; font-weight:600; color:var(--text-primary);">
                ${isLawyerAssigned ? 'Lawyer Assigned' : 'Awaiting Lawyer'}
              </div>
              ${isLawyerAssigned && lawyerName ? `
                <div style="font-size:13px; color:var(--text-secondary);">${lawyerName}</div>
              ` : `
                <div style="font-size:13px; color:var(--text-light);">Your case is pending lawyer assignment</div>
              `}
            </div>
          </div>
        </div>
      `;
    }

    // ── Form data section ──
    const formData = application.form_data || {};
    const formDataEntries = Object.entries(formData);
    const formDataHtml = formDataEntries.length > 0
      ? formDataEntries.map(([key, value]) => `
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
            <span style="font-size:13px; color:var(--text-secondary); flex:0 0 45%;">${prettifyKey(key)}</span>
            <span style="font-size:13px; font-weight:500; color:var(--text-primary); flex:1; text-align:right; word-break:break-word;">${value || '—'}</span>
          </div>
        `).join('')
      : '<p style="font-size:13px; color:var(--text-light);">No form data available</p>';

    // ── Work notes section ──
    let workNotesHtml = '';
    if (workNotes.length > 0) {
      const notesList = workNotes.map(note => {
        const authorName = note.profiles?.full_name || 'Official';
        const authorDept = note.profiles?.government_officials?.[0]?.department || '';
        const noteDate = Comp().formatDate(note.created_at);

        return `
          <div style="padding:12px; background:var(--bg-secondary); border-radius:8px; margin-bottom:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
              <div>
                <span style="font-size:13px; font-weight:600; color:var(--text-primary);">${authorName}</span>
                ${authorDept ? `<span style="font-size:11px; color:var(--text-light); margin-left:8px;">${authorDept}</span>` : ''}
              </div>
              <span style="font-size:11px; color:var(--text-light);">${noteDate}</span>
            </div>
            <p style="font-size:13px; color:var(--text-secondary); margin:0; line-height:1.5;">${note.note}</p>
          </div>
        `;
      }).join('');

      workNotesHtml = `
        <div style="padding:0 16px; margin-bottom:24px;">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 12px;">Work Notes</h3>
          ${notesList}
        </div>
      `;
    }

    appEl.innerHTML = `
      <div class="page application-detail-page">
        ${Comp().tricolourBar()}

        <!-- Top Bar -->
        <div style="
          display:flex; align-items:center; gap:12px;
          padding:12px 16px; background:var(--bg-primary);
          position:sticky; top:0; z-index:10;
          border-bottom:1px solid var(--border);
        ">
          <button id="detail-back-btn" style="
            background:none; border:none; cursor:pointer;
            display:flex; align-items:center; gap:6px;
            color:var(--text-primary); font-size:16px; font-weight:500;
          ">
            <i class="fas fa-arrow-left"></i>
          </button>
          <span style="font-size:16px; font-weight:600; color:var(--text-primary);">Application Details</span>
        </div>

        <!-- Application Info Card -->
        <div style="padding:16px; margin:16px; background:var(--bg-primary); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
            <div style="
              width:52px; height:52px; border-radius:14px;
              background:linear-gradient(135deg, ${typeColor}, ${lightenColor(typeColor, 0.15)});
              display:flex; align-items:center; justify-content:center;
              box-shadow:0 4px 12px ${typeColor}33;
            ">
              <i class="${iconClass}" style="font-size:22px; color:#fff;"></i>
            </div>
            <div style="flex:1;">
              <div style="font-size:16px; font-weight:700; color:var(--text-primary);">${typeName}</div>
              <div style="font-size:12px; color:var(--text-light); margin-top:2px;">ID: ${shortId}</div>
              <div style="font-size:12px; color:var(--text-light); margin-top:2px;">${submittedDate}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${statusBadge}
          </div>
        </div>

        <!-- Status Track (dept chain) -->
        ${statusTrackHtml}

        <!-- Lawyer Section -->
        ${lawyerSectionHtml}

        <!-- Form Data -->
        <div style="padding:0 16px; margin-bottom:16px;">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 8px;">Application Details</h3>
          <div style="background:var(--bg-primary); border-radius:12px; padding:4px 16px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
            ${formDataHtml}
          </div>
        </div>

        <!-- Work Notes -->
        ${workNotesHtml}

        <div style="height:24px;"></div>
      </div>
    `;

    // ── Event listeners ──
    const backBtn = document.getElementById('detail-back-btn');

    function onBack() {
      Router().navigate('/citizen/applications');
    }

    backBtn.addEventListener('click', onBack);

    return function cleanup() {
      backBtn.removeEventListener('click', onBack);
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 6. MY DOCUMENTS PAGE  (/citizen/documents)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderMyDocuments(params) {
    const allowed = await Auth().requireRole('citizen');
    if (!allowed) return;

    const appEl = document.getElementById('app');

    // Show loading
    appEl.innerHTML = `
      <div class="page" style="min-height:100vh; display:flex; align-items:center; justify-content:center;">
        ${Comp().spinner('lg')}
      </div>
    `;

    // Fetch documents
    const citizenId = getCitizenId();
    let documents = [];
    try {
      if (citizenId && DBH()) {
        documents = await DBH().getDocuments(citizenId);
      }
    } catch (err) {
      console.warn('Failed to fetch documents:', err);
    }

    let documentsListHtml = '';
    if (documents.length === 0) {
      documentsListHtml = `
        <div style="text-align:center; padding:48px 16px;">
          <i class="fas fa-file-lines" style="font-size:48px; color:var(--border); margin-bottom:16px;"></i>
          <p style="font-size:15px; color:var(--text-secondary); margin:0;">No documents yet. Apply for services to receive documents.</p>
        </div>
      `;
    } else {
      documentsListHtml = documents.map(doc => {
        const docType = doc.document_type || 'Document';
        const docNumber = doc.document_number || '';
        const issuedDate = Comp().formatDate(doc.issued_at);
        const appInfo = doc.applications?.application_types;
        const typeIcon = appInfo?.icon || 'fa-file-lines';
        const typeColor = appInfo?.color || '#1a73e8';
        const iconClass = typeIcon.startsWith('fa-') ? `fas ${typeIcon}` : 'fas fa-file-lines';

        // Use certificate icon for certain types
        const useCertIcon = docType.toLowerCase().includes('certificate') || docType.toLowerCase().includes('registration');
        const displayIcon = useCertIcon ? 'fa-file-certificate' : iconClass;

        return `
          <div class="doc-list-item" data-doc-id="${doc.id}" style="
            display:flex; align-items:center; gap:12px;
            padding:14px 0; border-bottom:1px solid var(--border);
            cursor:pointer;
            transition:background 0.15s;
          " onmouseenter="this.style.background='var(--bg-secondary)'" onmouseleave="this.style.background=''">
            <div style="
              width:44px; height:44px; border-radius:12px;
              background:linear-gradient(135deg, ${typeColor}, ${lightenColor(typeColor, 0.15)});
              display:flex; align-items:center; justify-content:center;
              flex-shrink:0;
            ">
              <i class="fas ${displayIcon}" style="font-size:18px; color:#fff;"></i>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:14px; font-weight:600; color:var(--text-primary); margin-bottom:2px;">${docType}</div>
              <div style="font-size:12px; color:var(--text-light);">${docNumber}</div>
              <div style="font-size:11px; color:var(--text-light);">Issued: ${issuedDate}</div>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:14px;"></i>
          </div>
        `;
      }).join('');
    }

    appEl.innerHTML = `
      <div class="page citizen-documents-page">
        ${Comp().tricolourBar()}

        <!-- Top Bar -->
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; background:var(--bg-primary);
          position:sticky; top:0; z-index:10;
          border-bottom:1px solid var(--border);
        ">
          <button id="docs-back-btn" style="
            background:none; border:none; cursor:pointer;
            display:flex; align-items:center; gap:6px;
            color:var(--text-primary); font-size:16px; font-weight:500;
          ">
            <i class="fas fa-arrow-left"></i>
            <span>Back</span>
          </button>
          <span style="font-size:18px; font-weight:700; color:var(--text-primary);">My Documents</span>
          ${renderNotifBell()}
        </div>

        <!-- Documents List -->
        <div id="documents-list" style="padding:0 16px;">
          ${documentsListHtml}
        </div>

        <!-- Document Detail Panel (hidden by default) -->
        <div id="document-detail-panel" style="display:none;"></div>
      </div>
    `;

    // ── Event listeners ──
    const backBtn = document.getElementById('docs-back-btn');
    const docList = document.getElementById('documents-list');
    const detailPanel = document.getElementById('document-detail-panel');

    function onBack() {
      // If detail panel is showing, go back to list; otherwise navigate home
      if (detailPanel.style.display !== 'none') {
        detailPanel.style.display = 'none';
        docList.style.display = '';
        return;
      }
      Router().navigate('/citizen/home');
    }

    function onDocItemClick(e) {
      const item = e.target.closest('.doc-list-item');
      if (!item) return;
      const docId = item.getAttribute('data-doc-id');
      const doc = documents.find(d => String(d.id) === String(docId));
      if (!doc) return;

      // Show detail view
      const docType = doc.document_type || 'Document';
      const docNumber = doc.document_number || '';
      const issuedDate = Comp().formatDate(doc.issued_at);
      const details = doc.details || {};
      const detailsEntries = Object.entries(details);

      let detailsHtml = '';
      if (detailsEntries.length > 0) {
        detailsHtml = detailsEntries.map(([key, value]) => `
          <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
            <span style="font-size:13px; color:var(--text-secondary); flex:0 0 45%;">${prettifyKey(key)}</span>
            <span style="font-size:13px; font-weight:500; color:var(--text-primary); flex:1; text-align:right; word-break:break-word;">${value || '—'}</span>
          </div>
        `).join('');
      } else {
        detailsHtml = '<p style="font-size:13px; color:var(--text-light);">No additional details</p>';
      }

      const appInfo = doc.applications?.application_types;
      const typeColor = appInfo?.color || '#1a73e8';
      const typeIcon = appInfo?.icon || 'fa-file-lines';
      const iconClass = typeIcon.startsWith('fa-') ? `fas ${typeIcon}` : 'fas fa-file-lines';
      const useCertIcon = docType.toLowerCase().includes('certificate') || docType.toLowerCase().includes('registration');
      const displayIcon = useCertIcon ? 'fa-file-certificate' : iconClass;

      detailPanel.innerHTML = `
        <div style="padding:16px;">
          <div style="text-align:center; margin-bottom:20px;">
            <div style="
              width:64px; height:64px; border-radius:16px; margin:0 auto 12px;
              background:linear-gradient(135deg, ${typeColor}, ${lightenColor(typeColor, 0.15)});
              display:flex; align-items:center; justify-content:center;
              box-shadow:0 6px 20px ${typeColor}44;
            ">
              <i class="fas ${displayIcon}" style="font-size:28px; color:#fff;"></i>
            </div>
            <h2 style="font-size:18px; font-weight:700; color:var(--text-primary); margin:0 0 4px;">${docType}</h2>
            <span style="font-size:13px; color:var(--text-secondary);">${docNumber}</span>
          </div>

          <div style="background:var(--bg-primary); border-radius:12px; padding:4px 16px; box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-bottom:16px;">
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
              <span style="font-size:13px; color:var(--text-secondary);">Document Type</span>
              <span style="font-size:13px; font-weight:500; color:var(--text-primary);">${docType}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
              <span style="font-size:13px; color:var(--text-secondary);">Document Number</span>
              <span style="font-size:13px; font-weight:500; color:var(--text-primary);">${docNumber}</span>
            </div>
            <div style="display:flex; justify-content:space-between; padding:10px 0;">
              <span style="font-size:13px; color:var(--text-secondary);">Issued Date</span>
              <span style="font-size:13px; font-weight:500; color:var(--text-primary);">${issuedDate}</span>
            </div>
          </div>

          ${detailsEntries.length > 0 ? `
            <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 8px;">Additional Details</h3>
            <div style="background:var(--bg-primary); border-radius:12px; padding:4px 16px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
              ${detailsHtml}
            </div>
          ` : ''}
        </div>
      `;

      docList.style.display = 'none';
      detailPanel.style.display = 'block';
    }

    backBtn.addEventListener('click', onBack);
    attachNotifBell();
    Chatbot().initFabListener();
    document.querySelectorAll('.doc-list-item').forEach(item => {
      item.addEventListener('click', onDocItemClick);
    });

    return function cleanup() {
      backBtn.removeEventListener('click', onBack);
      document.querySelectorAll('.doc-list-item').forEach(item => {
        item.removeEventListener('click', onDocItemClick);
      });
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 7. CITIZEN PROFILE PAGE  (/citizen/profile)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderCitizenProfile(params) {
    const allowed = await Auth().requireRole('citizen');
    if (!allowed) return;

    const appEl = document.getElementById('app');
    const profile = State()?.get('profile') || {};
    const fullName = profile.full_name || 'Citizen';
    const email = profile.email || '';
    const initials = fullName
      .split(' ')
      .map(w => w[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const savedLang = State()?.get('language') || localStorage.getItem('ekraah_lang') || profile.preferred_language || 'en';
    const langOptions = LANGUAGES.map(l =>
      `<option value="${l.code}" ${l.code === savedLang ? 'selected' : ''}>${l.label}</option>`
    ).join('');

    appEl.innerHTML = `
      <div class="page citizen-profile-page" style="padding-bottom:80px;">
        ${Comp().tricolourBar()}

        <!-- Top Bar -->
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding:12px 16px; background:var(--bg-primary);
          position:sticky; top:0; z-index:10;
        ">
          <span style="font-size:18px; font-weight:700; color:var(--text-primary);">Profile</span>
          ${renderNotifBell()}
        </div>

        <!-- Profile Card -->
        <div style="text-align:center; padding:24px 16px 16px;">
          <div style="
            width:72px; height:72px; border-radius:50%; margin:0 auto 12px;
            background:linear-gradient(135deg, var(--saffron), var(--saffron-dark));
            display:flex; align-items:center; justify-content:center;
            font-size:24px; font-weight:700; color:#fff;
            box-shadow:0 6px 20px rgba(255,153,51,0.3);
          ">${initials}</div>
          <h2 style="font-size:20px; font-weight:700; color:var(--text-primary); margin:0 0 4px;">${fullName}</h2>
          <p style="font-size:14px; color:var(--text-secondary); margin:0 0 8px;">${email}</p>
          <span style="
            display:inline-flex; align-items:center;
            padding:4px 14px; border-radius:9999px;
            font-size:12px; font-weight:600;
            background:#E3F2FD; color:#1565c0;
          ">Citizen</span>
        </div>

        <!-- Settings Section -->
        <div style="padding:0 16px; margin-top:8px;">
          <h3 style="font-size:14px; font-weight:600; color:var(--text-primary); margin:0 0 12px;">Settings</h3>

          <div style="background:var(--bg-primary); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); overflow:hidden;">
            <!-- Language -->
            <div style="padding:14px 16px; border-bottom:1px solid var(--border);">
              <label style="font-size:13px; font-weight:500; color:var(--text-primary); display:block; margin-bottom:6px;">Language Preference</label>
              <select id="profile-lang-select" class="form-select" style="font-size:13px;">
                ${langOptions}
              </select>
            </div>

            <!-- Push Notifications -->
            <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--border);">
              <span style="font-size:13px; font-weight:500; color:var(--text-primary);">Push Notifications</span>
              <label style="position:relative; display:inline-block; width:44px; height:24px; cursor:pointer;">
                <input type="checkbox" id="toggle-push" checked style="opacity:0; width:0; height:0;" />
                <span style="
                  position:absolute; top:0; left:0; right:0; bottom:0;
                  background:var(--green); border-radius:12px;
                  transition:background 0.2s;
                "></span>
                <span style="
                  position:absolute; top:2px; left:22px;
                  width:20px; height:20px;
                  background:#fff; border-radius:50%;
                  transition:left 0.2s;
                  box-shadow:0 1px 3px rgba(0,0,0,0.2);
                "></span>
              </label>
            </div>

            <!-- Email Notifications -->
            <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px; border-bottom:1px solid var(--border);">
              <span style="font-size:13px; font-weight:500; color:var(--text-primary);">Email Notifications</span>
              <label style="position:relative; display:inline-block; width:44px; height:24px; cursor:pointer;">
                <input type="checkbox" id="toggle-email" style="opacity:0; width:0; height:0;" />
                <span style="
                  position:absolute; top:0; left:0; right:0; bottom:0;
                  background:var(--border); border-radius:12px;
                  transition:background 0.2s;
                "></span>
                <span style="
                  position:absolute; top:2px; left:2px;
                  width:20px; height:20px;
                  background:#fff; border-radius:50%;
                  transition:left 0.2s;
                  box-shadow:0 1px 3px rgba(0,0,0,0.2);
                "></span>
              </label>
            </div>

            <!-- SMS Notifications -->
            <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 16px;">
              <span style="font-size:13px; font-weight:500; color:var(--text-primary);">SMS Notifications</span>
              <label style="position:relative; display:inline-block; width:44px; height:24px; cursor:pointer;">
                <input type="checkbox" id="toggle-sms" style="opacity:0; width:0; height:0;" />
                <span style="
                  position:absolute; top:0; left:0; right:0; bottom:0;
                  background:var(--border); border-radius:12px;
                  transition:background 0.2s;
                "></span>
                <span style="
                  position:absolute; top:2px; left:2px;
                  width:20px; height:20px;
                  background:#fff; border-radius:50%;
                  transition:left 0.2s;
                  box-shadow:0 1px 3px rgba(0,0,0,0.2);
                "></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Links Section -->
        <div style="padding:0 16px; margin-top:20px;">
          <div style="background:var(--bg-primary); border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); overflow:hidden;">
            <a href="#" id="link-about" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:14px 16px; border-bottom:1px solid var(--border);
              text-decoration:none; color:var(--text-primary);
            ">
              <div style="display:flex; align-items:center; gap:10px;">
                <i class="fas fa-info-circle" style="color:var(--saffron); font-size:16px;"></i>
                <span style="font-size:14px; font-weight:500;">About ekRAAH</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>

            <a href="#" id="link-terms" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:14px 16px; border-bottom:1px solid var(--border);
              text-decoration:none; color:var(--text-primary);
            ">
              <div style="display:flex; align-items:center; gap:10px;">
                <i class="fas fa-file-contract" style="color:var(--saffron); font-size:16px;"></i>
                <span style="font-size:14px; font-weight:500;">Terms of Service</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>

            <a href="#" id="link-privacy" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:14px 16px;
              text-decoration:none; color:var(--text-primary);
            ">
              <div style="display:flex; align-items:center; gap:10px;">
                <i class="fas fa-shield-alt" style="color:var(--saffron); font-size:16px;"></i>
                <span style="font-size:14px; font-weight:500;">Privacy Policy</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>
          </div>
        </div>

        <!-- Logout Button -->
        <div style="padding:24px 16px;">
          <button id="btn-logout" style="
            display:flex; align-items:center; justify-content:center;
            width:100%; padding:14px; gap:8px;
            font-size:15px; font-weight:600; color:#fff;
            background:linear-gradient(135deg, #d32f2f, #b71c1c);
            border:none; border-radius:12px;
            box-shadow:0 4px 14px rgba(211,47,47,0.3);
            cursor:pointer;
            transition:transform 0.15s, box-shadow 0.15s;
          " onmouseenter="this.style.transform='translateY(-1px)'" onmouseleave="this.style.transform=''">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>

        <!-- Bottom Nav -->
        ${Nav().render(citizenNavItems, 3)}

        <!-- Chatbot -->
        ${Chatbot().render()}

        <!-- Notification Panel -->
        <div id="notification-panel" class="notification-panel" style="display:none;"></div>
        <div id="notification-overlay" class="notification-overlay" style="display:none;"></div>
      </div>
    `;

    // ── Event listeners ──
    const langSelect = document.getElementById('profile-lang-select');
    const logoutBtn = document.getElementById('btn-logout');
    const linkAbout = document.getElementById('link-about');
    const linkTerms = document.getElementById('link-terms');
    const linkPrivacy = document.getElementById('link-privacy');

    // Toggle switches styling
    function setupToggle(checkboxId) {
      const checkbox = document.getElementById(checkboxId);
      if (!checkbox) return;
      const track = checkbox.nextElementSibling;
      const knob = track?.nextElementSibling;
      if (!track || !knob) return;

      function updateToggleStyle() {
        if (checkbox.checked) {
          track.style.background = 'var(--green)';
          knob.style.left = '22px';
        } else {
          track.style.background = 'var(--border)';
          knob.style.left = '2px';
        }
      }

      checkbox.addEventListener('change', updateToggleStyle);
      updateToggleStyle(); // initial state
    }

    setupToggle('toggle-push');
    setupToggle('toggle-email');
    setupToggle('toggle-sms');

    function onLangChange() {
      const lang = langSelect.value;
      State()?.set('language', lang);
      localStorage.setItem('ekraah_lang', lang);
      Toast().show('Language preference updated', 'success');
    }

    function onLogout() {
      Modal().show({
        title: 'Logout',
        content: '<p style="font-size:14px; color:var(--text-secondary);">Are you sure you want to logout?</p>',
        size: 'sm',
        footer: `
          <button id="modal-cancel-btn" style="
            padding:10px 24px; border:1px solid var(--border); border-radius:8px;
            background:var(--bg-primary); color:var(--text-primary);
            font-size:14px; font-weight:500; cursor:pointer; margin-right:8px;
          ">Cancel</button>
          <button id="modal-confirm-logout" style="
            padding:10px 24px; border:none; border-radius:8px;
            background:var(--error); color:#fff;
            font-size:14px; font-weight:600; cursor:pointer;
          ">Logout</button>
        `
      });

      requestAnimationFrame(() => {
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-logout');
        if (cancelBtn) cancelBtn.addEventListener('click', () => Modal().close());
        if (confirmBtn) {
          confirmBtn.addEventListener('click', async () => {
            Modal().close();
            try {
              await Auth().signOut();
              Toast().show('Logged out successfully', 'success');
              Router().navigate('/welcome');
            } catch (err) {
              Toast().show('Logout failed. Please try again.', 'error');
            }
          });
        }
      });
    }

    function onNonFunctionalLink(e) {
      e.preventDefault();
      Toast().show('This feature is coming soon!', 'info');
    }

    langSelect.addEventListener('change', onLangChange);
    logoutBtn.addEventListener('click', onLogout);
    linkAbout.addEventListener('click', onNonFunctionalLink);
    linkTerms.addEventListener('click', onNonFunctionalLink);
    linkPrivacy.addEventListener('click', onNonFunctionalLink);

    attachNotifBell();
    Chatbot().initFabListener();

    return function cleanup() {
      langSelect.removeEventListener('change', onLangChange);
      logoutBtn.removeEventListener('click', onLogout);
      linkAbout.removeEventListener('click', onNonFunctionalLink);
      linkTerms.removeEventListener('click', onNonFunctionalLink);
      linkPrivacy.removeEventListener('click', onNonFunctionalLink);
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // REGISTER ALL ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  Router().register('/citizen/home', renderCitizenHome);
  Router().register('/citizen/application/:slug', renderApplicationPage);
  Router().register('/citizen/services', renderServicesPage);
  Router().register('/citizen/applications', renderMyApplications);
  Router().register('/citizen/application-detail/:id', renderApplicationDetail);
  Router().register('/citizen/documents', renderMyDocuments);
  Router().register('/citizen/profile', renderCitizenProfile);

})();
