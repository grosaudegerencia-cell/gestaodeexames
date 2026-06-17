// ============================================================
//  auth.js — Autenticação GRO Saúde
// ============================================================

const GRO_AUTH = {

  SESSION_KEY: 'gro_session',

  // Verifica se está logado; redireciona para login se não estiver
  requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return null;
    }
    return this.getUser();
  },

  isLoggedIn() {
    const s = sessionStorage.getItem(this.SESSION_KEY);
    if (!s) return false;
    try {
      const session = JSON.parse(s);
      return session && session.username && session.expires > Date.now();
    } catch { return false; }
  },

  getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(this.SESSION_KEY));
    } catch { return null; }
  },

  login(username, password) {
    const user = GRO_CONFIG.USERS.find(
      u => u.username === username && atob(u.passwordB64) === password
    );
    if (!user) return false;
    const session = {
      username: user.username,
      name:     user.name,
      role:     user.role,
      expires:  Date.now() + 8 * 60 * 60 * 1000, // 8 horas
    };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return true;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'login.html';
  },

  isAdmin() {
    const u = this.getUser();
    return u && u.role === 'admin';
  }
};
