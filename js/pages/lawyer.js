/**
 * ekRAAH - Lawyer Pages Module
 *
 * Registers routes for:
 *   /lawyer/home          - Lawyer dashboard with stats & recent cases
 *   /lawyer/find-case     - Browse and accept available cases
 *   /lawyer/my-cases      - List of lawyer's active/completed cases
 *   /lawyer/case-detail/:id - Detailed view of a single case
 *   /lawyer/profile       - Lawyer profile & settings
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
  const Helpers = () => window.EkraahDBHelpers;
  const Toast   = () => window.EkraahToast;
  const Comp    = () => window.EkraahComponents;
  const Nav     = () => window.EkraahBottomNav;
  const Notifs  = () => window.EkraahNotifications;
  const Modal   = () => window.EkraahModal;

  // ── Shared bottom nav items ──
  const lawyerNavItems = [
    { label: 'Home', icon: 'fas fa-house', route: '/lawyer/home' },
    { label: 'Find Case', icon: 'fas fa-search', route: '/lawyer/find-case' },
    { label: 'My Cases', icon: 'fas fa-briefcase', route: '/lawyer/my-cases' },
    { label: 'Profile', icon: 'fas fa-user', route: '/lawyer/profile' }
  ];

  // ── Language options ──
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

  // ── Helpers ──

  /**
   * Get lawyer details (specialization, bar council number) from state or fetch.
   * Caches in EkraahState.
   */
  async function getLawyerInfo() {
    const cached = State().get('lawyerDetails');
    if (cached) return cached;

    const user = State().get('currentUser');
    const profile = State().get('profile');
    const userId = user?.id || profile?.id;

    if (!userId) return null;

    try {
      const details = await Auth().getLawyerDetails(userId);
      if (details) {
        State().set('lawyerDetails', details);
      }
      return details;
    } catch (err) {
      console.error('Error fetching lawyer details:', err);
      return null;
    }
  }

  /**
   * Get the lawyer's profile ID (used as lawyerId in DB helpers).
   */
  function getLawyerId() {
    const profile = State().get('profile');
    return profile?.id || null;
  }

  /**
   * Build a top bar HTML string.
   * @param {Object} opts
   * @param {string} opts.title - Page title
   * @param {boolean} opts.showLogo - Show mini logo on left
   * @param {boolean} opts.showBell - Show notification bell
   * @param {string} opts.backRoute - If set, show back button instead of logo
   * @returns {string} HTML string
   */
  function topBar({ title, showLogo = false, showBell = false, backRoute = '' }) {
    const leftContent = backRoute
      ? `<button class="btn btn-icon" id="topbar-back-btn" data-route="${backRoute}" style="color:var(--text-primary);">
           <i class="fas fa-arrow-left" style="font-size:20px;"></i>
         </button>`
      : showLogo
        ? Comp().logo('mini')
        : '<div></div>';

    const bellHtml = showBell ? Notifs().renderBell() : '';

    return `
      <header style="
        display:flex; align-items:center; justify-content:space-between;
        padding:var(--space-4) var(--space-4) var(--space-2);
        background:var(--bg-white);
        position:sticky; top:0; z-index:var(--z-sticky);
      ">
        <div style="display:flex; align-items:center; gap:var(--space-3);">
          ${leftContent}
        </div>
        <h1 style="
          font-size:var(--text-lg); font-weight:var(--font-semibold);
          color:var(--text-primary); flex:1; text-align:center;
        ">${title}</h1>
        <div style="display:flex; align-items:center; gap:var(--space-2);">
          ${bellHtml}
        </div>
      </header>
    `;
  }

  /**
   * Attach notification bell click listener.
   */
  function attachBellListener() {
    const bellBtn = document.getElementById('notification-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => Notifs().toggle());
    }
  }

  /**
   * Attach back button listener.
   */
  function attachBackListener() {
    const backBtn = document.getElementById('topbar-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const route = backBtn.getAttribute('data-route');
        if (route) Router().navigate(route);
      });
    }
  }

  /**
   * Truncate text to a max length with ellipsis.
   */
  function truncate(text, maxLen = 100) {
    if (!text) return '';
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
  }

  /**
   * Get initials from a name string.
   */
  function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  /**
   * Render a stat card HTML.
   */
  function statCard({ label, value, icon, bgColor }) {
    return `
      <div style="
        background:var(--bg-white);
        border-radius:var(--radius-lg);
        padding:var(--space-4);
        box-shadow:var(--shadow-sm);
        display:flex;
        align-items:center;
        gap:var(--space-3);
      ">
        <div style="
          width:44px; height:44px; border-radius:var(--radius-md);
          display:flex; align-items:center; justify-content:center;
          background:${bgColor}; flex-shrink:0;
        ">
          <i class="${icon}" style="font-size:20px; color:var(--text-inverse);"></i>
        </div>
        <div>
          <div style="font-size:var(--text-2xl); font-weight:var(--font-bold); color:var(--text-primary); line-height:1;">
            ${value}
          </div>
          <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:2px;">
            ${label}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Friendly label for form_data keys.
   */
  const FIELD_LABELS = {
    full_name: 'Full Name',
    dispute_description: 'Dispute Description',
    dispute_location: 'Dispute Location',
    survey_number: 'Survey Number',
    land_area: 'Land Area',
    opposing_party: 'Opposing Party',
    expected_resolution: 'Expected Resolution',
    aadhaar_number: 'Aadhaar Number',
    phone: 'Phone Number',
    address: 'Address',
    district: 'District',
    state: 'State',
    pin_code: 'PIN Code',
    land_type: 'Land Type',
    ownership_duration: 'Ownership Duration',
    previous_case_number: 'Previous Case Number',
    documents_submitted: 'Documents Submitted',
    additional_details: 'Additional Details'
  };

  /**
   * Get a friendly label for a form data key.
   */
  function getFieldLabel(key) {
    return FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * Check if a form data value should be displayed.
   */
  function isDisplayableValue(val) {
    if (val === null || val === undefined || val === '') return false;
    if (typeof val === 'object') return false; // skip arrays/objects
    return true;
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 1. LAWYER HOME PAGE  (/lawyer/home)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderLawyerHome() {
    // Auth guard
    const isAuthorized = await Auth().requireRole('lawyer');
    if (!isAuthorized) return;

    const app = document.getElementById('app');

    // Show loading state
    app.innerHTML = `
      <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
        ${topBar({ title: 'Dashboard', showLogo: true, showBell: false })}
        <div style="padding:var(--space-4);">
          ${Comp().spinner('lg')}
        </div>
      </div>
    `;
    attachBellListener();

    try {
      const lawyerId = getLawyerId();
      const lawyerInfo = await getLawyerInfo();
      const specialization = lawyerInfo?.specialization || '';

      // Fetch data in parallel
      const [cases, availableCases] = await Promise.all([
        lawyerId ? Helpers().getLawyerCases(lawyerId) : Promise.resolve([]),
        specialization ? Helpers().getAvailableCases(specialization) : Promise.resolve([])
      ]);

      // Compute stats
      const activeCases = cases.filter(c => c.status === 'active').length;
      const completedCases = cases.filter(c => c.status === 'completed').length;
      const pendingOffers = availableCases.length;
      const totalCases = cases.length;

      // Recent 5 cases
      const recentCases = cases.slice(0, 5);

      // Recent cases HTML
      const recentCasesHtml = recentCases.length > 0
        ? recentCases.map(c => {
            const appData = c.applications || {};
            const citizenProfile = appData.profiles || {};
            const citizenName = citizenProfile.full_name || 'Unknown';
            const caseType = appData.application_types?.name || 'Case';
            const dateAccepted = c.accepted_at || c.created_at;
            return `
              <a href="#/lawyer/case-detail/${c.application_id}" style="
                display:flex; align-items:center; gap:var(--space-3);
                padding:var(--space-3) var(--space-4);
                background:var(--bg-white);
                border-radius:var(--radius-md);
                margin-bottom:var(--space-2);
                box-shadow:var(--shadow-sm);
                text-decoration:none;
                transition:box-shadow var(--transition-fast);
              " class="recent-case-item" data-case-id="${c.application_id}">
                <div style="
                  width:40px; height:40px; border-radius:var(--radius-md);
                  background:var(--light-saffron); display:flex;
                  align-items:center; justify-content:center; flex-shrink:0;
                ">
                  <i class="fas fa-gavel" style="color:var(--saffron); font-size:16px;"></i>
                </div>
                <div style="flex:1; min-width:0;">
                  <div style="font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--text-primary);">
                    ${citizenName}
                  </div>
                  <div style="font-size:var(--text-xs); color:var(--text-secondary);">
                    ${caseType}
                  </div>
                </div>
                <div style="text-align:right; flex-shrink:0;">
                  ${Comp().statusBadge(c.status === 'active' ? 'active' : c.status)}
                  <div style="font-size:var(--text-xs); color:var(--text-light); margin-top:2px;">
                    ${Comp().timeAgo(dateAccepted)}
                  </div>
                </div>
                <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px; flex-shrink:0;"></i>
              </a>
            `;
          }).join('')
        : `
          <div style="
            text-align:center; padding:var(--space-8) var(--space-4);
            color:var(--text-light);
          ">
            <i class="fas fa-briefcase" style="font-size:36px; opacity:0.3; margin-bottom:var(--space-3); display:block;"></i>
            <p style="font-size:var(--text-sm);">No cases yet. Browse available cases to get started.</p>
          </div>
        `;

      // Full render
      app.innerHTML = `
        <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
          ${topBar({ title: 'Dashboard', showLogo: true, showBell: false })}

          <div style="padding:var(--space-4);">
            <!-- Stats Grid -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-3); margin-bottom:var(--space-6);">
              ${statCard({ label: 'Active Cases', value: activeCases, icon: 'fas fa-briefcase', bgColor: '#00897B' })}
              ${statCard({ label: 'Cases Completed', value: completedCases, icon: 'fas fa-circle-check', bgColor: '#2e7d32' })}
              ${statCard({ label: 'Pending Offers', value: pendingOffers, icon: 'fas fa-clock', bgColor: '#f57c00' })}
              ${statCard({ label: 'Total Cases', value: totalCases, icon: 'fas fa-folder', bgColor: '#000080' })}
            </div>

            <!-- Recent Cases Section -->
            <div style="margin-bottom:var(--space-6);">
              <div style="
                display:flex; align-items:center; justify-content:space-between;
                margin-bottom:var(--space-3);
              ">
                <h2 style="font-size:var(--text-md); font-weight:var(--font-semibold); color:var(--text-primary);">
                  Recent Cases
                </h2>
                ${cases.length > 5 ? `
                  <a href="#/lawyer/my-cases" style="
                    font-size:var(--text-sm); color:var(--saffron);
                    font-weight:var(--font-medium); text-decoration:none;
                  ">View All</a>
                ` : ''}
              </div>
              ${recentCasesHtml}
            </div>

            <!-- Quick Actions -->
            <div style="margin-bottom:var(--space-6);">
              <h2 style="
                font-size:var(--text-md); font-weight:var(--font-semibold);
                color:var(--text-primary); margin-bottom:var(--space-3);
              ">Quick Actions</h2>
              <div style="display:flex; flex-direction:column; gap:var(--space-3);">
                <button id="btn-find-cases" style="
                  display:flex; align-items:center; gap:var(--space-3);
                  width:100%; padding:var(--space-4);
                  background:var(--bg-white); border:1.5px solid var(--border);
                  border-radius:var(--radius-lg); cursor:pointer;
                  font-size:var(--text-base); color:var(--text-primary);
                  font-weight:var(--font-medium);
                  transition:border-color var(--transition-fast), box-shadow var(--transition-fast);
                  text-align:left;
                ">
                  <div style="
                    width:44px; height:44px; border-radius:var(--radius-md);
                    background:var(--light-saffron); display:flex;
                    align-items:center; justify-content:center; flex-shrink:0;
                  ">
                    <i class="fas fa-search" style="color:var(--saffron); font-size:18px;"></i>
                  </div>
                  <div>
                    <div style="font-weight:var(--font-semibold);">Find New Cases</div>
                    <div style="font-size:var(--text-xs); color:var(--text-secondary);">
                      Browse available cases matching your specialization
                    </div>
                  </div>
                  <i class="fas fa-chevron-right" style="margin-left:auto; color:var(--text-light); font-size:14px;"></i>
                </button>
                <button id="btn-my-cases" style="
                  display:flex; align-items:center; gap:var(--space-3);
                  width:100%; padding:var(--space-4);
                  background:var(--bg-white); border:1.5px solid var(--border);
                  border-radius:var(--radius-lg); cursor:pointer;
                  font-size:var(--text-base); color:var(--text-primary);
                  font-weight:var(--font-medium);
                  transition:border-color var(--transition-fast), box-shadow var(--transition-fast);
                  text-align:left;
                ">
                  <div style="
                    width:44px; height:44px; border-radius:var(--radius-md);
                    background:var(--light-green); display:flex;
                    align-items:center; justify-content:center; flex-shrink:0;
                  ">
                    <i class="fas fa-briefcase" style="color:var(--green); font-size:18px;"></i>
                  </div>
                  <div>
                    <div style="font-weight:var(--font-semibold);">View My Cases</div>
                    <div style="font-size:var(--text-xs); color:var(--text-secondary);">
                      Manage your active and completed cases
                    </div>
                  </div>
                  <i class="fas fa-chevron-right" style="margin-left:auto; color:var(--text-light); font-size:14px;"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Bottom Nav -->
          ${Nav().render(lawyerNavItems, 0)}
        </div>
      `;

      // Attach listeners
      attachBellListener();

      const btnFindCases = document.getElementById('btn-find-cases');
      const btnMyCases = document.getElementById('btn-my-cases');

      function onFindCases() { Router().navigate('/lawyer/find-case'); }
      function onMyCases() { Router().navigate('/lawyer/my-cases'); }

      if (btnFindCases) btnFindCases.addEventListener('click', onFindCases);
      if (btnMyCases) btnMyCases.addEventListener('click', onMyCases);

      // Cleanup
      return function cleanup() {
        if (btnFindCases) btnFindCases.removeEventListener('click', onFindCases);
        if (btnMyCases) btnMyCases.removeEventListener('click', onMyCases);
      };

    } catch (err) {
      console.error('Error loading lawyer home:', err);
      Toast().show('Failed to load dashboard. Please try again.', 'error');

      app.innerHTML = `
        <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
          ${topBar({ title: 'Dashboard', showLogo: true, showBell: false })}
          <div style="padding:var(--space-4); text-align:center; padding-top:var(--space-16);">
            <i class="fas fa-exclamation-circle" style="font-size:48px; color:var(--error); margin-bottom:var(--space-4);"></i>
            <p style="color:var(--text-secondary); margin-bottom:var(--space-4);">Failed to load dashboard data.</p>
            <button onclick="window.EkraahRouter.navigate('/lawyer/home')" style="
              padding:var(--space-3) var(--space-6); background:var(--saffron);
              color:var(--text-inverse); border:none; border-radius:var(--radius-md);
              font-weight:var(--font-semibold); cursor:pointer;
            ">Retry</button>
          </div>
          ${Nav().render(lawyerNavItems, 0)}
        </div>
      `;
      attachBellListener();
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 2. FIND A CASE PAGE  (/lawyer/find-case)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderFindCase() {
    // Auth guard
    const isAuthorized = await Auth().requireRole('lawyer');
    if (!isAuthorized) return;

    const app = document.getElementById('app');

    // Show loading
    app.innerHTML = `
      <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
        ${topBar({ title: 'Find a Case', showBell: false })}
        <div style="padding:var(--space-4);">
          ${Comp().spinner('lg')}
        </div>
        ${Nav().render(lawyerNavItems, 1)}
      </div>
    `;
    attachBellListener();

    try {
      const lawyerInfo = await getLawyerInfo();
      const specialization = lawyerInfo?.specialization || '';
      const availableCases = specialization
        ? await Helpers().getAvailableCases(specialization)
        : [];

      // Store for search/filter
      let filteredCases = [...availableCases];

      function renderCasesList(cases) {
        if (cases.length === 0) {
          return `
            <div style="
              text-align:center; padding:var(--space-10) var(--space-4);
              color:var(--text-light);
            ">
              <i class="fas fa-search" style="font-size:48px; opacity:0.3; margin-bottom:var(--space-4); display:block;"></i>
              <p style="font-size:var(--text-base); font-weight:var(--font-medium); color:var(--text-secondary); margin-bottom:var(--space-2);">
                ${availableCases.length === 0
                  ? 'No cases available matching your specialization at this time.'
                  : 'No cases match your search.'}
              </p>
              ${availableCases.length === 0 ? `
                <p style="font-size:var(--text-sm); color:var(--text-light);">
                  New cases will appear here when citizens file applications.
                </p>
              ` : ''}
            </div>
          `;
        }

        return cases.map(c => {
          const caseType = c.application_types?.name || 'Case';
          const formData = c.form_data || {};
          const citizenName = formData.full_name || 'Unknown Citizen';
          const description = truncate(formData.dispute_description || '', 100);
          const filedDate = Comp().formatDate(c.created_at);

          return `
            <div style="
              background:var(--bg-white);
              border-radius:var(--radius-lg);
              padding:var(--space-4);
              margin-bottom:var(--space-3);
              box-shadow:var(--shadow-sm);
            " data-case-id="${c.id}">
              <div style="display:flex; gap:var(--space-3);">
                <!-- Case type icon -->
                <div style="
                  width:44px; height:44px; border-radius:var(--radius-md);
                  background:var(--light-green); display:flex;
                  align-items:center; justify-content:center; flex-shrink:0;
                ">
                  <i class="fas fa-gavel" style="color:var(--green); font-size:18px;"></i>
                </div>

                <!-- Case info -->
                <div style="flex:1; min-width:0;">
                  <div style="font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:2px;">
                    ${caseType}
                  </div>
                  <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-bottom:4px;">
                    <i class="fas fa-user" style="margin-right:4px;"></i>${citizenName}
                  </div>
                  ${description ? `
                    <div style="font-size:var(--text-xs); color:var(--text-light); line-height:var(--leading-normal); margin-bottom:4px;">
                      ${description}
                    </div>
                  ` : ''}
                  <div style="font-size:var(--text-xs); color:var(--text-light);">
                    <i class="fas fa-calendar" style="margin-right:4px;"></i>Filed: ${filedDate}
                  </div>
                </div>

                <!-- Accept button -->
                <div style="display:flex; align-items:center; flex-shrink:0;">
                  <button class="btn-accept-case" data-app-id="${c.id}" data-citizen-id="${c.citizen_id}" style="
                    padding:var(--space-2) var(--space-4);
                    background:var(--green);
                    color:var(--text-inverse);
                    border:none;
                    border-radius:var(--radius-md);
                    font-size:var(--text-xs);
                    font-weight:var(--font-semibold);
                    cursor:pointer;
                    white-space:nowrap;
                    transition:opacity var(--transition-fast), transform var(--transition-fast);
                  ">
                    Accept Case
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }

      // Full render
      app.innerHTML = `
        <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
          ${topBar({ title: 'Find a Case', showBell: false })}

          <div style="padding:var(--space-4);">
            <!-- Specialization badge -->
            ${specialization ? `
              <div style="
                display:inline-flex; align-items:center; gap:var(--space-2);
                padding:var(--space-2) var(--space-3);
                background:var(--light-saffron); border-radius:var(--radius-full);
                font-size:var(--text-xs); color:var(--saffron-dark);
                font-weight:var(--font-medium); margin-bottom:var(--space-4);
              ">
                <i class="fas fa-scale-balanced"></i>
                ${specialization}
              </div>
            ` : ''}

            <!-- Search/Filter bar -->
            <div class="search-bar" style="margin-bottom:var(--space-4);">
              <i class="fas fa-search search-icon"></i>
              <input type="text" id="case-search-input" placeholder="Search cases by name or type..." style="
                width:100%;
                padding:var(--space-3) var(--space-4);
                padding-left:var(--space-10);
                font-size:var(--text-base);
                color:var(--text-primary);
                background:var(--bg-white);
                border:1.5px solid var(--border);
                border-radius:var(--radius-lg);
                transition:border-color var(--transition-fast), box-shadow var(--transition-fast);
              " />
            </div>

            <!-- Cases list -->
            <div id="available-cases-list">
              ${renderCasesList(availableCases)}
            </div>
          </div>

          ${Nav().render(lawyerNavItems, 1)}
        </div>
      `;

      attachBellListener();

      // ── Event listeners ──

      // Search
      const searchInput = document.getElementById('case-search-input');
      function onSearchInput() {
        const query = searchInput.value.trim().toLowerCase();
        filteredCases = availableCases.filter(c => {
          const caseType = (c.application_types?.name || '').toLowerCase();
          const citizenName = (c.form_data?.full_name || '').toLowerCase();
          const description = (c.form_data?.dispute_description || '').toLowerCase();
          return caseType.includes(query) || citizenName.includes(query) || description.includes(query);
        });
        const listContainer = document.getElementById('available-cases-list');
        if (listContainer) {
          listContainer.innerHTML = renderCasesList(filteredCases);
          attachAcceptListeners();
        }
      }

      if (searchInput) {
        searchInput.addEventListener('input', onSearchInput);
        searchInput.addEventListener('focus', function () {
          this.style.borderColor = 'var(--saffron)';
          this.style.boxShadow = '0 0 0 3px rgba(255,153,51,0.12)';
        });
        searchInput.addEventListener('blur', function () {
          this.style.borderColor = 'var(--border)';
          this.style.boxShadow = 'none';
        });
      }

      // Accept case
      function attachAcceptListeners() {
        const acceptBtns = document.querySelectorAll('.btn-accept-case');
        acceptBtns.forEach(btn => {
          btn.addEventListener('click', handleAcceptCase);
        });
      }

      async function handleAcceptCase(e) {
        e.stopPropagation();
        const btn = e.currentTarget;

        // Prevent double-click — if already processing, ignore
        if (btn.disabled) return;
        btn.disabled = true;
        btn.style.opacity = '0.6';

        const appId = btn.getAttribute('data-app-id');
        const citizenId = btn.getAttribute('data-citizen-id');

        // Confirm modal
        Modal().show({
          title: 'Accept Case',
          content: `
            <div style="text-align:center; padding:var(--space-2) 0;">
              <i class="fas fa-gavel" style="font-size:40px; color:var(--green); margin-bottom:var(--space-4); display:block;"></i>
              <p style="font-size:var(--text-base); color:var(--text-primary); line-height:var(--leading-relaxed);">
                Are you sure you want to accept this case? You will be responsible for representing the citizen.
              </p>
            </div>
          `,
          size: 'sm',
          footer: `
            <button id="modal-cancel-btn" style="
              padding:var(--space-3) var(--space-6);
              background:var(--bg-page); color:var(--text-secondary);
              border:1.5px solid var(--border); border-radius:var(--radius-md);
              font-weight:var(--font-medium); cursor:pointer; font-size:var(--text-sm);
              transition:background-color var(--transition-fast);
            ">Cancel</button>
            <button id="modal-confirm-accept" style="
              padding:var(--space-3) var(--space-6);
              background:var(--green); color:var(--text-inverse);
              border:none; border-radius:var(--radius-md);
              font-weight:var(--font-semibold); cursor:pointer; font-size:var(--text-sm);
              transition:opacity var(--transition-fast);
            ">Accept</button>
          `
        });

        // Wait for DOM to render modal
        requestAnimationFrame(() => {
          const cancelBtn = document.getElementById('modal-cancel-btn');
          const confirmBtn = document.getElementById('modal-confirm-accept');

          if (cancelBtn) cancelBtn.addEventListener('click', () => {
            Modal().close();
            // Re-enable the Accept button if cancelled
            btn.disabled = false;
            btn.style.opacity = '1';
          });
          if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
              confirmBtn.disabled = true;
              confirmBtn.textContent = 'Accepting...';
              confirmBtn.style.opacity = '0.7';

              try {
                const lawyerId = getLawyerId();
                const profile = State().get('profile');
                const lawyerName = profile?.full_name || 'A lawyer';

                await Helpers().acceptCase(lawyerId, appId);

                // Send notification to citizen (non-blocking — don't fail the whole action if this errors)
                try {
                  await Helpers().createNotification(
                    citizenId,
                    'Case Accepted',
                    `Lawyer ${lawyerName} has accepted your land dispute case. They will be in touch with you shortly.`,
                    'lawyer_accepted',
                    appId
                  );
                } catch (notifErr) {
                  console.warn('Could not send notification (non-fatal):', notifErr);
                }

                Toast().show('Case accepted successfully!', 'success');
                Modal().close();

                // Remove the accepted case card from the list immediately
                const caseCard = btn.closest('[data-case-id]');
                if (caseCard) {
                  caseCard.style.transition = 'opacity 0.3s, transform 0.3s';
                  caseCard.style.opacity = '0';
                  caseCard.style.transform = 'translateX(20px)';
                  setTimeout(() => caseCard.remove(), 300);
                }

              } catch (err) {
                console.error('Error accepting case:', err);
                Toast().show('Failed to accept case. Please try again.', 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Accept';
                confirmBtn.style.opacity = '1';
                btn.disabled = false;
                btn.style.opacity = '1';
              }
            });
          }
        });
      }

      attachAcceptListeners();

      // Cleanup
      return function cleanup() {
        if (searchInput) searchInput.removeEventListener('input', onSearchInput);
      };

    } catch (err) {
      console.error('Error loading find case page:', err);
      Toast().show('Failed to load available cases.', 'error');

      app.innerHTML = `
        <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
          ${topBar({ title: 'Find a Case', showBell: false })}
          <div style="padding:var(--space-4); text-align:center; padding-top:var(--space-16);">
            <i class="fas fa-exclamation-circle" style="font-size:48px; color:var(--error); margin-bottom:var(--space-4);"></i>
            <p style="color:var(--text-secondary); margin-bottom:var(--space-4);">Failed to load cases.</p>
            <button onclick="window.EkraahRouter.navigate('/lawyer/find-case')" style="
              padding:var(--space-3) var(--space-6); background:var(--saffron);
              color:var(--text-inverse); border:none; border-radius:var(--radius-md);
              font-weight:var(--font-semibold); cursor:pointer;
            ">Retry</button>
          </div>
          ${Nav().render(lawyerNavItems, 1)}
        </div>
      `;
      attachBellListener();
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 3. MY CASES PAGE  (/lawyer/my-cases)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderMyCases() {
    // Auth guard
    const isAuthorized = await Auth().requireRole('lawyer');
    if (!isAuthorized) return;

    const app = document.getElementById('app');

    // Show loading
    app.innerHTML = `
      <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
        ${topBar({ title: 'My Cases', showBell: false })}
        <div style="padding:var(--space-4);">
          ${Comp().spinner('lg')}
        </div>
        ${Nav().render(lawyerNavItems, 2)}
      </div>
    `;
    attachBellListener();

    try {
      const lawyerId = getLawyerId();
      const cases = lawyerId ? await Helpers().getLawyerCases(lawyerId) : [];

      let currentFilter = 'all'; // all | active | completed

      function renderFilteredCases(filter) {
        let filtered = cases;
        if (filter === 'active') {
          filtered = cases.filter(c => c.status === 'active');
        } else if (filter === 'completed') {
          filtered = cases.filter(c => c.status === 'completed');
        }

        if (filtered.length === 0) {
          const emptyMsg = cases.length === 0
            ? 'No cases yet. Browse available cases to get started.'
            : `No ${filter} cases found.`;
          return `
            <div style="
              text-align:center; padding:var(--space-10) var(--space-4);
              color:var(--text-light);
            ">
              <i class="fas fa-briefcase" style="font-size:48px; opacity:0.3; margin-bottom:var(--space-4); display:block;"></i>
              <p style="font-size:var(--text-sm);">${emptyMsg}</p>
              ${cases.length === 0 ? `
                <button onclick="window.EkraahRouter.navigate('/lawyer/find-case')" style="
                  margin-top:var(--space-4);
                  padding:var(--space-3) var(--space-6);
                  background:var(--saffron); color:var(--text-inverse);
                  border:none; border-radius:var(--radius-md);
                  font-weight:var(--font-semibold); cursor:pointer;
                ">Browse Cases</button>
              ` : ''}
            </div>
          `;
        }

        return filtered.map(c => {
          const appData = c.applications || {};
          const citizenProfile = appData.profiles || {};
          const citizenName = citizenProfile.full_name || 'Unknown';
          const caseType = appData.application_types?.name || 'Case';
          const dateAccepted = c.accepted_at || c.created_at;

          return `
            <a href="#/lawyer/case-detail/${c.application_id}" style="
              display:flex; align-items:center; gap:var(--space-3);
              padding:var(--space-4);
              background:var(--bg-white);
              border-radius:var(--radius-lg);
              margin-bottom:var(--space-3);
              box-shadow:var(--shadow-sm);
              text-decoration:none;
              transition:box-shadow var(--transition-fast);
            " class="case-list-item">
              <!-- Case type icon -->
              <div style="
                width:44px; height:44px; border-radius:var(--radius-md);
                background:${c.status === 'active' ? 'var(--light-saffron)' : 'var(--light-green)'};
                display:flex; align-items:center; justify-content:center; flex-shrink:0;
              ">
                <i class="fas fa-gavel" style="color:${c.status === 'active' ? 'var(--saffron)' : 'var(--green)'}; font-size:18px;"></i>
              </div>

              <!-- Case info -->
              <div style="flex:1; min-width:0;">
                <div style="font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--text-primary);">
                  ${caseType}
                </div>
                <div style="font-size:var(--text-xs); color:var(--text-secondary);">
                  ${citizenName}
                </div>
                <div style="font-size:var(--text-xs); color:var(--text-light); margin-top:2px;">
                  ${Comp().formatDate(dateAccepted)}
                </div>
              </div>

              <!-- Status & chevron -->
              <div style="display:flex; flex-direction:column; align-items:flex-end; gap:var(--space-2); flex-shrink:0;">
                ${Comp().statusBadge(c.status === 'active' ? 'active' : 'completed')}
                <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
              </div>
            </a>
          `;
        }).join('');
      }

      // Full render
      app.innerHTML = `
        <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
          ${topBar({ title: 'My Cases', showBell: false })}

          <div style="padding:var(--space-4);">
            <!-- Filter tabs -->
            <div style="
              display:flex; background:var(--bg-white);
              border-radius:var(--radius-md); padding:var(--space-1);
              margin-bottom:var(--space-4);
              box-shadow:var(--shadow-sm);
            " id="filter-tabs">
              <button class="filter-tab active" data-filter="all" style="
                flex:1; padding:var(--space-2) var(--space-4);
                border:none; border-radius:var(--radius-sm);
                font-size:var(--text-sm); font-weight:var(--font-medium);
                cursor:pointer; text-align:center;
                transition:all var(--transition-fast);
                background:var(--saffron); color:var(--text-inverse);
              ">All</button>
              <button class="filter-tab" data-filter="active" style="
                flex:1; padding:var(--space-2) var(--space-4);
                border:none; border-radius:var(--radius-sm);
                font-size:var(--text-sm); font-weight:var(--font-medium);
                cursor:pointer; text-align:center;
                transition:all var(--transition-fast);
                background:transparent; color:var(--text-secondary);
              ">Active</button>
              <button class="filter-tab" data-filter="completed" style="
                flex:1; padding:var(--space-2) var(--space-4);
                border:none; border-radius:var(--radius-sm);
                font-size:var(--text-sm); font-weight:var(--font-medium);
                cursor:pointer; text-align:center;
                transition:all var(--transition-fast);
                background:transparent; color:var(--text-secondary);
              ">Completed</button>
            </div>

            <!-- Cases list -->
            <div id="cases-list-container">
              ${renderFilteredCases('all')}
            </div>
          </div>

          ${Nav().render(lawyerNavItems, 2)}
        </div>
      `;

      attachBellListener();

      // Filter tab listeners
      const filterTabs = document.querySelectorAll('.filter-tab');
      function onFilterClick(e) {
        const btn = e.currentTarget;
        const filter = btn.getAttribute('data-filter');
        currentFilter = filter;

        // Update tab styles
        filterTabs.forEach(tab => {
          if (tab.getAttribute('data-filter') === filter) {
            tab.style.background = 'var(--saffron)';
            tab.style.color = 'var(--text-inverse)';
            tab.classList.add('active');
          } else {
            tab.style.background = 'transparent';
            tab.style.color = 'var(--text-secondary)';
            tab.classList.remove('active');
          }
        });

        // Re-render list
        const container = document.getElementById('cases-list-container');
        if (container) {
          container.innerHTML = renderFilteredCases(filter);
        }
      }

      filterTabs.forEach(tab => {
        tab.addEventListener('click', onFilterClick);
      });

      // Cleanup
      return function cleanup() {
        filterTabs.forEach(tab => {
          tab.removeEventListener('click', onFilterClick);
        });
      };

    } catch (err) {
      console.error('Error loading my cases:', err);
      Toast().show('Failed to load your cases.', 'error');

      app.innerHTML = `
        <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
          ${topBar({ title: 'My Cases', showBell: false })}
          <div style="padding:var(--space-4); text-align:center; padding-top:var(--space-16);">
            <i class="fas fa-exclamation-circle" style="font-size:48px; color:var(--error); margin-bottom:var(--space-4);"></i>
            <p style="color:var(--text-secondary); margin-bottom:var(--space-4);">Failed to load cases.</p>
            <button onclick="window.EkraahRouter.navigate('/lawyer/my-cases')" style="
              padding:var(--space-3) var(--space-6); background:var(--saffron);
              color:var(--text-inverse); border:none; border-radius:var(--radius-md);
              font-weight:var(--font-semibold); cursor:pointer;
            ">Retry</button>
          </div>
          ${Nav().render(lawyerNavItems, 2)}
        </div>
      `;
      attachBellListener();
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 4. CASE DETAIL PAGE  (/lawyer/case-detail/:id)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderCaseDetail(params) {
    // Auth guard
    const isAuthorized = await Auth().requireRole('lawyer');
    if (!isAuthorized) return;

    const appId = params?.id;
    if (!appId) {
      Router().navigate('/lawyer/my-cases');
      return;
    }

    const app = document.getElementById('app');

    // Show loading
    app.innerHTML = `
      <div class="page-container" style="min-height:100vh; background:var(--bg-page);">
        ${topBar({ title: 'Case Detail', backRoute: '/lawyer/my-cases', showBell: false })}
        <div style="padding:var(--space-4);">
          ${Comp().spinner('lg')}
        </div>
      </div>
    `;
    attachBackListener();

    try {
      const lawyerId = getLawyerId();

      // Fetch application and lawyer case data in parallel
      const [application, lawyerCases] = await Promise.all([
        Helpers().getApplicationById(appId),
        lawyerId ? Helpers().getLawyerCases(lawyerId) : Promise.resolve([])
      ]);

      // Find the matching lawyer_case entry
      const lawyerCase = lawyerCases.find(c => c.application_id === appId || String(c.application_id) === String(appId));

      if (!application) {
        app.innerHTML = `
          <div class="page-container" style="min-height:100vh; background:var(--bg-page);">
            ${topBar({ title: 'Case Detail', backRoute: '/lawyer/my-cases', showBell: false })}
            <div style="padding:var(--space-4); text-align:center; padding-top:var(--space-16);">
              <i class="fas fa-folder-open" style="font-size:48px; color:var(--text-light); margin-bottom:var(--space-4);"></i>
              <p style="color:var(--text-secondary);">Case not found.</p>
            </div>
          </div>
        `;
        attachBackListener();
        return;
      }

      const caseStatus = lawyerCase?.status || application.status;
      const isActive = caseStatus === 'active' || caseStatus === 'lawyer_assigned';
      const isCompleted = caseStatus === 'completed';
      const formData = application.form_data || {};
      const caseType = application.application_types?.name || 'Case';
      const citizenProfile = application.profiles || {};
      const citizenName = citizenProfile.full_name || formData.full_name || 'Unknown';
      const citizenEmail = citizenProfile.email || '';
      const dateAccepted = lawyerCase?.accepted_at || application.updated_at;
      const dateCompleted = lawyerCase?.completed_at || (isCompleted ? application.updated_at : null);

      // Build form data display
      const formDataEntries = Object.entries(formData)
        .filter(([key, val]) => isDisplayableValue(val))
        .map(([key, val]) => `
          <div style="display:flex; padding:var(--space-3) 0; border-bottom:1px solid var(--border-light);">
            <div style="
              width:40%; font-size:var(--text-sm); color:var(--text-secondary);
              font-weight:var(--font-medium); padding-right:var(--space-3);
            ">${getFieldLabel(key)}</div>
            <div style="
              flex:1; font-size:var(--text-sm); color:var(--text-primary);
              word-break:break-word; line-height:var(--leading-normal);
            ">${val}</div>
          </div>
        `).join('');

      // Full render
      app.innerHTML = `
        <div class="page-container" style="min-height:100vh; background:var(--bg-page); padding-bottom:var(--space-8);">
          ${topBar({ title: 'Case Detail', backRoute: '/lawyer/my-cases', showBell: false })}

          <div style="padding:var(--space-4);">
            <!-- Case Info Card -->
            <div style="
              background:var(--bg-white);
              border-radius:var(--radius-lg);
              padding:var(--space-5);
              margin-bottom:var(--space-4);
              box-shadow:var(--shadow-sm);
            ">
              <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-4);">
                <div style="
                  width:52px; height:52px; border-radius:var(--radius-lg);
                  background:${isActive ? 'var(--light-saffron)' : 'var(--light-green)'};
                  display:flex; align-items:center; justify-content:center; flex-shrink:0;
                ">
                  <i class="fas fa-gavel" style="color:${isActive ? 'var(--saffron)' : 'var(--green)'}; font-size:22px;"></i>
                </div>
                <div style="flex:1;">
                  <div style="font-size:var(--text-lg); font-weight:var(--font-bold); color:var(--text-primary);">
                    ${caseType}
                  </div>
                  <div style="margin-top:var(--space-1);">
                    ${Comp().statusBadge(isActive ? 'active' : isCompleted ? 'completed' : caseStatus)}
                  </div>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:var(--space-2);">
                <div style="display:flex; align-items:center; gap:var(--space-2);">
                  <i class="fas fa-user" style="color:var(--text-light); font-size:14px; width:20px; text-align:center;"></i>
                  <span style="font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium);">${citizenName}</span>
                </div>
                ${citizenEmail ? `
                  <div style="display:flex; align-items:center; gap:var(--space-2);">
                    <i class="fas fa-envelope" style="color:var(--text-light); font-size:14px; width:20px; text-align:center;"></i>
                    <span style="font-size:var(--text-sm); color:var(--text-secondary);">${citizenEmail}</span>
                  </div>
                ` : ''}
                <div style="display:flex; align-items:center; gap:var(--space-2);">
                  <i class="fas fa-calendar-check" style="color:var(--text-light); font-size:14px; width:20px; text-align:center;"></i>
                  <span style="font-size:var(--text-sm); color:var(--text-secondary);">Accepted: ${Comp().formatDate(dateAccepted)}</span>
                </div>
                ${isCompleted && dateCompleted ? `
                  <div style="display:flex; align-items:center; gap:var(--space-2);">
                    <i class="fas fa-flag-checkered" style="color:var(--text-light); font-size:14px; width:20px; text-align:center;"></i>
                    <span style="font-size:var(--text-sm); color:var(--text-secondary);">Completed: ${Comp().formatDate(dateCompleted)}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Case Details (Form Data) -->
            ${formDataEntries ? `
              <div style="
                background:var(--bg-white);
                border-radius:var(--radius-lg);
                padding:var(--space-5);
                margin-bottom:var(--space-4);
                box-shadow:var(--shadow-sm);
              ">
                <h3 style="
                  font-size:var(--text-md); font-weight:var(--font-semibold);
                  color:var(--text-primary); margin-bottom:var(--space-3);
                ">Case Details</h3>
                ${formDataEntries}
              </div>
            ` : ''}

            <!-- Action section (only for active cases) -->
            ${isActive ? `
              <div style="
                background:var(--bg-white);
                border-radius:var(--radius-lg);
                padding:var(--space-5);
                box-shadow:var(--shadow-sm);
              ">
                <h3 style="
                  font-size:var(--text-md); font-weight:var(--font-semibold);
                  color:var(--text-primary); margin-bottom:var(--space-3);
                ">Actions</h3>
                <button id="btn-complete-case" style="
                  display:flex; align-items:center; justify-content:center; gap:var(--space-2);
                  width:100%; padding:var(--space-4);
                  background:var(--green); color:var(--text-inverse);
                  border:none; border-radius:var(--radius-md);
                  font-size:var(--text-base); font-weight:var(--font-semibold);
                  cursor:pointer;
                  transition:opacity var(--transition-fast), transform var(--transition-fast);
                ">
                  <i class="fas fa-circle-check" style="font-size:18px;"></i>
                  Mark as Complete
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      attachBackListener();

      // Complete case button
      const btnComplete = document.getElementById('btn-complete-case');
      async function onCompleteCase() {
        Modal().show({
          title: 'Complete Case',
          content: `
            <div style="text-align:center; padding:var(--space-2) 0;">
              <i class="fas fa-circle-check" style="font-size:48px; color:var(--green); margin-bottom:var(--space-4); display:block;"></i>
              <p style="font-size:var(--text-base); color:var(--text-primary);">
                Are you sure you want to mark this case as complete?
              </p>
            </div>
          `,
          size: 'sm',
          footer: `
            <button id="modal-cancel-btn" style="
              padding:var(--space-3) var(--space-6);
              background:var(--bg-page); color:var(--text-secondary);
              border:1.5px solid var(--border); border-radius:var(--radius-md);
              font-weight:var(--font-medium); cursor:pointer; font-size:var(--text-sm);
            ">Cancel</button>
            <button id="modal-confirm-complete" style="
              padding:var(--space-3) var(--space-6);
              background:var(--green); color:var(--text-inverse);
              border:none; border-radius:var(--radius-md);
              font-weight:var(--font-semibold); cursor:pointer; font-size:var(--text-sm);
            ">Complete</button>
          `
        });

        requestAnimationFrame(() => {
          const cancelBtn = document.getElementById('modal-cancel-btn');
          const confirmBtn = document.getElementById('modal-confirm-complete');

          if (cancelBtn) cancelBtn.addEventListener('click', () => Modal().close());
          if (confirmBtn) {
            confirmBtn.addEventListener('click', async () => {
              confirmBtn.disabled = true;
              confirmBtn.textContent = 'Completing...';
              confirmBtn.style.opacity = '0.7';

              try {
                const lawyerIdInner = getLawyerId();
                const profile = State().get('profile');
                const lawyerName = profile?.full_name || 'A lawyer';

                await Helpers().completeCase(lawyerIdInner, appId);

                // Send notification to citizen (non-blocking)
                try {
                  await Helpers().createNotification(
                    application.citizen_id,
                    'Case Completed',
                    `Your land dispute case has been marked as completed by lawyer ${lawyerName}.`,
                    'case_completed',
                    appId
                  );
                } catch (notifErr) {
                  console.warn('Could not send notification (non-fatal):', notifErr);
                }

                Toast().show('Case marked as complete!', 'success');
                Modal().close();
                Router().navigate('/lawyer/my-cases');

              } catch (err) {
                console.error('Error completing case:', err);
                Toast().show('Failed to complete case. Please try again.', 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Complete';
                confirmBtn.style.opacity = '1';
              }
            });
          }
        });
      }

      if (btnComplete) {
        btnComplete.addEventListener('click', onCompleteCase);
      }

      // Cleanup
      return function cleanup() {
        if (btnComplete) btnComplete.removeEventListener('click', onCompleteCase);
      };

    } catch (err) {
      console.error('Error loading case detail:', err);
      Toast().show('Failed to load case details.', 'error');

      app.innerHTML = `
        <div class="page-container" style="min-height:100vh; background:var(--bg-page);">
          ${topBar({ title: 'Case Detail', backRoute: '/lawyer/my-cases', showBell: false })}
          <div style="padding:var(--space-4); text-align:center; padding-top:var(--space-16);">
            <i class="fas fa-exclamation-circle" style="font-size:48px; color:var(--error); margin-bottom:var(--space-4);"></i>
            <p style="color:var(--text-secondary); margin-bottom:var(--space-4);">Failed to load case details.</p>
            <button onclick="window.EkraahRouter.navigate('/lawyer/my-cases')" style="
              padding:var(--space-3) var(--space-6); background:var(--saffron);
              color:var(--text-inverse); border:none; border-radius:var(--radius-md);
              font-weight:var(--font-semibold); cursor:pointer;
            ">Back to My Cases</button>
          </div>
        </div>
      `;
      attachBackListener();
    }
  }


  // ═══════════════════════════════════════════════════════════════════════
  // 5. LAWYER PROFILE PAGE  (/lawyer/profile)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderLawyerProfile() {
    // Auth guard
    const isAuthorized = await Auth().requireRole('lawyer');
    if (!isAuthorized) return;

    const app = document.getElementById('app');

    const profile = State().get('profile');
    const user = State().get('currentUser');

    // Fetch lawyer details if needed
    const lawyerInfo = await getLawyerInfo();
    const fullName = profile?.full_name || user?.user_metadata?.full_name || 'Lawyer';
    const email = profile?.email || user?.email || '';
    const initials = getInitials(fullName);
    const specialization = lawyerInfo?.specialization || 'Not specified';
    const barCouncilNumber = lawyerInfo?.bar_council_number || 'Not available';

    const savedLang = State().get('language') || localStorage.getItem('ekraah_lang') || 'en';

    const langOptions = LANGUAGES.map(l =>
      `<option value="${l.code}" ${l.code === savedLang ? 'selected' : ''}>${l.label}</option>`
    ).join('');

    app.innerHTML = `
      <div class="page-container has-bottom-nav" style="min-height:100vh; background:var(--bg-page);">
        ${topBar({ title: 'Profile', showBell: false })}

        <div style="padding:var(--space-4);">
          <!-- Profile Card -->
          <div style="
            background:var(--bg-white);
            border-radius:var(--radius-lg);
            padding:var(--space-6);
            margin-bottom:var(--space-4);
            box-shadow:var(--shadow-sm);
            text-align:center;
          ">
            <!-- Avatar -->
            <div style="
              width:80px; height:80px; border-radius:var(--radius-full);
              background:linear-gradient(135deg, var(--saffron), var(--saffron-dark));
              display:flex; align-items:center; justify-content:center;
              margin:0 auto var(--space-4);
              font-size:var(--text-2xl); font-weight:var(--font-bold);
              color:var(--text-inverse);
            ">${initials}</div>

            <!-- Name & Email -->
            <h2 style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--text-primary); margin-bottom:var(--space-1);">
              ${fullName}
            </h2>
            <p style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:var(--space-3);">
              ${email}
            </p>

            <!-- Badges -->
            <div style="display:flex; gap:var(--space-2); justify-content:center; flex-wrap:wrap;">
              <span style="
                display:inline-flex; align-items:center; gap:4px;
                padding:4px 12px; border-radius:var(--radius-full);
                font-size:var(--text-xs); font-weight:var(--font-semibold);
                background:var(--light-saffron); color:var(--saffron-dark);
              ">
                <i class="fas fa-scale-balanced"></i> Lawyer
              </span>
              <span style="
                display:inline-flex; align-items:center; gap:4px;
                padding:4px 12px; border-radius:var(--radius-full);
                font-size:var(--text-xs); font-weight:var(--font-semibold);
                background:var(--light-navy); color:var(--navy);
              ">
                <i class="fas fa-graduation-cap"></i> ${specialization}
              </span>
            </div>

            <!-- Bar Council Number -->
            <div style="
              margin-top:var(--space-4); padding-top:var(--space-4);
              border-top:1px solid var(--border-light);
            ">
              <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">
                Bar Council Enrollment Number
              </div>
              <div style="
                font-size:var(--text-sm); font-weight:var(--font-semibold);
                color:var(--text-primary);
                display:inline-flex; align-items:center; gap:var(--space-2);
                padding:var(--space-2) var(--space-3);
                background:var(--bg-page); border-radius:var(--radius-md);
              ">
                <i class="fas fa-id-card" style="color:var(--saffron);"></i>
                ${barCouncilNumber}
              </div>
            </div>
          </div>

          <!-- Settings Section -->
          <div style="
            background:var(--bg-white);
            border-radius:var(--radius-lg);
            padding:var(--space-4);
            margin-bottom:var(--space-4);
            box-shadow:var(--shadow-sm);
          ">
            <h3 style="
              font-size:var(--text-md); font-weight:var(--font-semibold);
              color:var(--text-primary); margin-bottom:var(--space-4);
            ">Settings</h3>

            <!-- Language Preference -->
            <div style="margin-bottom:var(--space-4);">
              <label style="
                display:block; font-size:var(--text-sm);
                font-weight:var(--font-medium); color:var(--text-secondary);
                margin-bottom:var(--space-2);
              ">Language Preference</label>
              <select id="profile-lang-select" style="
                width:100%; padding:var(--space-3) var(--space-4);
                padding-right:var(--space-10);
                font-size:var(--text-base); color:var(--text-primary);
                background-color:var(--bg-white);
                border:1.5px solid var(--border);
                border-radius:var(--radius-md);
                appearance:none;
                background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%235f6368' d='M1.41 0L6 4.58 10.59 0 12 1.41l-6 6-6-6z'/%3E%3C/svg%3E");
                background-repeat:no-repeat;
                background-position:right 12px center;
                cursor:pointer;
                transition:border-color var(--transition-fast);
              ">
                ${langOptions}
              </select>
            </div>

            <!-- Notification Settings -->
            <div style="margin-bottom:var(--space-2);">
              <label style="
                display:block; font-size:var(--text-sm);
                font-weight:var(--font-medium); color:var(--text-secondary);
                margin-bottom:var(--space-3);
              ">Notifications</label>

              <!-- Push Notifications -->
              <div style="
                display:flex; align-items:center; justify-content:space-between;
                padding:var(--space-3) 0; border-bottom:1px solid var(--border-light);
              ">
                <div>
                  <div style="font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium);">
                    Push Notifications
                  </div>
                </div>
                <label style="
                  position:relative; display:inline-block;
                  width:44px; height:24px; cursor:pointer;
                ">
                  <input type="checkbox" checked style="opacity:0; width:0; height:0;" disabled />
                  <span style="
                    position:absolute; inset:0;
                    background:var(--green); border-radius:12px;
                    transition:background var(--transition-fast);
                  "></span>
                  <span style="
                    position:absolute; top:2px; left:22px;
                    width:20px; height:20px;
                    background:var(--bg-white); border-radius:var(--radius-full);
                    box-shadow:var(--shadow-sm);
                    transition:left var(--transition-fast);
                  "></span>
                </label>
              </div>

              <!-- Email Notifications -->
              <div style="
                display:flex; align-items:center; justify-content:space-between;
                padding:var(--space-3) 0; border-bottom:1px solid var(--border-light);
              ">
                <div>
                  <div style="font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium);">
                    Email Notifications
                  </div>
                </div>
                <label style="
                  position:relative; display:inline-block;
                  width:44px; height:24px; cursor:pointer;
                ">
                  <input type="checkbox" style="opacity:0; width:0; height:0;" disabled />
                  <span style="
                    position:absolute; inset:0;
                    background:var(--border); border-radius:12px;
                    transition:background var(--transition-fast);
                  "></span>
                  <span style="
                    position:absolute; top:2px; left:2px;
                    width:20px; height:20px;
                    background:var(--bg-white); border-radius:var(--radius-full);
                    box-shadow:var(--shadow-sm);
                    transition:left var(--transition-fast);
                  "></span>
                </label>
              </div>

              <!-- New Case Alerts -->
              <div style="
                display:flex; align-items:center; justify-content:space-between;
                padding:var(--space-3) 0;
              ">
                <div>
                  <div style="font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium);">
                    New Case Alerts
                  </div>
                </div>
                <label style="
                  position:relative; display:inline-block;
                  width:44px; height:24px; cursor:pointer;
                ">
                  <input type="checkbox" checked style="opacity:0; width:0; height:0;" disabled />
                  <span style="
                    position:absolute; inset:0;
                    background:var(--green); border-radius:12px;
                    transition:background var(--transition-fast);
                  "></span>
                  <span style="
                    position:absolute; top:2px; left:22px;
                    width:20px; height:20px;
                    background:var(--bg-white); border-radius:var(--radius-full);
                    box-shadow:var(--shadow-sm);
                    transition:left var(--transition-fast);
                  "></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Links Section -->
          <div style="
            background:var(--bg-white);
            border-radius:var(--radius-lg);
            padding:var(--space-4);
            margin-bottom:var(--space-4);
            box-shadow:var(--shadow-sm);
          ">
            <a href="#" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:var(--space-3) 0; text-decoration:none;
              border-bottom:1px solid var(--border-light);
            ">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <i class="fas fa-info-circle" style="color:var(--text-light); width:20px; text-align:center;"></i>
                <span style="font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium);">About</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>
            <a href="#" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:var(--space-3) 0; text-decoration:none;
              border-bottom:1px solid var(--border-light);
            ">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <i class="fas fa-file-contract" style="color:var(--text-light); width:20px; text-align:center;"></i>
                <span style="font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium);">Terms of Service</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>
            <a href="#" style="
              display:flex; align-items:center; justify-content:space-between;
              padding:var(--space-3) 0; text-decoration:none;
            ">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <i class="fas fa-shield-alt" style="color:var(--text-light); width:20px; text-align:center;"></i>
                <span style="font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium);">Privacy Policy</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>
          </div>

          <!-- Logout Button -->
          <button id="btn-logout" style="
            display:flex; align-items:center; justify-content:center; gap:var(--space-2);
            width:100%; padding:var(--space-4);
            background:var(--error-light); color:var(--error);
            border:1.5px solid var(--error); border-radius:var(--radius-lg);
            font-size:var(--text-base); font-weight:var(--font-semibold);
            cursor:pointer;
            transition:background var(--transition-fast), color var(--transition-fast);
          ">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>

        ${Nav().render(lawyerNavItems, 3)}
      </div>
    `;

    // ── Event listeners ──

    // Language select
    const langSelect = document.getElementById('profile-lang-select');
    function onLangChange() {
      const lang = langSelect.value;
      State().set('language', lang);
      localStorage.setItem('ekraah_lang', lang);
    }
    if (langSelect) langSelect.addEventListener('change', onLangChange);

    // Logout
    const btnLogout = document.getElementById('btn-logout');
    async function onLogout() {
      btnLogout.disabled = true;
      btnLogout.textContent = 'Logging out...';
      try {
        await Auth().signOut();
        State().set('lawyerDetails', null);
        Toast().show('Logged out successfully.', 'success');
        Router().navigate('/welcome');
      } catch (err) {
        console.error('Logout error:', err);
        Toast().show('Logout failed. Please try again.', 'error');
        btnLogout.disabled = false;
        btnLogout.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
      }
    }

    if (btnLogout) btnLogout.addEventListener('click', onLogout);

    // Cleanup
    return function cleanup() {
      if (langSelect) langSelect.removeEventListener('change', onLangChange);
      if (btnLogout) btnLogout.removeEventListener('click', onLogout);
    };
  }


  // ═══════════════════════════════════════════════════════════════════════
  // REGISTER ALL ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  Router().register('/lawyer/home', renderLawyerHome);
  Router().register('/lawyer/find-case', renderFindCase);
  Router().register('/lawyer/my-cases', renderMyCases);
  Router().register('/lawyer/case-detail/:id', renderCaseDetail);
  Router().register('/lawyer/profile', renderLawyerProfile);

})();
