/**
 * ekRAAH - Hash-based SPA Router
 */

const EkraahRouter = (() => {
  const routes = {};
  const beforeHooks = [];
  let currentRoute = null;
  let currentCleanup = null;

  function getHash() {
    return window.location.hash.slice(1) || '/';
  }

  function parseRoute(hash) {
    const parts = hash.split('?');
    const path = parts[0];
    const query = parts[1] || '';
    const params = {};
    if (query) {
      query.split('&').forEach(pair => {
        const [key, val] = pair.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(val || '');
      });
    }
    return { path, params };
  }

  function matchRoute(path) {
    // Exact match first
    if (routes[path]) return { handler: routes[path], params: {} };

    // Pattern match (e.g., /citizen/application/:id)
    for (const pattern in routes) {
      const patternParts = pattern.split('/');
      const pathParts = path.split('/');
      if (patternParts.length !== pathParts.length) continue;

      const params = {};
      let match = true;
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          params[patternParts[i].slice(1)] = pathParts[i];
        } else if (patternParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }
      if (match) return { handler: routes[pattern], params };
    }
    return null;
  }

  async function navigate(path) {
    window.location.hash = path;
  }

  async function handleRoute() {
    const { path, params: queryParams } = parseRoute(getHash());
    const routeMatch = matchRoute(path);

    if (!routeMatch) {
      // Default redirect
      navigate('/');
      return;
    }

    // Run before hooks
    for (const hook of beforeHooks) {
      const result = await hook(path, routeMatch.params, queryParams);
      if (result === false) return; // Hook prevented navigation
    }

    // Cleanup previous route
    if (currentCleanup) {
      currentCleanup();
      currentCleanup = null;
    }

    currentRoute = path;
    const allParams = { ...routeMatch.params, ...queryParams };

    // Render the route
    const result = await routeMatch.handler(allParams);
    if (typeof result === 'function') {
      currentCleanup = result;
    }
  }

  function register(path, handler) {
    routes[path] = handler;
  }

  function beforeEach(hook) {
    beforeHooks.push(hook);
  }

  function init() {
    window.addEventListener('hashchange', handleRoute);
    // Handle initial route
    if (!window.location.hash) {
      window.location.hash = '/';
    }
    handleRoute();
  }

  function getCurrentRoute() {
    return currentRoute;
  }

  return {
    navigate,
    register,
    beforeEach,
    init,
    getCurrentRoute,
    getHash
  };
})();

window.EkraahRouter = EkraahRouter;
