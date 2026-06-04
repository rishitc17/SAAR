/**
 * ekRAAH - Authentication Pages Module
 *
 * Registers routes for: / (splash), /welcome, /signup, /login
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
  const Toast   = () => window.EkraahToast;
  const Comp    = () => window.EkraahComponents;

  // ── SVG icons (inline, no external dependency) ──
  const ICON_EYE_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const ICON_EYE_CLOSED = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/></svg>`;

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

  // ── Lawyer specializations ──
  const SPECIALIZATIONS = [
    'Land Disputes',
    'Criminal Law',
    'Civil Law',
    'Family Law',
    'Corporate Law',
    'Tax Law'
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // 1. SPLASH SCREEN  (/)
  // ═══════════════════════════════════════════════════════════════════════

  function renderSplash() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="splash-screen" id="splash-screen">
        <!-- Animated tricolour gradient stripes (Indian flag horizontal) -->
        <div class="splash-gradient-stripes">
          <div class="stripe stripe-saffron"></div>
          <div class="stripe stripe-white"></div>
          <div class="stripe stripe-green"></div>
        </div>
        <div class="splash-logo">
          <img src="assets/full-logo.png" alt="ekRAAH Logo" />
        </div>
        <div class="splash-loader">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    `;

    let redirectTimeout = null;

    const performRedirect = async () => {
      try {
        const session = await Auth().getSession();
        if (session && session.user) {
          // User is logged in — redirect to role-based home
          const profile = State().get('profile') || await Auth().getProfile(session.user.id);
          if (profile) {
            State().set('profile', profile);
            State().set('currentUser', session.user);
            Auth().redirectToHome(profile.role);
            return;
          }
        }
      } catch (err) {
        console.warn('Splash session check failed:', err);
      }
      // Not logged in — go to welcome
      Router().navigate('/welcome');
    };

    redirectTimeout = setTimeout(performRedirect, 2500);

    // Cleanup
    return function cleanup() {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
        redirectTimeout = null;
      }
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 2. WELCOME SCREEN  (/welcome)
  // ═══════════════════════════════════════════════════════════════════════

  function renderWelcome() {
    const savedLang = State().get('language') || localStorage.getItem('ekraah_lang') || 'en';
    const langOptions = LANGUAGES.map(l =>
      `<option value="${l.code}" ${l.code === savedLang ? 'selected' : ''}>${l.label}</option>`
    ).join('');

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="welcome-screen">
        ${Comp().tricolourBar()}
        <div class="welcome-logo">
          <img src="assets/full-logo.png" alt="ekRAAH Logo" />
        </div>
        <h1 class="welcome-tagline">Har Kaam ki Ek Raah</h1>
        <p class="welcome-subtitle">India's Unified Digital Government Services Platform</p>

        <div class="welcome-illustration">
          <img src="assets/welcome-banner.png" alt="ekRAAH - Connecting citizens with government services" onerror="this.style.display='none'" />
        </div>

        <div class="welcome-banner">
          <div class="language-selector">
            <label for="lang-select">Select Language</label>
            <select id="lang-select" class="form-select">
              ${langOptions}
            </select>
          </div>

          <div class="welcome-actions">
            <button id="btn-get-started" class="btn-get-started">Get Started</button>
            <button id="btn-login" class="btn-login-outlined">Login</button>
          </div>
        </div>

        <p style="
          font-size: var(--text-xs);
          color: var(--text-light);
          text-align: center;
          margin-top: var(--space-6);
          max-width: 360px;
          line-height: var(--leading-normal);
        ">
          By continuing, you agree to the
          <a href="#/terms" style="color: var(--saffron); text-decoration: underline;">Terms of Service</a>
          and
          <a href="#/privacy" style="color: var(--saffron); text-decoration: underline;">Privacy Policy</a>
        </p>
      </div>
    `;

    // ── Event listeners ──
    const langSelect = document.getElementById('lang-select');
    const btnGetStarted = document.getElementById('btn-get-started');
    const btnLogin = document.getElementById('btn-login');

    function onLangChange() {
      const lang = langSelect.value;
      State().set('language', lang);
      localStorage.setItem('ekraah_lang', lang);
    }

    function onGetStarted() {
      Router().navigate('/signup');
    }

    function onLogin() {
      Router().navigate('/login');
    }

    langSelect.addEventListener('change', onLangChange);
    btnGetStarted.addEventListener('click', onGetStarted);
    btnLogin.addEventListener('click', onLogin);

    // Cleanup
    return function cleanup() {
      langSelect.removeEventListener('change', onLangChange);
      btnGetStarted.removeEventListener('click', onGetStarted);
      btnLogin.removeEventListener('click', onLogin);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 3. SIGN-UP PAGE  (/signup)
  // ═══════════════════════════════════════════════════════════════════════

  function renderSignup() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-page">
        <div class="auth-illustration-side">
          <img src="assets/welcome-banner.png" alt="ekRAAH" onerror="this.parentElement.style.display='none'" />
        </div>
        <div class="auth-card">
          <div class="auth-logo">
            <img src="assets/mini-logo.png" alt="ekRAAH" />
          </div>
          <h2 class="auth-title">Welcome to ekRAAH!</h2>
          <p class="auth-subtitle">Create your account to get started</p>

          <!-- Role Toggle -->
          <div class="role-toggle" id="role-toggle">
            <button type="button" class="role-toggle-option active" data-role="citizen" id="toggle-citizen">Citizen</button>
            <button type="button" class="role-toggle-option" data-role="lawyer" id="toggle-lawyer">Lawyer</button>
          </div>

          <form id="signup-form" class="auth-form" novalidate>
            <!-- Full Name -->
            <div class="form-group" id="fg-fullname">
              <label class="form-label" for="signup-name">Full Name <span class="required">*</span></label>
              <input type="text" id="signup-name" class="form-input" placeholder="Enter your full name" required autocomplete="name" />
            </div>

            <!-- Email -->
            <div class="form-group" id="fg-email">
              <label class="form-label" for="signup-email">Email ID <span class="required">*</span></label>
              <input type="email" id="signup-email" class="form-input" placeholder="you@example.com" required autocomplete="email" />
            </div>

            <!-- Password -->
            <div class="form-group" id="fg-password">
              <label class="form-label" for="signup-password">Password <span class="required">*</span></label>
              <div class="password-field">
                <input type="password" id="signup-password" class="form-input" placeholder="Minimum 8 characters" required autocomplete="new-password" minlength="8" style="padding-right: 44px;" />
                <button type="button" class="password-toggle" data-target="signup-password" aria-label="Toggle password visibility">
                  ${ICON_EYE_OPEN}
                </button>
              </div>
            </div>

            <!-- Confirm Password -->
            <div class="form-group" id="fg-confirm">
              <label class="form-label" for="signup-confirm">Confirm Password <span class="required">*</span></label>
              <div class="password-field">
                <input type="password" id="signup-confirm" class="form-input" placeholder="Re-enter your password" required autocomplete="new-password" style="padding-right: 44px;" />
                <button type="button" class="password-toggle" data-target="signup-confirm" aria-label="Toggle password visibility">
                  ${ICON_EYE_OPEN}
                </button>
              </div>
            </div>

            <!-- Lawyer-only fields (hidden by default) -->
            <div id="lawyer-fields" style="display: none;">
              <!-- Bar Council Enrollment Number -->
              <div class="form-group" id="fg-bar-council">
                <label class="form-label" for="signup-bar-council">Bar Council Enrollment Number <span class="required">*</span></label>
                <input type="text" id="signup-bar-council" class="form-input" placeholder="e.g. S/1234/2015" />
                <span class="form-helper" style="font-size: var(--text-xs); color: var(--text-light); margin-top: var(--space-1);">This will be verified automatically</span>
              </div>

              <!-- Specialization -->
              <div class="form-group" id="fg-specialization">
                <label class="form-label" for="signup-specialization">Specialization Area <span class="required">*</span></label>
                <select id="signup-specialization" class="form-select">
                  <option value="" disabled selected>Select your specialization</option>
                  ${SPECIALIZATIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Submit -->
            <div class="auth-actions">
              <button type="submit" class="btn-primary" id="btn-signup" style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                padding: var(--space-4) var(--space-6);
                font-size: var(--text-base);
                font-weight: var(--font-semibold);
                color: var(--text-inverse);
                background: linear-gradient(135deg, var(--saffron), var(--saffron-dark));
                border: none;
                border-radius: var(--radius-md);
                box-shadow: 0 4px 12px rgba(255, 153, 51, 0.3);
                transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
              ">Sign Up</button>
            </div>
          </form>

          <div style="text-align: center; margin-top: var(--space-4);">
            <span style="font-size: var(--text-sm); color: var(--text-secondary);">Already have an account? </span>
            <a href="#/login" class="auth-link">Login</a>
          </div>

          <p style="
            font-size: var(--text-xs);
            color: var(--text-light);
            text-align: center;
            margin-top: var(--space-4);
            line-height: var(--leading-normal);
          ">
            Government officials cannot sign up here. Use your pre-assigned credentials to <a href="#/login" style="color: var(--navy); font-weight: var(--font-medium);">log in</a>.
          </p>
        </div>
      </div>
    `;

    // ── State ──
    let selectedRole = 'citizen';

    // ── DOM refs ──
    const toggleCitizen = document.getElementById('toggle-citizen');
    const toggleLawyer  = document.getElementById('toggle-lawyer');
    const lawyerFields  = document.getElementById('lawyer-fields');
    const signupForm    = document.getElementById('signup-form');
    const btnSignup     = document.getElementById('btn-signup');

    const inputName       = document.getElementById('signup-name');
    const inputEmail      = document.getElementById('signup-email');
    const inputPassword   = document.getElementById('signup-password');
    const inputConfirm    = document.getElementById('signup-confirm');
    const inputBarCouncil = document.getElementById('signup-bar-council');
    const inputSpecial    = document.getElementById('signup-specialization');

    // ── Role toggle ──
    function setRole(role) {
      selectedRole = role;
      if (role === 'lawyer') {
        toggleCitizen.classList.remove('active');
        toggleLawyer.classList.add('active');
        lawyerFields.style.display = 'block';
        inputBarCouncil.setAttribute('required', '');
        inputSpecial.setAttribute('required', '');
      } else {
        toggleCitizen.classList.add('active');
        toggleLawyer.classList.remove('active');
        lawyerFields.style.display = 'none';
        inputBarCouncil.removeAttribute('required');
        inputSpecial.removeAttribute('required');
      }
    }

    function onToggleCitizen() { setRole('citizen'); }
    function onToggleLawyer()  { setRole('lawyer'); }

    toggleCitizen.addEventListener('click', onToggleCitizen);
    toggleLawyer.addEventListener('click', onToggleLawyer);

    // ── Password visibility toggles ──
    const passwordToggles = document.querySelectorAll('.password-toggle');

    function onPasswordToggle(e) {
      const btn = e.currentTarget;
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = ICON_EYE_CLOSED;
      } else {
        input.type = 'password';
        btn.innerHTML = ICON_EYE_OPEN;
      }
    }

    passwordToggles.forEach(btn => {
      btn.addEventListener('click', onPasswordToggle);
    });

    // ── Validation helpers ──
    function setFieldError(groupId, message) {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.classList.add('error');
      // Remove existing error message
      const existing = group.querySelector('.form-error');
      if (existing) existing.remove();
      if (message) {
        const errEl = document.createElement('span');
        errEl.className = 'form-error';
        errEl.textContent = message;
        group.appendChild(errEl);
      }
    }

    function clearFieldError(groupId) {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.classList.remove('error');
      const existing = group.querySelector('.form-error');
      if (existing) existing.remove();
    }

    function clearAllErrors() {
      ['fg-fullname', 'fg-email', 'fg-password', 'fg-confirm', 'fg-bar-council', 'fg-specialization'].forEach(clearFieldError);
    }

    // ── Form submission ──
    async function onSignupSubmit(e) {
      e.preventDefault();
      clearAllErrors();

      const fullName = inputName.value.trim();
      const email    = inputEmail.value.trim();
      const password = inputPassword.value;
      const confirm  = inputConfirm.value;

      let hasError = false;

      // Validate full name
      if (!fullName) {
        setFieldError('fg-fullname', 'Full name is required');
        hasError = true;
      }

      // Validate email
      if (!email) {
        setFieldError('fg-email', 'Email is required');
        hasError = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError('fg-email', 'Please enter a valid email address');
        hasError = true;
      }

      // Validate password
      if (!password) {
        setFieldError('fg-password', 'Password is required');
        hasError = true;
      } else if (password.length < 8) {
        setFieldError('fg-password', 'Password must be at least 8 characters');
        hasError = true;
      }

      // Validate confirm password
      if (!confirm) {
        setFieldError('fg-confirm', 'Please confirm your password');
        hasError = true;
      } else if (password !== confirm) {
        setFieldError('fg-confirm', 'Passwords do not match');
        Toast().show('Passwords do not match', 'error');
        hasError = true;
      }

      // Lawyer-specific validations
      if (selectedRole === 'lawyer') {
        const barCouncil = inputBarCouncil.value.trim();
        const specialization = inputSpecial.value;

        if (!barCouncil) {
          setFieldError('fg-bar-council', 'Bar Council Enrollment Number is required');
          hasError = true;
        }

        if (!specialization) {
          setFieldError('fg-specialization', 'Please select a specialization');
          hasError = true;
        }
      }

      if (hasError) return;

      // Disable button while processing
      btnSignup.disabled = true;
      btnSignup.textContent = 'Creating account...';
      btnSignup.style.opacity = '0.7';

      try {
        // Build metadata — the handle_new_user trigger reads these
        const metadata = {
          full_name: fullName,
          role: selectedRole,
          preferred_language: State().get('language') || 'en'
        };

        const data = await Auth().signUp(email, password, metadata);

        // For lawyers: insert into lawyer_details table
        if (selectedRole === 'lawyer' && data.user) {
          try {
            const { error: lawyerError } = await DB()
              .from('lawyer_details')
              .insert({
                user_id: data.user.id,
                bar_council_number: inputBarCouncil.value.trim(),
                specialization: inputSpecial.value
              });

            if (lawyerError) {
              console.error('Failed to insert lawyer details:', lawyerError);
              Toast().show('Account created, but lawyer details could not be saved. Please update your profile.', 'warning');
            }
          } catch (lawyerErr) {
            console.error('Lawyer details insert error:', lawyerErr);
            Toast().show('Account created, but lawyer details could not be saved.', 'warning');
          }
        }

        Toast().show('Account created successfully! Please log in.', 'success');
        Router().navigate('/login');

      } catch (err) {
        const msg = err?.message || 'Sign up failed. Please try again.';
        Toast().show(msg, 'error');
      } finally {
        btnSignup.disabled = false;
        btnSignup.textContent = 'Sign Up';
        btnSignup.style.opacity = '1';
      }
    }

    signupForm.addEventListener('submit', onSignupSubmit);

    // ── Cleanup ──
    return function cleanup() {
      toggleCitizen.removeEventListener('click', onToggleCitizen);
      toggleLawyer.removeEventListener('click', onToggleLawyer);
      passwordToggles.forEach(btn => {
        btn.removeEventListener('click', onPasswordToggle);
      });
      signupForm.removeEventListener('submit', onSignupSubmit);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 4. LOGIN PAGE  (/login)
  // ═══════════════════════════════════════════════════════════════════════

  function renderLogin() {
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="auth-page">
        <div class="auth-illustration-side">
          <img src="assets/welcome-banner.png" alt="ekRAAH" onerror="this.parentElement.style.display='none'" />
        </div>
        <div class="auth-card">
          <div class="auth-logo">
            <img src="assets/mini-logo.png" alt="ekRAAH" />
          </div>
          <h2 class="auth-title">Welcome Back!</h2>
          <p class="auth-subtitle">Log in to your ekRAAH account</p>

          <form id="login-form" class="auth-form" novalidate>
            <!-- Email -->
            <div class="form-group" id="fg-login-email">
              <label class="form-label" for="login-email">Email ID <span class="required">*</span></label>
              <input type="email" id="login-email" class="form-input" placeholder="you@example.com" required autocomplete="email" />
            </div>

            <!-- Password -->
            <div class="form-group" id="fg-login-password">
              <label class="form-label" for="login-password">Password <span class="required">*</span></label>
              <div class="password-field">
                <input type="password" id="login-password" class="form-input" placeholder="Enter your password" required autocomplete="current-password" style="padding-right: 44px;" />
                <button type="button" class="password-toggle" data-target="login-password" aria-label="Toggle password visibility">
                  ${ICON_EYE_OPEN}
                </button>
              </div>
            </div>

            <!-- Submit -->
            <div class="auth-actions">
              <button type="submit" class="btn-primary" id="btn-login" style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                padding: var(--space-4) var(--space-6);
                font-size: var(--text-base);
                font-weight: var(--font-semibold);
                color: var(--text-inverse);
                background: linear-gradient(135deg, var(--saffron), var(--saffron-dark));
                border: none;
                border-radius: var(--radius-md);
                box-shadow: 0 4px 12px rgba(255, 153, 51, 0.3);
                transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
              ">Login</button>
            </div>
          </form>

          <div style="text-align: center; margin-top: var(--space-4);">
            <span style="font-size: var(--text-sm); color: var(--text-secondary);">New to ekRAAH? </span>
            <a href="#/signup" class="auth-link">Create an Account</a>
          </div>

          <p style="
            font-size: var(--text-xs);
            color: var(--text-light);
            text-align: center;
            margin-top: var(--space-4);
            line-height: var(--leading-normal);
          ">
            Government officials: Use your pre-assigned credentials to log in.
          </p>
        </div>
      </div>
    `;

    // ── DOM refs ──
    const loginForm    = document.getElementById('login-form');
    const btnLogin     = document.getElementById('btn-login');
    const inputEmail   = document.getElementById('login-email');
    const inputPassword = document.getElementById('login-password');

    // ── Password visibility toggle ──
    const passwordToggles = document.querySelectorAll('.password-toggle');

    function onPasswordToggle(e) {
      const btn = e.currentTarget;
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = ICON_EYE_CLOSED;
      } else {
        input.type = 'password';
        btn.innerHTML = ICON_EYE_OPEN;
      }
    }

    passwordToggles.forEach(btn => {
      btn.addEventListener('click', onPasswordToggle);
    });

    // ── Validation helpers ──
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

    function clearFieldError(groupId) {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.classList.remove('error');
      const existing = group.querySelector('.form-error');
      if (existing) existing.remove();
    }

    // ── Form submission ──
    async function onLoginSubmit(e) {
      e.preventDefault();

      clearFieldError('fg-login-email');
      clearFieldError('fg-login-password');

      const email    = inputEmail.value.trim();
      const password = inputPassword.value;

      let hasError = false;

      if (!email) {
        setFieldError('fg-login-email', 'Email is required');
        hasError = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError('fg-login-email', 'Please enter a valid email address');
        hasError = true;
      }

      if (!password) {
        setFieldError('fg-login-password', 'Password is required');
        hasError = true;
      }

      if (hasError) return;

      // Disable button while processing
      btnLogin.disabled = true;
      btnLogin.textContent = 'Logging in...';
      btnLogin.style.opacity = '0.7';

      try {
        await Auth().signIn(email, password);

        // Fetch profile and set state
        const profile = await Auth().getProfile();
        const user = await Auth().getCurrentUser();

        State().set('profile', profile);
        State().set('currentUser', user);

        Toast().show('Welcome back!', 'success');

        // Redirect based on role
        if (profile && profile.role) {
          Auth().redirectToHome(profile.role);
        } else {
          // Fallback — should not happen
          Router().navigate('/welcome');
        }

      } catch (err) {
        const msg = err?.message || 'Login failed. Please check your credentials.';
        Toast().show(msg, 'error');
      } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Login';
        btnLogin.style.opacity = '1';
      }
    }

    loginForm.addEventListener('submit', onLoginSubmit);

    // ── Cleanup ──
    return function cleanup() {
      passwordToggles.forEach(btn => {
        btn.removeEventListener('click', onPasswordToggle);
      });
      loginForm.removeEventListener('submit', onLoginSubmit);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // REGISTER ALL ROUTES
  // ═══════════════════════════════════════════════════════════════════════

  Router().register('/', renderSplash);
  Router().register('/welcome', renderWelcome);
  Router().register('/signup', renderSignup);
  Router().register('/login', renderLogin);

})();
