/**
 * ekRAAH - Government Official Pages Module
 *
 * Registers routes for: /gov/home, /gov/applications, /gov/application-detail/:id,
 *                       /gov/analytics, /gov/profile
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
  const Sidebar = () => window.EkraahSidebar;
  const Notifs  = () => window.EkraahNotifications;
  const Modal   = () => window.EkraahModal;

  // ── Sidebar items shared across all gov pages ──
  const govSidebarItems = [
    { label: 'Dashboard', icon: 'fas fa-gauge-high', route: '/gov/home' },
    { label: 'Applications', icon: 'fas fa-file-lines', route: '/gov/applications' },
    { label: 'Analytics', icon: 'fas fa-chart-bar', route: '/gov/analytics' },
    { label: 'Profile', icon: 'fas fa-user', route: '/gov/profile' }
  ];

  // ── Vehicle registration workflow stages ──
  const VEHICLE_REG_STAGES = [
    { stage: 1, department: 'Transport Department', label: 'Application Intake' },
    { stage: 2, department: 'Police Department', label: 'Vehicle Background Check' },
    { stage: 3, department: 'Transport Department', label: 'Registration Issuance' }
  ];

  // ── Language options for profile ──
  const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'bn', label: 'Bengali' },
    { code: 'te', label: 'Telugu' },
    { code: 'ta', label: 'Tamil' },
    { code: 'mr', label: 'Marathi' },
    { code: 'gu', label: 'Gujarati' },
    { code: 'kn', label: 'Kannada' },
    { code: 'ml', label: 'Malayalam' },
    { code: 'pa', label: 'Punjabi' },
    { code: 'ur', label: 'Urdu' },
    { code: 'or', label: 'Odia' }
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Get current user's department and gov details
  // ═══════════════════════════════════════════════════════════════════════

  async function getGovDetails() {
    const cached = State().get('govOfficialDetails');
    if (cached) return cached;

    const user = State().get('currentUser');
    if (!user) return null;

    const details = await Auth().getGovOfficialDetails(user.id);
    if (details) {
      State().set('govOfficialDetails', details);
    }
    return details;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Render the gov layout shell (sidebar + topbar + main)
  // ═══════════════════════════════════════════════════════════════════════

  function renderGovShell(activeRoute, pageTitle, contentHtml) {
    const profile = State().get('profile');
    const profileData = profile ? { full_name: profile.full_name, role: profile.role } : null;

    const sidebarHtml = Sidebar().render(govSidebarItems, activeRoute, profileData);

    return `
      <div class="gov-layout" style="display:flex; min-height:100vh;">
        <div id="sidebar-container">${sidebarHtml}</div>
        <div class="gov-main has-sidebar" style="flex:1; min-width:0; display:flex; flex-direction:column;">
          <div class="gov-topbar" style="
            display:flex; align-items:center; justify-content:space-between;
            padding:var(--space-3) var(--space-5);
            background:var(--bg-white);
            border-bottom:1px solid var(--border);
            min-height:var(--header-height);
            position:sticky; top:0; z-index:var(--z-sticky);
          ">
            <div style="display:flex; align-items:center; gap:var(--space-3);">
              <button id="gov-sidebar-toggle" class="btn btn-icon" aria-label="Toggle sidebar" style="display:none; color:var(--text-secondary);">
                <i class="fas fa-bars" style="font-size:20px;"></i>
              </button>
              <h1 style="font-size:var(--text-lg); font-weight:var(--font-semibold); color:var(--text-primary); margin:0;">${pageTitle}</h1>
            </div>
            <div style="display:flex; align-items:center; gap:var(--space-3);">
              ${Notifs().renderBell()}
            </div>
          </div>
          <div class="gov-content" style="flex:1; padding:var(--space-5); overflow-y:auto;">
            ${contentHtml}
          </div>
        </div>
      </div>
      <!-- Notification panel infrastructure -->
      <div id="notification-overlay" class="notification-backdrop" style="display:none;"></div>
      <div id="notification-panel" class="notification-panel" style="display:none;"></div>
      <!-- Modal container -->
      <div id="modal-container"></div>
    `;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Attach topbar listeners (hamburger + bell + sidebar overlay)
  // ═══════════════════════════════════════════════════════════════════════

  function attachTopbarListeners() {
    // Hamburger toggle
    const toggleBtn = document.getElementById('gov-sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => Sidebar().toggle());
    }

    // Show/hide hamburger based on viewport
    function updateHamburgerVisibility() {
      const btn = document.getElementById('gov-sidebar-toggle');
      if (btn) {
        btn.style.display = window.innerWidth < 1025 ? 'flex' : 'none';
      }
    }
    updateHamburgerVisibility();
    window.addEventListener('resize', updateHamburgerVisibility);

    // Notification bell
    const bellBtn = document.getElementById('notification-bell-btn');
    if (bellBtn) {
      bellBtn.addEventListener('click', () => Notifs().open());
    }

    // Sidebar overlay click to close
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => Sidebar().close());
    }

    return function cleanupTopbar() {
      window.removeEventListener('resize', updateHamburgerVisibility);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Generate random Indian registration number
  // ═══════════════════════════════════════════════════════════════════════

  function generateRegNumber() {
    const states = ['MH', 'DL', 'KA', 'TN', 'GJ', 'RJ', 'UP', 'MP', 'HR', 'PB'];
    const state = states[Math.floor(Math.random() * states.length)];
    const code = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    const letters = String.fromCharCode(65 + Math.floor(Math.random() * 26))
                  + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const digits = String(Math.floor(Math.random() * 9999) + 1).padStart(4, '0');
    return `${state}-${code}-${letters}-${digits}`;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Get workflow stages for an application type
  // ═══════════════════════════════════════════════════════════════════════

  function getWorkflowStages(appType) {
    if (!appType || !appType.workflow_config || !appType.workflow_config.stages) {
      return VEHICLE_REG_STAGES;
    }
    return appType.workflow_config.stages;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // HELPER: Format form data key for display
  // ═══════════════════════════════════════════════════════════════════════

  function formatFieldLabel(key) {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 1. GOVERNMENT HOME / DASHBOARD  (/gov/home)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderGovHome() {
    const isAuthorized = await Auth().requireRole('government_official');
    if (!isAuthorized) return;

    const app = document.getElementById('app');

    // Show loading skeleton
    app.innerHTML = renderGovShell('/gov/home', 'Dashboard', Comp().spinner('lg'));

    let topbarCleanup = attachTopbarListeners();

    try {
      const govDetails = await getGovDetails();
      const department = govDetails?.department || 'Unknown Department';

      const stats = await Helpers().getDashboardStats(department);

      // Get recent applications
      const recentApps = await Helpers().getDepartmentAppsSimple(department);
      const recentFive = (recentApps || []).slice(0, 5);

      // Quick metrics (prototype values)
      const processedToday = Math.min(stats.approved || 0, 3);
      const avgProcessingTime = '2.3 days';
      const docsIssuedMonth = stats.approved || 0;

      // ── Stats cards ──
      const statsCards = `
        <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:var(--space-4); margin-bottom:var(--space-6);">
          <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-5); box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:var(--space-4);">
            <div style="width:48px; height:48px; border-radius:var(--radius-lg); background:var(--light-navy); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fas fa-file-lines" style="font-size:20px; color:var(--navy);"></i>
            </div>
            <div>
              <div style="font-size:var(--text-2xl); font-weight:var(--font-bold); color:var(--text-primary);">${stats.total || 0}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); font-weight:var(--font-medium);">Total Applications</div>
            </div>
          </div>
          <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-5); box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:var(--space-4);">
            <div style="width:48px; height:48px; border-radius:var(--radius-lg); background:var(--warning-light); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fas fa-clock" style="font-size:20px; color:var(--warning);"></i>
            </div>
            <div>
              <div style="font-size:var(--text-2xl); font-weight:var(--font-bold); color:var(--text-primary);">${stats.pending || 0}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); font-weight:var(--font-medium);">Pending Review</div>
            </div>
          </div>
          <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-5); box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:var(--space-4);">
            <div style="width:48px; height:48px; border-radius:var(--radius-lg); background:var(--success-light); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fas fa-circle-check" style="font-size:20px; color:var(--success);"></i>
            </div>
            <div>
              <div style="font-size:var(--text-2xl); font-weight:var(--font-bold); color:var(--text-primary);">${stats.approved || 0}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); font-weight:var(--font-medium);">Approved</div>
            </div>
          </div>
          <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-5); box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:var(--space-4);">
            <div style="width:48px; height:48px; border-radius:var(--radius-lg); background:var(--error-light); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fas fa-circle-xmark" style="font-size:20px; color:var(--error);"></i>
            </div>
            <div>
              <div style="font-size:var(--text-2xl); font-weight:var(--font-bold); color:var(--text-primary);">${stats.rejected || 0}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); font-weight:var(--font-medium);">Rejected</div>
            </div>
          </div>
        </div>
      `;

      // ── Quick metrics ──
      const quickMetrics = `
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-5); box-shadow:var(--shadow-sm); margin-bottom:var(--space-6);">
          <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:var(--space-4);">Quick Metrics</h3>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:var(--space-4);">
            <div style="text-align:center; padding:var(--space-3); background:var(--bg-page); border-radius:var(--radius-md);">
              <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--navy);">${processedToday}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-1);">Processed Today</div>
            </div>
            <div style="text-align:center; padding:var(--space-3); background:var(--bg-page); border-radius:var(--radius-md);">
              <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--saffron);">${avgProcessingTime}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-1);">Avg. Processing Time</div>
            </div>
            <div style="text-align:center; padding:var(--space-3); background:var(--bg-page); border-radius:var(--radius-md);">
              <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--green);">${docsIssuedMonth}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-1);">Docs Issued This Month</div>
            </div>
          </div>
        </div>
      `;

      // ── Recent applications table ──
      let recentTableHtml;
      if (recentFive.length === 0) {
        recentTableHtml = `
          <div style="text-align:center; padding:var(--space-10) var(--space-4); color:var(--text-light);">
            <i class="fas fa-inbox" style="font-size:40px; margin-bottom:var(--space-4); opacity:0.3;"></i>
            <p style="font-size:var(--text-sm);">No applications found.</p>
          </div>
        `;
      } else {
        const rows = recentFive.map(app => {
          const typeName = app.application_types?.name || 'Application';
          const typeIcon = app.application_types?.icon || 'fa-file-lines';
          const citizenName = app.citizen_name || 'Citizen';
          return `
            <tr class="gov-app-row" data-app-id="${app.id}" style="cursor:pointer; transition:background var(--transition-fast);">
              <td style="padding:var(--space-3) var(--space-4); font-size:var(--text-sm); color:var(--text-primary); font-weight:var(--font-medium); font-family:monospace;">${app.id.substring(0, 8)}...</td>
              <td style="padding:var(--space-3) var(--space-4); font-size:var(--text-sm); color:var(--text-primary);">
                <div style="display:flex; align-items:center; gap:var(--space-2);">
                  <i class="fas ${typeIcon}" style="color:var(--navy); font-size:14px;"></i>
                  ${typeName}
                </div>
              </td>
              <td style="padding:var(--space-3) var(--space-4); font-size:var(--text-sm); color:var(--text-secondary);">${citizenName}</td>
              <td style="padding:var(--space-3) var(--space-4); font-size:var(--text-sm); color:var(--text-secondary);">${Comp().formatDate(app.created_at)}</td>
              <td style="padding:var(--space-3) var(--space-4);">${Comp().statusBadge(app.status)}</td>
            </tr>
          `;
        }).join('');

        recentTableHtml = `
          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="border-bottom:2px solid var(--border);">
                  <th style="padding:var(--space-3) var(--space-4); text-align:left; font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--text-light); text-transform:uppercase; letter-spacing:0.05em;">App ID</th>
                  <th style="padding:var(--space-3) var(--space-4); text-align:left; font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--text-light); text-transform:uppercase; letter-spacing:0.05em;">Type</th>
                  <th style="padding:var(--space-3) var(--space-4); text-align:left; font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--text-light); text-transform:uppercase; letter-spacing:0.05em;">Citizen</th>
                  <th style="padding:var(--space-3) var(--space-4); text-align:left; font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--text-light); text-transform:uppercase; letter-spacing:0.05em;">Date</th>
                  <th style="padding:var(--space-3) var(--space-4); text-align:left; font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--text-light); text-transform:uppercase; letter-spacing:0.05em;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
          </div>
        `;
      }

      const recentSection = `
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); overflow:hidden;">
          <div style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-4) var(--space-5); border-bottom:1px solid var(--border-light);">
            <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin:0;">Recent Applications</h3>
            <a href="#/gov/applications" style="font-size:var(--text-sm); color:var(--saffron); font-weight:var(--font-medium); text-decoration:none;">View All</a>
          </div>
          ${recentTableHtml}
        </div>
      `;

      // Department badge
      const deptBadge = `
        <div style="display:inline-flex; align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-3); background:var(--light-navy); border-radius:var(--radius-full); margin-bottom:var(--space-6);">
          <i class="fas fa-building" style="font-size:12px; color:var(--navy);"></i>
          <span style="font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--navy);">${department}</span>
        </div>
      `;

      const contentHtml = deptBadge + statsCards + quickMetrics + recentSection;

      app.innerHTML = renderGovShell('/gov/home', 'Dashboard', contentHtml);
      topbarCleanup = attachTopbarListeners();

      // Row click listeners
      document.querySelectorAll('.gov-app-row').forEach(row => {
        row.addEventListener('click', () => {
          const appId = row.getAttribute('data-app-id');
          Router().navigate('/gov/application-detail/' + appId);
        });
        row.addEventListener('mouseenter', () => {
          row.style.background = 'var(--bg-page)';
        });
        row.addEventListener('mouseleave', () => {
          row.style.background = '';
        });
      });

    } catch (err) {
      console.error('Error loading dashboard:', err);
      Toast().show('Failed to load dashboard data.', 'error');
      app.innerHTML = renderGovShell('/gov/home', 'Dashboard', `
        <div style="text-align:center; padding:var(--space-10); color:var(--error);">
          <i class="fas fa-triangle-exclamation" style="font-size:40px; margin-bottom:var(--space-4);"></i>
          <p>Failed to load dashboard. Please try again.</p>
        </div>
      `);
      topbarCleanup = attachTopbarListeners();
    }

    return function cleanup() {
      if (topbarCleanup) topbarCleanup();
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. APPLICATIONS PAGE  (/gov/applications)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderGovApplications() {
    const isAuthorized = await Auth().requireRole('government_official');
    if (!isAuthorized) return;

    const appEl = document.getElementById('app');
    appEl.innerHTML = renderGovShell('/gov/applications', 'Applications', Comp().spinner('lg'));

    let topbarCleanup = attachTopbarListeners();

    try {
      const govDetails = await getGovDetails();
      const department = govDetails?.department || 'Unknown Department';

      let allApps = await Helpers().getDepartmentAppsSimple(department);

      // Also get all applications with reviews for this department (including non-pending)
      const { data: allReviews } = await DB()
        .from('application_stage_reviews')
        .select('application_id, status, department')
        .eq('department', department);

      // Get full apps for all reviews
      let fullApps = [];
      if (allReviews && allReviews.length > 0) {
        const allAppIds = [...new Set(allReviews.map(r => r.application_id))];
        const { data: apps } = await DB()
          .from('applications')
          .select('*, application_types (name, slug, icon, color)')
          .in('id', allAppIds)
          .order('created_at', { ascending: false });
        fullApps = apps || [];
      }

      // Merge: combine pending apps with all reviewed apps, deduplicate
      const seen = new Set();
      const combinedApps = [];
      for (const a of [...(allApps || []), ...fullApps]) {
        if (!seen.has(a.id)) {
          seen.add(a.id);
          combinedApps.push(a);
        }
      }

      // Store for filtering
      let currentFilter = 'all';
      let searchQuery = '';

      function getFilteredApps() {
        let filtered = combinedApps;

        // Apply tab filter
        if (currentFilter !== 'all') {
          filtered = filtered.filter(a => a.status === currentFilter);
        }

        // Apply search
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(a => {
            const idMatch = a.id.toLowerCase().includes(q);
            const nameMatch = (a.application_types?.name || '').toLowerCase().includes(q);
            return idMatch || nameMatch;
          });
        }

        return filtered;
      }

      function renderAppList() {
        const filtered = getFilteredApps();

        if (filtered.length === 0) {
          return `
            <div style="text-align:center; padding:var(--space-16) var(--space-4); color:var(--text-light);">
              <i class="fas fa-inbox" style="font-size:48px; margin-bottom:var(--space-4); opacity:0.3;"></i>
              <p style="font-size:var(--text-base); margin-bottom:var(--space-2);">No applications pending review.</p>
              <p style="font-size:var(--text-sm);">Applications assigned to your department will appear here.</p>
            </div>
          `;
        }

        return filtered.map(a => {
          const typeName = a.application_types?.name || 'Application';
          const typeIcon = a.application_types?.icon || 'fa-file-lines';
          const typeColor = a.application_types?.color || '#000080';
          const stageLabel = a.current_stage ? `Stage ${a.current_stage} of ${a.total_stages}` : 'N/A';

          return `
            <div class="gov-app-item" data-app-id="${a.id}" style="
              display:flex; align-items:center; gap:var(--space-4);
              padding:var(--space-4) var(--space-5);
              background:var(--bg-white);
              border-radius:var(--radius-lg);
              box-shadow:var(--shadow-sm);
              margin-bottom:var(--space-3);
              cursor:pointer;
              transition:all var(--transition-fast);
            ">
              <div style="width:44px; height:44px; border-radius:var(--radius-lg); background:${typeColor}20; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas ${typeIcon}" style="font-size:18px; color:${typeColor};"></i>
              </div>
              <div style="flex:1; min-width:0;">
                <div style="font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--text-primary);">${typeName}</div>
                <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:2px;">${Comp().timeAgo(a.created_at)} &middot; ${stageLabel}</div>
              </div>
              <div style="flex-shrink:0;">
                ${Comp().statusBadge(a.status)}
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:14px; flex-shrink:0;"></i>
            </div>
          `;
        }).join('');
      }

      function renderContent() {
        const tabs = [
          { key: 'all', label: 'All' },
          { key: 'submitted', label: 'Pending' },
          { key: 'in_review', label: 'In Review' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' }
        ];

        const tabsHtml = tabs.map(t => `
          <button class="gov-filter-tab ${currentFilter === t.key ? 'active' : ''}" data-filter="${t.key}" style="
            padding:var(--space-2) var(--space-4);
            font-size:var(--text-sm);
            font-weight:${currentFilter === t.key ? 'var(--font-semibold)' : 'var(--font-medium)'};
            color:${currentFilter === t.key ? 'var(--saffron)' : 'var(--text-secondary)'};
            background:${currentFilter === t.key ? 'var(--light-saffron)' : 'transparent'};
            border:none;
            border-radius:var(--radius-full);
            cursor:pointer;
            transition:all var(--transition-fast);
          ">${t.label}</button>
        `).join('');

        return `
          <div style="margin-bottom:var(--space-4);">
            <div style="display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap;">
              ${tabsHtml}
            </div>
          </div>
          <div style="position:relative; margin-bottom:var(--space-5);">
            <i class="fas fa-search" style="position:absolute; left:var(--space-4); top:50%; transform:translateY(-50%); color:var(--text-light); font-size:14px;"></i>
            <input type="text" id="gov-app-search" placeholder="Search by Application ID or type..." value="${searchQuery}" style="
              width:100%; padding:var(--space-3) var(--space-4); padding-left:40px;
              font-size:var(--text-sm); color:var(--text-primary); background:var(--bg-white);
              border:1.5px solid var(--border); border-radius:var(--radius-lg);
              outline:none; transition:border-color var(--transition-fast);
            ">
          </div>
          <div id="gov-app-list">
            ${renderAppList()}
          </div>
        `;
      }

      appEl.innerHTML = renderGovShell('/gov/applications', 'Applications', renderContent());
      topbarCleanup = attachTopbarListeners();

      // Tab click handlers
      function onTabClick(e) {
        const btn = e.target.closest('.gov-filter-tab');
        if (!btn) return;
        currentFilter = btn.getAttribute('data-filter');
        appEl.innerHTML = renderGovShell('/gov/applications', 'Applications', renderContent());
        topbarCleanup = attachTopbarListeners();
        attachAppListListeners();
      }

      // Search handler
      function onSearchInput(e) {
        searchQuery = e.target.value;
        const listContainer = document.getElementById('gov-app-list');
        if (listContainer) {
          listContainer.innerHTML = renderAppList();
          attachAppItemClickListeners();
        }
      }

      function attachAppItemClickListeners() {
        document.querySelectorAll('.gov-app-item').forEach(item => {
          item.addEventListener('click', () => {
            const appId = item.getAttribute('data-app-id');
            Router().navigate('/gov/application-detail/' + appId);
          });
          item.addEventListener('mouseenter', () => {
            item.style.boxShadow = 'var(--shadow-md)';
            item.style.transform = 'translateY(-1px)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.boxShadow = 'var(--shadow-sm)';
            item.style.transform = '';
          });
        });
      }

      function attachAppListListeners() {
        document.querySelectorAll('.gov-filter-tab').forEach(btn => {
          btn.addEventListener('click', onTabClick);
        });
        const searchInput = document.getElementById('gov-app-search');
        if (searchInput) {
          searchInput.addEventListener('input', onSearchInput);
          searchInput.focus();
        }
        attachAppItemClickListeners();
      }

      attachAppListListeners();

    } catch (err) {
      console.error('Error loading applications:', err);
      Toast().show('Failed to load applications.', 'error');
      appEl.innerHTML = renderGovShell('/gov/applications', 'Applications', `
        <div style="text-align:center; padding:var(--space-10); color:var(--error);">
          <i class="fas fa-triangle-exclamation" style="font-size:40px; margin-bottom:var(--space-4);"></i>
          <p>Failed to load applications. Please try again.</p>
        </div>
      `);
      topbarCleanup = attachTopbarListeners();
    }

    return function cleanup() {
      if (topbarCleanup) topbarCleanup();
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. APPLICATION DETAIL PAGE  (/gov/application-detail/:id)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderAppDetail(params) {
    const isAuthorized = await Auth().requireRole('government_official');
    if (!isAuthorized) return;

    const appId = params.id;
    const appEl = document.getElementById('app');

    appEl.innerHTML = renderGovShell('/gov/applications', 'Application Detail', Comp().spinner('lg'));

    let topbarCleanup = attachTopbarListeners();

    try {
      const govDetails = await getGovDetails();
      const myDepartment = govDetails?.department || '';
      const user = State().get('currentUser');
      const userId = user?.id;

      // Fetch application data
      const application = await Helpers().getApplicationById(appId);
      if (!application) {
        appEl.innerHTML = renderGovShell('/gov/applications', 'Application Detail', `
          <div style="text-align:center; padding:var(--space-16); color:var(--text-light);">
            <i class="fas fa-file-excel" style="font-size:48px; margin-bottom:var(--space-4); opacity:0.3;"></i>
            <p>Application not found.</p>
          </div>
        `);
        topbarCleanup = attachTopbarListeners();
        return;
      }

      // Fetch stage reviews
      const stageReviews = await Helpers().getStageReviews(appId);

      // Fetch work notes
      const workNotes = await Helpers().getWorkNotes(appId);

      // Get citizen info
      let citizenName = 'Citizen';
      let citizenEmail = '';
      let citizenId = application.citizen_id;

      if (application.profiles) {
        citizenName = application.profiles.full_name || citizenName;
        citizenEmail = application.profiles.email || '';
      } else {
        // Fetch citizen profile separately
        const { data: citizenProfile } = await DB()
          .from('profiles')
          .select('full_name, email')
          .eq('id', application.citizen_id)
          .single();
        if (citizenProfile) {
          citizenName = citizenProfile.full_name || citizenName;
          citizenEmail = citizenProfile.email || '';
        }
      }

      const appType = application.application_types || {};
      const typeName = appType.name || 'Application';
      const typeIcon = appType.icon || 'fa-file-lines';
      const typeColor = appType.color || '#000080';

      // Workflow stages
      const workflowStages = getWorkflowStages(appType);

      // ── Build status track with review details ──
      const statusTrackStages = workflowStages.map(ws => {
        const review = stageReviews.find(r => r.stage_number === ws.stage);
        return {
          label: ws.label,
          department: ws.department,
          status: review?.status || 'pending',
          reviewer: review?.reviewer_id || null,
          reviewedAt: review?.reviewed_at || null,
          rejectionReason: review?.rejection_reason || null
        };
      });

      // Render the enhanced status track (not using Comp().statusTrack, building custom)
      const statusTrackHtml = statusTrackStages.map((stage, index) => {
        const stageNum = index + 1;
        let circleStyle, iconHtml, statusLabel, detailHtml = '';

        switch (stage.status) {
          case 'approved':
            circleStyle = 'background:var(--green); color:#fff; border-color:var(--green);';
            iconHtml = '<i class="fas fa-check" style="font-size:10px;"></i>';
            statusLabel = '<span style="font-size:11px; color:var(--green); font-weight:var(--font-semibold);">Approved</span>';
            if (stage.reviewedAt) {
              detailHtml = `<div style="font-size:10px; color:var(--text-light); margin-top:2px;">${Comp().formatDate(stage.reviewedAt)}</div>`;
            }
            break;
          case 'rejected':
            circleStyle = 'background:var(--error); color:#fff; border-color:var(--error);';
            iconHtml = '<i class="fas fa-times" style="font-size:10px;"></i>';
            statusLabel = '<span style="font-size:11px; color:var(--error); font-weight:var(--font-semibold);">Rejected</span>';
            if (stage.rejectionReason) {
              detailHtml = `<div style="font-size:10px; color:var(--error); margin-top:2px;">Reason: ${stage.rejectionReason}</div>`;
            }
            break;
          default:
            if (stageNum === application.current_stage) {
              circleStyle = 'background:var(--saffron); color:#fff; border-color:var(--saffron); box-shadow:0 0 0 4px rgba(255,153,51,0.2);';
              iconHtml = `<span style="font-size:11px; font-weight:700;">${stageNum}</span>`;
              statusLabel = '<span style="font-size:11px; color:var(--saffron); font-weight:var(--font-semibold);">In Progress</span>';
            } else {
              circleStyle = 'background:#fff; color:var(--text-light); border:2px solid var(--border);';
              iconHtml = `<span style="font-size:11px; font-weight:600;">${stageNum}</span>`;
              statusLabel = '<span style="font-size:11px; color:var(--text-light);">Pending</span>';
            }
        }

        const connectorHtml = index < statusTrackStages.length - 1 ? `
          <div style="flex:1; height:2px; background:${stage.status === 'approved' ? 'var(--green)' : 'var(--border)'}; margin:0 4px; align-self:center; margin-top:-20px;"></div>
        ` : '';

        return `
          <div style="display:flex; flex-direction:column; align-items:center; flex:0 0 auto; min-width:100px;">
            <div style="width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid transparent; ${circleStyle}">${iconHtml}</div>
            <div style="font-size:11px; font-weight:var(--font-medium); color:var(--text-secondary); text-align:center; margin-top:6px; max-width:100px; line-height:1.3;">${stage.label}</div>
            <div style="font-size:10px; color:var(--text-light); text-align:center; margin-top:2px;">${stage.department}</div>
            ${statusLabel}
            ${detailHtml}
          </div>
          ${connectorHtml}
        `;
      }).join('');

      // ── Form data section ──
      const formData = application.form_data || {};
      const formFieldsHtml = Object.keys(formData).length > 0
        ? Object.entries(formData).map(([key, value]) => `
            <div style="padding:var(--space-3) 0; border-bottom:1px solid var(--border-light); display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4);">
              <div style="font-size:var(--text-sm); color:var(--text-secondary); font-weight:var(--font-medium);">${formatFieldLabel(key)}</div>
              <div style="font-size:var(--text-sm); color:var(--text-primary);">${value || '—'}</div>
            </div>
          `).join('')
        : '<p style="font-size:var(--text-sm); color:var(--text-light); padding:var(--space-4) 0;">No form data available.</p>';

      // ── Work notes section ──
      const notesHtml = (workNotes || []).length > 0
        ? workNotes.map(note => {
            const authorName = note.profiles?.full_name || 'Official';
            const authorDept = note.profiles?.government_officials?.department || '';
            return `
              <div style="padding:var(--space-3) 0; border-bottom:1px solid var(--border-light);">
                <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-1);">
                  <span style="font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--text-primary);">${authorName}</span>
                  ${authorDept ? `<span style="font-size:var(--text-xs); color:var(--text-light); background:var(--bg-page); padding:2px 6px; border-radius:var(--radius-full);">${authorDept}</span>` : ''}
                  <span style="font-size:var(--text-xs); color:var(--text-light); margin-left:auto;">${Comp().timeAgo(note.created_at)}</span>
                </div>
                <p style="font-size:var(--text-sm); color:var(--text-secondary); line-height:var(--leading-normal);">${note.note}</p>
              </div>
            `;
          }).join('')
        : '<p style="font-size:var(--text-sm); color:var(--text-light); padding:var(--space-4) 0;">No work notes yet.</p>';

      // ── Action section ──
      let actionHtml = '';

      // Find the current stage review for this department
      const currentStageReview = stageReviews.find(
        r => r.department === myDepartment && r.status === 'pending'
      );
      const isCurrentReviewerDept = stageReviews.some(
        r => r.department === myDepartment && r.stage_number === application.current_stage && r.status === 'pending'
      );

      if (isCurrentReviewerDept && currentStageReview && application.status !== 'approved' && application.status !== 'rejected') {
        const isLastStage = currentStageReview.stage_number === application.total_stages;
        const currentStageInfo = workflowStages.find(s => s.stage === currentStageReview.stage_number);
        const nextStageInfo = workflowStages.find(s => s.stage === currentStageReview.stage_number + 1);

        const approveLabel = isLastStage
          ? '<i class="fas fa-file-certificate" style="margin-right:8px;"></i>Approve & Issue Document'
          : '<i class="fas fa-check" style="margin-right:8px;"></i>Approve';

        actionHtml = `
          <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-top:var(--space-4);">
            <div style="display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-4);">
              <i class="fas fa-gavel" style="color:var(--saffron);"></i>
              <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin:0;">Your Action Required</h3>
            </div>
            <div style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:var(--space-4);">
              This application is currently at <strong>${currentStageInfo?.label || 'this stage'}</strong> in <strong>${myDepartment}</strong>.
            </div>
            <div style="display:flex; gap:var(--space-3); flex-wrap:wrap;">
              <button id="gov-approve-btn" style="
                display:inline-flex; align-items:center; justify-content:center;
                padding:var(--space-3) var(--space-6);
                font-size:var(--text-sm); font-weight:var(--font-semibold);
                color:var(--text-inverse);
                background:var(--green);
                border:none; border-radius:var(--radius-md);
                cursor:pointer;
                transition:all var(--transition-fast);
                min-width:180px;
              ">${approveLabel}</button>
              <button id="gov-reject-btn" style="
                display:inline-flex; align-items:center; justify-content:center;
                padding:var(--space-3) var(--space-6);
                font-size:var(--text-sm); font-weight:var(--font-semibold);
                color:var(--error);
                background:var(--error-light);
                border:1.5px solid var(--error);
                border-radius:var(--radius-md);
                cursor:pointer;
                transition:all var(--transition-fast);
                min-width:120px;
              "><i class="fas fa-times" style="margin-right:8px;"></i>Reject</button>
            </div>
          </div>
        `;
      } else if (application.status !== 'approved' && application.status !== 'rejected') {
        // Find which department has the current stage
        const currentReview = stageReviews.find(r => r.stage_number === application.current_stage);
        const currentDept = currentReview?.department || 'another department';

        if (currentDept !== myDepartment) {
          actionHtml = `
            <div style="background:var(--light-navy); border-radius:var(--radius-lg); padding:var(--space-5); margin-top:var(--space-4); display:flex; align-items:flex-start; gap:var(--space-3);">
              <i class="fas fa-info-circle" style="color:var(--info); margin-top:2px;"></i>
              <div>
                <div style="font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--info); margin-bottom:var(--space-1);">Awaiting Action</div>
                <div style="font-size:var(--text-sm); color:var(--text-secondary);">
                  This application is currently with <strong>${currentDept}</strong>. Your action is not required at this stage.
                </div>
              </div>
            </div>
          `;
        }
      }

      // ── Assemble full page ──
      const contentHtml = `
        <!-- Back button -->
        <a href="#/gov/applications" style="display:inline-flex; align-items:center; gap:var(--space-2); font-size:var(--text-sm); color:var(--text-secondary); font-weight:var(--font-medium); margin-bottom:var(--space-5); text-decoration:none; transition:color var(--transition-fast);">
          <i class="fas fa-arrow-left"></i>
          Back to Applications
        </a>

        <!-- Application info card -->
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-bottom:var(--space-5);">
          <div style="display:flex; align-items:center; gap:var(--space-4); margin-bottom:var(--space-4);">
            <div style="width:52px; height:52px; border-radius:var(--radius-lg); background:${typeColor}20; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
              <i class="fas ${typeIcon}" style="font-size:22px; color:${typeColor};"></i>
            </div>
            <div style="flex:1;">
              <div style="font-size:var(--text-lg); font-weight:var(--font-semibold); color:var(--text-primary);">${typeName}</div>
              <div style="font-size:var(--text-xs); color:var(--text-light); font-family:monospace; margin-top:2px;">ID: ${application.id}</div>
            </div>
            ${Comp().statusBadge(application.status)}
          </div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:var(--space-4); padding-top:var(--space-3); border-top:1px solid var(--border-light);">
            <div>
              <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">Citizen</div>
              <div style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">${citizenName}</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">Email</div>
              <div style="font-size:var(--text-sm); color:var(--text-secondary);">${citizenEmail || '—'}</div>
            </div>
            <div>
              <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">Submitted</div>
              <div style="font-size:var(--text-sm); color:var(--text-secondary);">${Comp().formatDate(application.created_at)}</div>
            </div>
          </div>
        </div>

        <!-- Status Track -->
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-bottom:var(--space-5);">
          <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:var(--space-4);">Application Progress</h3>
          <div style="display:flex; align-items:flex-start; gap:0; padding:8px 0; overflow-x:auto; -webkit-overflow-scrolling:touch;">
            ${statusTrackHtml}
          </div>
        </div>

        <!-- Form Data -->
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-bottom:var(--space-5);">
          <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:var(--space-3);">Submitted Information</h3>
          ${formFieldsHtml}
        </div>

        <!-- Work Notes -->
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-bottom:var(--space-5);">
          <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:var(--space-3);">Work Notes</h3>
          <div id="gov-work-notes-list">
            ${notesHtml}
          </div>
          <div style="margin-top:var(--space-4); display:flex; gap:var(--space-3);">
            <textarea id="gov-note-input" placeholder="Add a note..." rows="2" style="
              flex:1; padding:var(--space-3) var(--space-4);
              font-size:var(--text-sm); color:var(--text-primary);
              background:var(--bg-white); border:1.5px solid var(--border);
              border-radius:var(--radius-md); resize:vertical;
              outline:none; transition:border-color var(--transition-fast);
            "></textarea>
            <button id="gov-add-note-btn" style="
              align-self:flex-end; padding:var(--space-3) var(--space-4);
              font-size:var(--text-sm); font-weight:var(--font-semibold);
              color:var(--text-inverse); background:var(--navy);
              border:none; border-radius:var(--radius-md);
              cursor:pointer; transition:all var(--transition-fast);
              white-space:nowrap;
            ">Add Note</button>
          </div>
        </div>

        <!-- Action Section -->
        ${actionHtml}
      `;

      appEl.innerHTML = renderGovShell('/gov/applications', 'Application Detail', contentHtml);
      topbarCleanup = attachTopbarListeners();

      // ── Add Note handler ──
      const addNoteBtn = document.getElementById('gov-add-note-btn');
      const noteInput = document.getElementById('gov-note-input');

      if (addNoteBtn && noteInput) {
        addNoteBtn.addEventListener('click', async () => {
          const noteText = noteInput.value.trim();
          if (!noteText) {
            Toast().show('Please enter a note.', 'warning');
            return;
          }
          addNoteBtn.disabled = true;
          addNoteBtn.textContent = 'Saving...';
          try {
            await Helpers().addWorkNote(appId, userId, noteText);
            noteInput.value = '';
            Toast().show('Note added successfully.', 'success');
            // Refresh the page to show new note
            Router().navigate('/gov/application-detail/' + appId);
          } catch (err) {
            console.error('Error adding note:', err);
            Toast().show('Failed to add note.', 'error');
          } finally {
            addNoteBtn.disabled = false;
            addNoteBtn.textContent = 'Add Note';
          }
        });
      }

      // ── Approve handler ──
      const approveBtn = document.getElementById('gov-approve-btn');
      if (approveBtn && currentStageReview) {
        approveBtn.addEventListener('click', async () => {
          approveBtn.disabled = true;
          approveBtn.style.opacity = '0.7';

          try {
            const isLastStage = currentStageReview.stage_number === application.total_stages;
            const nextStageNumber = currentStageReview.stage_number + 1;
            const nextStageInfo = workflowStages.find(s => s.stage === nextStageNumber);

            // 1. Approve the stage review
            await Helpers().approveStage(currentStageReview.id, userId);

            if (isLastStage) {
              // Last stage — approve and issue document
              await Helpers().updateApplicationStatus(appId, 'approved', currentStageReview.stage_number);

              // Issue document
              const regNumber = generateRegNumber();
              await Helpers().issueDocument(
                citizenId,
                appId,
                'Registration Certificate',
                { registration_number: regNumber }
              );

              // Send two notifications
              await Helpers().createNotification(
                citizenId,
                'Application Approved',
                `Your application has been approved by ${myDepartment}.`,
                'application_approved',
                appId
              );
              await Helpers().createNotification(
                citizenId,
                'Document Issued',
                `Your Registration Certificate has been issued. Check My Documents.`,
                'document_issued',
                appId
              );

              Toast().show('Application approved and document issued!', 'success');
            } else {
              // Not last stage — forward to next department
              await Helpers().updateApplicationStatus(appId, 'in_review', nextStageNumber);

              // Notify citizen
              const nextDept = nextStageInfo?.department || 'the next department';
              await Helpers().createNotification(
                citizenId,
                'Application Forwarded',
                `Your application has been approved by ${myDepartment}. It has been forwarded to ${nextDept}.`,
                'stage_approved',
                appId
              );

              Toast().show('Application approved and forwarded to ' + nextDept, 'success');
            }

            Router().navigate('/gov/applications');
          } catch (err) {
            console.error('Error approving application:', err);
            Toast().show('Failed to approve application.', 'error');
            approveBtn.disabled = false;
            approveBtn.style.opacity = '1';
          }
        });
      }

      // ── Reject handler ──
      const rejectBtn = document.getElementById('gov-reject-btn');
      if (rejectBtn && currentStageReview) {
        rejectBtn.addEventListener('click', () => {
          // Show rejection modal
          Modal().show({
            title: 'Reject Application',
            content: `
              <div style="margin-bottom:var(--space-4);">
                <p style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:var(--space-4);">
                  Please provide a reason for rejecting this application. This reason will be visible to the citizen.
                </p>
                <textarea id="rejection-reason-input" placeholder="Enter rejection reason..." rows="4" style="
                  width:100%; padding:var(--space-3) var(--space-4);
                  font-size:var(--text-sm); color:var(--text-primary);
                  background:var(--bg-white); border:1.5px solid var(--border);
                  border-radius:var(--radius-md); resize:vertical;
                  outline:none;
                "></textarea>
              </div>
            `,
            size: 'md',
            footer: `
              <div style="display:flex; justify-content:flex-end; gap:var(--space-3);">
                <button id="modal-cancel-btn" style="
                  padding:var(--space-3) var(--space-5);
                  font-size:var(--text-sm); font-weight:var(--font-medium);
                  color:var(--text-secondary); background:var(--bg-page);
                  border:1px solid var(--border); border-radius:var(--radius-md);
                  cursor:pointer;
                ">Cancel</button>
                <button id="modal-confirm-reject" style="
                  padding:var(--space-3) var(--space-5);
                  font-size:var(--text-sm); font-weight:var(--font-semibold);
                  color:var(--text-inverse); background:var(--error);
                  border:none; border-radius:var(--radius-md);
                  cursor:pointer;
                ">Reject Application</button>
              </div>
            `
          });

          // Attach modal button listeners
          requestAnimationFrame(() => {
            const cancelBtn = document.getElementById('modal-cancel-btn');
            const confirmBtn = document.getElementById('modal-confirm-reject');

            if (cancelBtn) {
              cancelBtn.addEventListener('click', () => Modal().close());
            }

            if (confirmBtn) {
              confirmBtn.addEventListener('click', async () => {
                const reasonInput = document.getElementById('rejection-reason-input');
                const reason = reasonInput?.value?.trim();

                if (!reason) {
                  Toast().show('Please provide a rejection reason.', 'warning');
                  return;
                }

                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Rejecting...';

                try {
                  // 1. Reject the stage review
                  await Helpers().rejectStage(currentStageReview.id, userId, reason);

                  // 2. Update application status
                  await Helpers().updateApplicationStatus(appId, 'rejected', application.current_stage);

                  // 3. Notify citizen
                  await Helpers().createNotification(
                    citizenId,
                    'Application Rejected',
                    `Your application has been rejected by ${myDepartment}. Reason: ${reason}`,
                    'application_rejected',
                    appId
                  );

                  Toast().show('Application rejected.', 'info');
                  Modal().close();
                  Router().navigate('/gov/applications');
                } catch (err) {
                  console.error('Error rejecting application:', err);
                  Toast().show('Failed to reject application.', 'error');
                  confirmBtn.disabled = false;
                  confirmBtn.textContent = 'Reject Application';
                }
              });
            }
          });
        });
      }

    } catch (err) {
      console.error('Error loading application detail:', err);
      Toast().show('Failed to load application details.', 'error');
      appEl.innerHTML = renderGovShell('/gov/applications', 'Application Detail', `
        <div style="text-align:center; padding:var(--space-10); color:var(--error);">
          <i class="fas fa-triangle-exclamation" style="font-size:40px; margin-bottom:var(--space-4);"></i>
          <p>Failed to load application details. Please try again.</p>
        </div>
      `);
      topbarCleanup = attachTopbarListeners();
    }

    return function cleanup() {
      if (topbarCleanup) topbarCleanup();
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. ANALYTICS PAGE  (/gov/analytics)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderGovAnalytics() {
    const isAuthorized = await Auth().requireRole('government_official');
    if (!isAuthorized) return;

    const appEl = document.getElementById('app');

    appEl.innerHTML = renderGovShell('/gov/analytics', 'Analytics', Comp().spinner('lg'));

    let topbarCleanup = attachTopbarListeners();

    try {
      const govDetails = await getGovDetails();
      const department = govDetails?.department || '';

      const stats = await Helpers().getDashboardStats(department);

      // ── Real data from stats ──
      const statusData = [
        { label: 'Pending', count: stats.pending || 0, color: 'var(--warning)' },
        { label: 'Approved', count: stats.approved || 0, color: 'var(--green)' },
        { label: 'Rejected', count: stats.rejected || 0, color: 'var(--error)' }
      ];
      const maxStatusCount = Math.max(...statusData.map(d => d.count), 1);

      const totalApps = stats.total || 0;
      const approvalRate = totalApps > 0 ? Math.round((stats.approved / totalApps) * 100) : 0;
      const rejectionRate = totalApps > 0 ? Math.round((stats.rejected / totalApps) * 100) : 0;

      // ── Time period filter ──
      const timePeriods = ['Last 7 days', 'Last 30 days', 'All time'];
      let selectedPeriod = 'Last 7 days';

      function renderAnalyticsContent() {
        // ── Stats cards ──
        const statsCards = `
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:var(--space-4); margin-bottom:var(--space-6);">
            <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-4); box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:var(--space-3);">
              <div style="width:40px; height:40px; border-radius:var(--radius-lg); background:var(--light-navy); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas fa-file-lines" style="font-size:16px; color:var(--navy);"></i>
              </div>
              <div>
                <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--text-primary);">${totalApps}</div>
                <div style="font-size:var(--text-xs); color:var(--text-secondary);">Total Reviews</div>
              </div>
            </div>
            <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-4); box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:var(--space-3);">
              <div style="width:40px; height:40px; border-radius:var(--radius-lg); background:var(--warning-light); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas fa-clock" style="font-size:16px; color:var(--warning);"></i>
              </div>
              <div>
                <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--text-primary);">${stats.pending || 0}</div>
                <div style="font-size:var(--text-xs); color:var(--text-secondary);">Pending Review</div>
              </div>
            </div>
            <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-4); box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:var(--space-3);">
              <div style="width:40px; height:40px; border-radius:var(--radius-lg); background:var(--success-light); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas fa-circle-check" style="font-size:16px; color:var(--success);"></i>
              </div>
              <div>
                <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--text-primary);">${stats.approved || 0}</div>
                <div style="font-size:var(--text-xs); color:var(--text-secondary);">Approved</div>
              </div>
            </div>
            <div style="background:var(--bg-white); border-radius:var(--radius-lg); padding:var(--space-4); box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:var(--space-3);">
              <div style="width:40px; height:40px; border-radius:var(--radius-lg); background:var(--error-light); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <i class="fas fa-circle-xmark" style="font-size:16px; color:var(--error);"></i>
              </div>
              <div>
                <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--text-primary);">${stats.rejected || 0}</div>
                <div style="font-size:var(--text-xs); color:var(--text-secondary);">Rejected</div>
              </div>
            </div>
          </div>
        `;

        // ── Applications by Status (horizontal bar chart) ──
        const statusBarsHtml = statusData.map(d => {
          const widthPct = maxStatusCount > 0 ? (d.count / maxStatusCount) * 100 : 0;
          return `
            <div style="display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-3);">
              <div style="width:100px; font-size:var(--text-xs); color:var(--text-secondary); text-align:right; flex-shrink:0;">${d.label}</div>
              <div style="flex:1; height:24px; background:var(--bg-page); border-radius:var(--radius-full); overflow:hidden;">
                <div style="height:100%; width:${widthPct}%; background:${d.color}; border-radius:var(--radius-full); transition:width 0.6s ease; min-width:${d.count > 0 ? '4px' : '0'};"></div>
              </div>
              <div style="width:30px; font-size:var(--text-sm); font-weight:var(--font-semibold); color:var(--text-primary); text-align:right; flex-shrink:0;">${d.count}</div>
            </div>
          `;
        }).join('');

        // ── Efficiency Metrics ──
        const efficiencyHtml = `
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:var(--space-4);">
            <div style="background:var(--bg-page); border-radius:var(--radius-md); padding:var(--space-4); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--green);">${approvalRate}%</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-1);">Approval Rate</div>
            </div>
            <div style="background:var(--bg-page); border-radius:var(--radius-md); padding:var(--space-4); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--error);">${rejectionRate}%</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-1);">Rejection Rate</div>
            </div>
            <div style="background:var(--bg-page); border-radius:var(--radius-md); padding:var(--space-4); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--navy);">${totalApps}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-1);">Total Stage Reviews</div>
            </div>
            <div style="background:var(--bg-page); border-radius:var(--radius-md); padding:var(--space-4); text-align:center;">
              <div style="font-size:var(--text-xl); font-weight:var(--font-bold); color:var(--saffron);">${stats.pending || 0}</div>
              <div style="font-size:var(--text-xs); color:var(--text-secondary); margin-top:var(--space-1);">Action Required</div>
            </div>
          </div>
        `;

        // ── Time period filter ──
        const periodTabsHtml = timePeriods.map(p => `
          <button class="analytics-period-tab" data-period="${p}" style="
            padding:var(--space-2) var(--space-4);
            font-size:var(--text-xs);
            font-weight:${selectedPeriod === p ? 'var(--font-semibold)' : 'var(--font-medium)'};
            color:${selectedPeriod === p ? 'var(--saffron)' : 'var(--text-secondary)'};
            background:${selectedPeriod === p ? 'var(--light-saffron)' : 'transparent'};
            border:${selectedPeriod === p ? '1.5px solid var(--saffron)' : '1.5px solid var(--border)'};
            border-radius:var(--radius-full);
            cursor:pointer;
            transition:all var(--transition-fast);
          ">${p}</button>
        `).join('');

        // ── Empty state message ──
        const emptyStateHtml = totalApps === 0 ? `
          <div style="text-align:center; padding:var(--space-8); color:var(--text-light);">
            <i class="fas fa-chart-bar" style="font-size:32px; margin-bottom:var(--space-3); display:block;"></i>
            <p>No applications reviewed yet. Analytics will appear as applications are processed.</p>
          </div>
        ` : '';

        return `
          <div style="margin-bottom:var(--space-5); display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap;">
            ${periodTabsHtml}
          </div>
          ${statsCards}
          ${emptyStateHtml}
          <div style="display:grid; grid-template-columns:1fr; gap:var(--space-5);">
            <!-- Applications by Status -->
            <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5);">
              <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:var(--space-4);">Reviews by Status</h3>
              ${statusBarsHtml}
            </div>
          </div>
          <!-- Efficiency Metrics -->
          <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-top:var(--space-5);">
            <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:var(--space-4);">Efficiency Metrics</h3>
            ${efficiencyHtml}
          </div>
        `;
      }

      appEl.innerHTML = renderGovShell('/gov/analytics', 'Analytics', renderAnalyticsContent());
      topbarCleanup = attachTopbarListeners();

      // Period tab handlers — use event delegation to avoid nested listener stacking
      const analyticsContentArea = document.getElementById('gov-main-content') || appEl;
      analyticsContentArea.addEventListener('click', function handlePeriodClick(e) {
        const btn = e.target.closest('.analytics-period-tab');
        if (!btn) return;

        selectedPeriod = btn.getAttribute('data-period');
        const mainContent = analyticsContentArea.querySelector('.gov-main-content') || analyticsContentArea.querySelector('[class*="main"]') || analyticsContentArea;
        if (mainContent) {
          // Update only the content area, not the entire shell (avoids listener stacking)
          const contentDiv = mainContent.querySelector('[style*="padding"]') || mainContent;
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = renderAnalyticsContent();
          // Replace the analytics content inside the main area
          const parentContent = appEl.querySelector('.gov-main-content') || appEl;
          parentContent.innerHTML = renderAnalyticsContent();
        }
      });

    } catch (err) {
      console.error('Error loading analytics:', err);
      Toast().show('Failed to load analytics.', 'error');
      appEl.innerHTML = renderGovShell('/gov/analytics', 'Analytics', `
        <div style="text-align:center; padding:var(--space-10); color:var(--error);">
          <i class="fas fa-triangle-exclamation" style="font-size:40px; margin-bottom:var(--space-4);"></i>
          <p>Failed to load analytics. Please try again.</p>
        </div>
      `);
      topbarCleanup = attachTopbarListeners();
    }

    return function cleanup() {
      if (topbarCleanup) topbarCleanup();
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 5. GOVERNMENT PROFILE PAGE  (/gov/profile)
  // ═══════════════════════════════════════════════════════════════════════

  async function renderGovProfile() {
    const isAuthorized = await Auth().requireRole('government_official');
    if (!isAuthorized) return;

    const appEl = document.getElementById('app');

    appEl.innerHTML = renderGovShell('/gov/profile', 'Profile', Comp().spinner('lg'));

    let topbarCleanup = attachTopbarListeners();

    try {
      const user = State().get('currentUser');
      const profile = State().get('profile');
      const govDetails = await getGovDetails();

      if (!profile) {
        appEl.innerHTML = renderGovShell('/gov/profile', 'Profile', `
          <div style="text-align:center; padding:var(--space-10); color:var(--text-light);">
            <p>Could not load profile data.</p>
          </div>
        `);
        topbarCleanup = attachTopbarListeners();
        return;
      }

      const initials = (profile.full_name || 'U')
        .split(' ')
        .map(w => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();

      const currentLang = State().get('language') || 'en';
      const langOptions = LANGUAGES.map(l =>
        `<option value="${l.code}" ${l.code === currentLang ? 'selected' : ''}>${l.label}</option>`
      ).join('');

      const department = govDetails?.department || 'N/A';
      const designation = govDetails?.designation || 'N/A';

      const contentHtml = `
        <!-- Avatar & Name -->
        <div style="text-align:center; margin-bottom:var(--space-6);">
          <div style="width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg, var(--navy), var(--navy-dark)); color:var(--text-inverse); display:flex; align-items:center; justify-content:center; font-size:var(--text-2xl); font-weight:var(--font-bold); margin:0 auto var(--space-4);">${initials}</div>
          <div style="font-size:var(--text-xl); font-weight:var(--font-semibold); color:var(--text-primary);">${profile.full_name || 'Government Official'}</div>
          <div style="font-size:var(--text-sm); color:var(--text-secondary); margin-top:var(--space-1);">${profile.email || ''}</div>
          <div style="display:inline-flex; align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-4); background:var(--light-navy); border-radius:var(--radius-full); margin-top:var(--space-3);">
            <i class="fas fa-building" style="font-size:12px; color:var(--navy);"></i>
            <span style="font-size:var(--text-xs); font-weight:var(--font-semibold); color:var(--navy);">${department}</span>
          </div>
        </div>

        <!-- Profile Details Card -->
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-bottom:var(--space-5);">
          <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:var(--space-4);">Profile Details</h3>
          <div style="display:grid; gap:var(--space-4);">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4); padding-bottom:var(--space-3); border-bottom:1px solid var(--border-light);">
              <div>
                <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">Full Name</div>
                <div style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">${profile.full_name || '—'}</div>
              </div>
              <div>
                <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">Email</div>
                <div style="font-size:var(--text-sm); color:var(--text-secondary);">${profile.email || '—'}</div>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4); padding-bottom:var(--space-3); border-bottom:1px solid var(--border-light);">
              <div>
                <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">Department</div>
                <div style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">${department}</div>
              </div>
              <div>
                <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">Designation</div>
                <div style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">${designation}</div>
              </div>
            </div>
            <div>
              <div style="font-size:var(--text-xs); color:var(--text-light); margin-bottom:var(--space-1);">Role</div>
              <div style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">Government Official</div>
            </div>
          </div>
        </div>

        <!-- Preferences Card -->
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-bottom:var(--space-5);">
          <h3 style="font-size:var(--text-base); font-weight:var(--font-semibold); color:var(--text-primary); margin-bottom:var(--space-4);">Preferences</h3>
          <div style="margin-bottom:var(--space-4);">
            <label style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-secondary); display:block; margin-bottom:var(--space-2);">Language Preference</label>
            <select id="gov-lang-select" style="
              width:100%; padding:var(--space-3) var(--space-4);
              font-size:var(--text-sm); color:var(--text-primary);
              background:var(--bg-white); border:1.5px solid var(--border);
              border-radius:var(--radius-md); outline:none;
            ">
              ${langOptions}
            </select>
          </div>
          <div>
            <div style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-3) 0; border-bottom:1px solid var(--border-light);">
              <div>
                <div style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">Push Notifications</div>
                <div style="font-size:var(--text-xs); color:var(--text-light);">Receive alerts for new applications</div>
              </div>
              <label style="position:relative; display:inline-block; width:44px; height:24px;">
                <input type="checkbox" checked style="opacity:0; width:0; height:0;">
                <span style="
                  position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0;
                  background-color:var(--green); border-radius:var(--radius-full);
                  transition:background var(--transition-fast);
                "></span>
                <span style="
                  position:absolute; content:''; height:18px; width:18px;
                  left:22px; bottom:3px; background:var(--bg-white);
                  border-radius:50%; transition:transform var(--transition-fast);
                "></span>
              </label>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-3) 0;">
              <div>
                <div style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">Email Notifications</div>
                <div style="font-size:var(--text-xs); color:var(--text-light);">Daily digest of activity</div>
              </div>
              <label style="position:relative; display:inline-block; width:44px; height:24px;">
                <input type="checkbox" style="opacity:0; width:0; height:0;">
                <span style="
                  position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0;
                  background-color:var(--border); border-radius:var(--radius-full);
                  transition:background var(--transition-fast);
                "></span>
                <span style="
                  position:absolute; content:''; height:18px; width:18px;
                  left:4px; bottom:3px; background:var(--bg-white);
                  border-radius:50%; transition:transform var(--transition-fast);
                "></span>
              </label>
            </div>
          </div>
        </div>

        <!-- Links Card -->
        <div style="background:var(--bg-white); border-radius:var(--radius-lg); box-shadow:var(--shadow-sm); padding:var(--space-5); margin-bottom:var(--space-5);">
          <div style="display:flex; flex-direction:column; gap:0;">
            <a href="#/about" style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-3) 0; border-bottom:1px solid var(--border-light); text-decoration:none;">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <i class="fas fa-info-circle" style="color:var(--text-light); width:20px; text-align:center;"></i>
                <span style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">About ekRAAH</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>
            <a href="#/terms" style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-3) 0; border-bottom:1px solid var(--border-light); text-decoration:none;">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <i class="fas fa-file-contract" style="color:var(--text-light); width:20px; text-align:center;"></i>
                <span style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">Terms of Service</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>
            <a href="#/privacy" style="display:flex; align-items:center; justify-content:space-between; padding:var(--space-3) 0; text-decoration:none;">
              <div style="display:flex; align-items:center; gap:var(--space-3);">
                <i class="fas fa-shield-alt" style="color:var(--text-light); width:20px; text-align:center;"></i>
                <span style="font-size:var(--text-sm); font-weight:var(--font-medium); color:var(--text-primary);">Privacy Policy</span>
              </div>
              <i class="fas fa-chevron-right" style="color:var(--text-light); font-size:12px;"></i>
            </a>
          </div>
        </div>

        <!-- Logout button -->
        <button id="gov-logout-btn" style="
          display:flex; align-items:center; justify-content:center; gap:var(--space-2);
          width:100%; padding:var(--space-4);
          font-size:var(--text-base); font-weight:var(--font-semibold);
          color:var(--error); background:var(--error-light);
          border:1.5px solid var(--error); border-radius:var(--radius-md);
          cursor:pointer; transition:all var(--transition-fast);
        ">
          <i class="fas fa-sign-out-alt"></i>
          Logout
        </button>
      `;

      appEl.innerHTML = renderGovShell('/gov/profile', 'Profile', contentHtml);
      topbarCleanup = attachTopbarListeners();

      // ── Language select handler ──
      const langSelect = document.getElementById('gov-lang-select');
      if (langSelect) {
        langSelect.addEventListener('change', (e) => {
          const lang = e.target.value;
          State().set('language', lang);
          localStorage.setItem('ekraah_lang', lang);
          Toast().show('Language preference updated.', 'success');
        });
      }

      // ── Logout handler ──
      const logoutBtn = document.getElementById('gov-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          logoutBtn.disabled = true;
          logoutBtn.textContent = 'Logging out...';
          try {
            await Auth().signOut();
            State().set('govOfficialDetails', null);
            Toast().show('Logged out successfully.', 'success');
            Router().navigate('/welcome');
          } catch (err) {
            console.error('Logout error:', err);
            Toast().show('Failed to logout. Please try again.', 'error');
            logoutBtn.disabled = false;
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
          }
        });
      }

    } catch (err) {
      console.error('Error loading profile:', err);
      Toast().show('Failed to load profile.', 'error');
      appEl.innerHTML = renderGovShell('/gov/profile', 'Profile', `
        <div style="text-align:center; padding:var(--space-10); color:var(--error);">
          <i class="fas fa-triangle-exclamation" style="font-size:40px; margin-bottom:var(--space-4);"></i>
          <p>Failed to load profile. Please try again.</p>
        </div>
      `);
      topbarCleanup = attachTopbarListeners();
    }

    return function cleanup() {
      if (topbarCleanup) topbarCleanup();
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REGISTER ALL ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  Router().register('/gov/home', renderGovHome);
  Router().register('/gov/applications', renderGovApplications);
  Router().register('/gov/application-detail/:id', renderAppDetail);
  Router().register('/gov/analytics', renderGovAnalytics);
  Router().register('/gov/profile', renderGovProfile);

})();
