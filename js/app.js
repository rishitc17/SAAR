/**
 * ekRAAH - Main Application Entry Point
 * Initializes routing, authentication, and PWA support
 */

(function () {
  'use strict';

  // ============ Auth State Listener ============
  EkraahAuth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      EkraahState.set('currentUser', session.user);
      const profile = await EkraahAuth.getProfile(session.user.id);
      EkraahState.set('profile', profile);
    } else if (event === 'SIGNED_OUT') {
      EkraahState.set('currentUser', null);
      EkraahState.set('profile', null);
    }
  });

  // ============ Route Guard ============
  EkraahRouter.beforeEach(async (path, routeParams, queryParams) => {
    const publicRoutes = ['/', '/welcome', '/signup', '/login'];
    const isPublic = publicRoutes.includes(path);

    // Allow public routes without auth
    if (isPublic) return true;

    // Check auth for protected routes
    const session = await EkraahAuth.getSession();
    if (!session) {
      EkraahRouter.navigate('/welcome');
      return false;
    }

    // Ensure profile is loaded
    if (!EkraahState.get('profile')) {
      const profile = await EkraahAuth.getProfile();
      if (profile) {
        EkraahState.set('profile', profile);
      } else {
        EkraahRouter.navigate('/login');
        return false;
      }
    }

    // Role-based route protection
    const profile = EkraahState.get('profile');
    if (path.startsWith('/citizen') && profile.role !== 'citizen') {
      EkraahAuth.redirectToHome(profile.role);
      return false;
    }
    if (path.startsWith('/gov') && profile.role !== 'government_official') {
      EkraahAuth.redirectToHome(profile.role);
      return false;
    }
    if (path.startsWith('/lawyer') && profile.role !== 'lawyer') {
      EkraahAuth.redirectToHome(profile.role);
      return false;
    }

    return true;
  });

  // ============ PWA Service Worker Registration ============
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(registration => {
          console.log('ekRAAH SW registered:', registration.scope);
        })
        .catch(error => {
          console.log('ekRAAH SW registration failed:', error);
        });
    });
  }

  // ============ Initialize App ============
  async function init() {
    try {
      // Initialize auth state
      await EkraahAuth.initAuth();

      // Initialize router
      EkraahRouter.init();

      console.log('ekRAAH initialized successfully');
    } catch (error) {
      console.error('ekRAAH initialization error:', error);
      // Still try to initialize router even if auth fails
      EkraahRouter.init();
    }
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
