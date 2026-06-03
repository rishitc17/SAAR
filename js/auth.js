/**
 * ekRAAH - Authentication Module
 */

const EkraahAuth = (() => {
  const db = () => window.EkraahDB;

  async function signUp(email, password, metadata = {}) {
    const { data, error } = await db().auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    if (error) throw error;
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await db().auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await db().auth.signOut();
    if (error) throw error;
    window.EkraahState.set('currentUser', null);
    window.EkraahState.set('profile', null);
    localStorage.removeItem('ekraah_session');
  }

  async function getCurrentUser() {
    const { data: { user } } = await db().auth.getUser();
    return user;
  }

  async function getSession() {
    const { data: { session } } = await db().auth.getSession();
    return session;
  }

  async function getProfile(userId) {
    if (!userId) {
      const user = await getCurrentUser();
      if (!user) return null;
      userId = user.id;
    }
    const { data, error } = await db()
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  }

  async function getLawyerDetails(userId) {
    const { data, error } = await db()
      .from('lawyer_details')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) return null;
    return data;
  }

  async function getGovOfficialDetails(userId) {
    const { data, error } = await db()
      .from('government_officials')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) return null;
    return data;
  }

  function onAuthStateChange(callback) {
    return db().auth.onAuthStateChange(callback);
  }

  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      EkraahRouter.navigate('/welcome');
      return false;
    }
    return true;
  }

  async function requireRole(role) {
    const isAuth = await requireAuth();
    if (!isAuth) return false;
    
    const profile = EkraahState.get('profile');
    if (!profile) {
      const p = await getProfile();
      EkraahState.set('profile', p);
      if (p.role !== role) {
        redirectToHome(p.role);
        return false;
      }
    } else if (profile.role !== role) {
      redirectToHome(profile.role);
      return false;
    }
    return true;
  }

  function redirectToHome(role) {
    switch (role) {
      case 'citizen':
        EkraahRouter.navigate('/citizen/home');
        break;
      case 'government_official':
        EkraahRouter.navigate('/gov/home');
        break;
      case 'lawyer':
        EkraahRouter.navigate('/lawyer/home');
        break;
      default:
        EkraahRouter.navigate('/welcome');
    }
  }

  async function initAuth() {
    const session = await getSession();
    if (session) {
      EkraahState.set('currentUser', session.user);
      const profile = await getProfile(session.user.id);
      EkraahState.set('profile', profile);
    }
  }

  return {
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    getSession,
    getProfile,
    getLawyerDetails,
    getGovOfficialDetails,
    onAuthStateChange,
    requireAuth,
    requireRole,
    redirectToHome,
    initAuth
  };
})();

window.EkraahAuth = EkraahAuth;
