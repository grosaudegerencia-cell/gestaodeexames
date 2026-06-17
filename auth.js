// ============================================================
//  auth.js — Autenticação e gestão de usuários GRO Saúde
// ============================================================

const GRO_AUTH = {

  SESSION_KEY:   'gro_session',
  USERS_KEY:     'gro_usuarios_extra',       // usuários criados pelo admin
  DISABLED_KEY:  'gro_usuarios_desativados', // usernames de padrão desativados
  OVERRIDES_KEY: 'gro_usuarios_override',    // edições nos usuários padrão (config.js)

  getDisabled() {
    try { return JSON.parse(localStorage.getItem(this.DISABLED_KEY)) || []; } catch { return []; }
  },
  saveDisabled(list) { localStorage.setItem(this.DISABLED_KEY, JSON.stringify(list)); },

  getOverrides() {
    try { return JSON.parse(localStorage.getItem(this.OVERRIDES_KEY)) || {}; } catch { return {}; }
  },
  saveOverrides(obj) { localStorage.setItem(this.OVERRIDES_KEY, JSON.stringify(obj)); },

  // ---- Lista combinada: usuários do config + criados pelo admin (sem desativados) ----
  // Aplica as edições (overrides) feitas sobre os usuários padrão.
  getAllUsers() {
    let extra = [];
    try { extra = JSON.parse(localStorage.getItem(this.USERS_KEY)) || []; } catch {}
    const desativados = this.getDisabled();
    const overrides = this.getOverrides();
    return [...GRO_CONFIG.USERS, ...extra]
      .filter(u => !desativados.includes(u.username))
      .map(u => overrides[u.username] ? { ...u, ...overrides[u.username] } : u);
  },

  getExtraUsers() {
    try { return JSON.parse(localStorage.getItem(this.USERS_KEY)) || []; } catch { return []; }
  },

  saveExtraUsers(list) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(list));
  },

  // ---- Sessão ----
  requireLogin() {
    if (!this.isLoggedIn()) { window.location.href = 'login.html'; return null; }
    return this.getUser();
  },

  requireAdmin() {
    const u = this.requireLogin();
    if (u && u.role !== 'admin') {
      alert('Acesso restrito ao administrador.');
      window.location.href = 'index.html';
      return null;
    }
    return u;
  },

  isLoggedIn() {
    const s = sessionStorage.getItem(this.SESSION_KEY);
    if (!s) return false;
    try { const x = JSON.parse(s); return x && x.username && x.expires > Date.now(); }
    catch { return false; }
  },

  getUser() {
    try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY)); } catch { return null; }
  },

  login(username, password) {
    const user = this.getAllUsers().find(
      u => u.username === username && atob(u.passwordB64) === password
    );
    if (!user) return false;
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify({
      username: user.username, name: user.name, role: user.role,
      expires: Date.now() + 8 * 60 * 60 * 1000,
    }));
    return true;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'login.html';
  },

  isAdmin() { const u = this.getUser(); return u && u.role === 'admin'; },

  // ---- Gestão de usuários (admin) ----
  criarUsuario({ username, password, name, role }) {
    username = (username||'').trim().toLowerCase();
    if (!username || !password || !name) return { ok:false, msg:'Preencha todos os campos.' };
    if (this.getAllUsers().some(u => u.username === username))
      return { ok:false, msg:'Já existe um usuário com esse nome.' };
    const extra = this.getExtraUsers();
    extra.push({ username, passwordB64: btoa(password), name, role: role||'user', fixo:false });
    this.saveExtraUsers(extra);
    return { ok:true };
  },

  // Exclui qualquer usuário (criado pelo admin OU padrão do config).
  // Protege: não pode excluir a si mesmo nem o último admin ativo.
  removerUsuario(username) {
    const atual = this.getUser();
    if (atual && atual.username === username)
      return { ok:false, msg:'Você não pode excluir o próprio usuário em uso.' };

    const alvo = this.getAllUsers().find(u => u.username === username);
    if (!alvo) return { ok:false, msg:'Usuário não encontrado.' };

    if (alvo.role === 'admin') {
      const admins = this.getAllUsers().filter(u => u.role === 'admin');
      if (admins.length <= 1)
        return { ok:false, msg:'Não é possível excluir o único administrador do sistema.' };
    }

    const fixo = GRO_CONFIG.USERS.some(u => u.username === username);
    if (fixo) {
      // usuário padrão (config.js): registra como desativado
      const dis = this.getDisabled();
      if (!dis.includes(username)) { dis.push(username); this.saveDisabled(dis); }
    } else {
      // usuário criado pelo admin: remove do localStorage
      this.saveExtraUsers(this.getExtraUsers().filter(u => u.username !== username));
    }
    return { ok:true };
  },

  // Edita nome, perfil e (opcionalmente) senha de qualquer usuário.
  // O username (login) não é alterável — é a identidade do usuário.
  editarUsuario({ username, name, role, password }) {
    username = (username||'').trim().toLowerCase();
    name = (name||'').trim();
    if (!name) return { ok:false, msg:'Informe o nome do usuário.' };

    const alvo = this.getAllUsers().find(u => u.username === username);
    if (!alvo) return { ok:false, msg:'Usuário não encontrado.' };

    // Proteção: não rebaixar o último administrador ativo
    if (alvo.role === 'admin' && role && role !== 'admin') {
      const admins = this.getAllUsers().filter(u => u.role === 'admin');
      if (admins.length <= 1)
        return { ok:false, msg:'Não é possível alterar o perfil do único administrador.' };
    }

    const fixo = GRO_CONFIG.USERS.some(u => u.username === username);
    if (fixo) {
      const ov = this.getOverrides();
      const novo = { ...(ov[username] || {}), name, role: role || alvo.role };
      if (password) novo.passwordB64 = btoa(password);
      ov[username] = novo;
      this.saveOverrides(ov);
    } else {
      const extra = this.getExtraUsers();
      const i = extra.findIndex(u => u.username === username);
      if (i < 0) return { ok:false, msg:'Usuário não encontrado.' };
      extra[i].name = name;
      extra[i].role = role || extra[i].role;
      if (password) extra[i].passwordB64 = btoa(password);
      this.saveExtraUsers(extra);
    }

    // Se o usuário em edição é o que está logado, atualiza a sessão
    const atual = this.getUser();
    if (atual && atual.username === username) {
      atual.name = name;
      atual.role = role || atual.role;
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(atual));
    }
    return { ok:true };
  },

  alterarSenha(username, novaSenha) {
    if (!novaSenha) return { ok:false, msg:'Informe a nova senha.' };
    const fixo = GRO_CONFIG.USERS.some(u => u.username === username);
    if (fixo) {
      const ov = this.getOverrides();
      ov[username] = { ...(ov[username] || {}), passwordB64: btoa(novaSenha) };
      this.saveOverrides(ov);
      return { ok:true };
    }
    const extra = this.getExtraUsers();
    const i = extra.findIndex(u => u.username === username);
    if (i >= 0) { extra[i].passwordB64 = btoa(novaSenha); this.saveExtraUsers(extra); return { ok:true }; }
    return { ok:false, msg:'Usuário não encontrado.' };
  }
};
