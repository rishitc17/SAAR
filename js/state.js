/**
 * ekRAAH - State Management
 * Simple reactive state management for the SPA
 */

const EkraahState = (() => {
  const state = {
    currentUser: null,
    profile: null,
    notifications: [],
    language: localStorage.getItem('ekraah_lang') || 'en',
    pwaDismissed: sessionStorage.getItem('ekraah_pwa_dismissed') === 'true',
    sidebarOpen: false,
    chatbotOpen: false,
  };

  const listeners = {};

  return {
    get(key) {
      return state[key];
    },

    set(key, value) {
      const oldValue = state[key];
      state[key] = value;
      if (listeners[key] && oldValue !== value) {
        listeners[key].forEach(fn => fn(value, oldValue));
      }
    },

    subscribe(key, callback) {
      if (!listeners[key]) listeners[key] = [];
      listeners[key].push(callback);
      return () => {
        listeners[key] = listeners[key].filter(fn => fn !== callback);
      };
    },

    getAll() {
      return { ...state };
    }
  };
})();

window.EkraahState = EkraahState;
