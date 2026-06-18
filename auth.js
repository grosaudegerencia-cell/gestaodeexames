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
  // Remove duplicatas por username (config.js tem precedência sobre localStorage).
  getAllUsers() {
    let extra = [];
    try { extra = JSON.parse(localStorage.getItem(this.USERS_KEY)) || []; } catch {}
    const desativados = this.getDisabled();
    const overrides = this.getOverrides();
    const vistos = new Set();
    const unicos = [];
    for (const u of [...GRO_CONFIG.USERS, ...extra]) {
      if (vistos.has(u.username)) continue;   // config vem primeiro -> ganha
      vistos.add(u.username);
      unicos.push(u);
    }
    return unicos
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
    const u = this.getUser();
    // Força a troca de senha no primeiro acesso (exceto já estando na tela de troca)
    if (u && u.mustChangePassword && !/trocar-senha\.html(\?|$)/.test(location.pathname + location.search)) {
      window.location.href = 'trocar-senha.html';
      return null;
    }
    return u;
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
      email: user.email || '',
      mustChangePassword: !!user.mustChangePassword,
      expires: Date.now() + 8 * 60 * 60 * 1000,
    }));
    return true;
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'login.html';
  },

  isAdmin() { const u = this.getUser(); return u && u.role === 'admin'; },

  // Aplica um patch ({campo:valor}) ao usuário, seja ele padrão (override) ou criado pelo admin.
  _patchUser(username, patch) {
    const fixo = GRO_CONFIG.USERS.some(u => u.username === username);
    if (fixo) {
      const ov = this.getOverrides();
      ov[username] = { ...(ov[username] || {}), ...patch };
      this.saveOverrides(ov);
    } else {
      const extra = this.getExtraUsers();
      const i = extra.findIndex(u => u.username === username);
      if (i >= 0) { extra[i] = { ...extra[i], ...patch }; this.saveExtraUsers(extra); }
    }
  },

  emailValido(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); },

  // ---- Gestão de usuários (admin) ----
  criarUsuario({ username, password, name, role, email, mustChangePassword }) {
    username = (username||'').trim().toLowerCase();
    email = (email||'').trim();
    if (!username || !password || !name) return { ok:false, msg:'Preencha nome, usuário e senha.' };
    if (email && !this.emailValido(email)) return { ok:false, msg:'E-mail inválido.' };
    if (this.getAllUsers().some(u => u.username === username))
      return { ok:false, msg:'Já existe um usuário com esse nome.' };
    const extra = this.getExtraUsers();
    extra.push({ username, passwordB64: btoa(password), name, role: role||'user',
                 email, mustChangePassword: mustChangePassword !== false, fixo:false });
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

  // Edita nome, perfil, e-mail e (opcionalmente) senha de qualquer usuário.
  // O username (login) não é alterável — é a identidade do usuário.
  editarUsuario({ username, name, role, password, email }) {
    username = (username||'').trim().toLowerCase();
    name = (name||'').trim();
    if (!name) return { ok:false, msg:'Informe o nome do usuário.' };

    const alvo = this.getAllUsers().find(u => u.username === username);
    if (!alvo) return { ok:false, msg:'Usuário não encontrado.' };

    if (email != null) {
      email = email.trim();
      if (email && !this.emailValido(email)) return { ok:false, msg:'E-mail inválido.' };
    }

    // Proteção: não rebaixar o último administrador ativo
    if (alvo.role === 'admin' && role && role !== 'admin') {
      const admins = this.getAllUsers().filter(u => u.role === 'admin');
      if (admins.length <= 1)
        return { ok:false, msg:'Não é possível alterar o perfil do único administrador.' };
    }

    const patch = { name, role: role || alvo.role };
    if (email != null) patch.email = email;
    if (password) patch.passwordB64 = btoa(password);
    this._patchUser(username, patch);

    // Se o usuário em edição é o que está logado, atualiza a sessão
    const atual = this.getUser();
    if (atual && atual.username === username) {
      atual.name = name;
      atual.role = role || atual.role;
      if (email != null) atual.email = email;
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(atual));
    }
    return { ok:true };
  },

  alterarSenha(username, novaSenha) {
    if (!novaSenha) return { ok:false, msg:'Informe a nova senha.' };
    if (!this.getAllUsers().some(u => u.username === username))
      return { ok:false, msg:'Usuário não encontrado.' };
    this._patchUser(username, { passwordB64: btoa(novaSenha) });
    return { ok:true };
  },

  // ---- Troca de senha no primeiro acesso (usuário logado) ----
  precisaTrocarSenha() {
    const u = this.getUser();
    return !!(u && u.mustChangePassword);
  },

  trocarSenhaLogado(senhaAtual, novaSenha) {
    const u = this.getUser();
    if (!u) return { ok:false, msg:'Sessão expirada. Faça login novamente.' };
    const full = this.getAllUsers().find(x => x.username === u.username);
    if (!full) return { ok:false, msg:'Usuário não encontrado.' };
    if (atob(full.passwordB64) !== senhaAtual)
      return { ok:false, msg:'A senha atual está incorreta.' };
    if (!novaSenha || novaSenha.length < 4)
      return { ok:false, msg:'A nova senha deve ter ao menos 4 caracteres.' };
    if (novaSenha === senhaAtual)
      return { ok:false, msg:'A nova senha deve ser diferente da atual.' };

    this._patchUser(u.username, { passwordB64: btoa(novaSenha), mustChangePassword: false });
    u.mustChangePassword = false;
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(u));
    return { ok:true };
  },

  // ---- Recuperação de senha por e-mail ----
  RECOVERY_KEY: 'gro_recovery_codes',
  getRecovery() { try { return JSON.parse(localStorage.getItem(this.RECOVERY_KEY)) || {}; } catch { return {}; } },
  saveRecovery(o) { localStorage.setItem(this.RECOVERY_KEY, JSON.stringify(o)); },

  // Localiza usuário por login OU e-mail
  acharPorLoginOuEmail(valor) {
    valor = (valor||'').trim().toLowerCase();
    return this.getAllUsers().find(u =>
      u.username === valor || (u.email||'').toLowerCase() === valor);
  },

  // Gera um código de 6 dígitos válido por 15 min. Retorna dados para o envio do e-mail.
  gerarCodigoRecuperacao(loginOuEmail) {
    const u = this.acharPorLoginOuEmail(loginOuEmail);
    if (!u) return { ok:false, msg:'Usuário ou e-mail não encontrado.' };
    if (!u.email) return { ok:false, msg:'Este usuário não tem e-mail cadastrado. Contate o administrador.' };
    const code = String(Math.floor(100000 + Math.random()*900000));
    const rec = this.getRecovery();
    rec[u.username] = { code, expires: Date.now() + 15*60*1000 };
    this.saveRecovery(rec);
    return { ok:true, username:u.username, email:u.email, nome:u.name, code };
  },

  redefinirSenhaPorCodigo(loginOuEmail, code, novaSenha) {
    const u = this.acharPorLoginOuEmail(loginOuEmail);
    if (!u) return { ok:false, msg:'Usuário não encontrado.' };
    const rec = this.getRecovery();
    const r = rec[u.username];
    if (!r) return { ok:false, msg:'Nenhum código foi solicitado. Solicite um novo.' };
    if (Date.now() > r.expires) { delete rec[u.username]; this.saveRecovery(rec); return { ok:false, msg:'Código expirado. Solicite um novo.' }; }
    if (String(code).trim() !== r.code) return { ok:false, msg:'Código incorreto.' };
    if (!novaSenha || novaSenha.length < 4) return { ok:false, msg:'A senha deve ter ao menos 4 caracteres.' };

    this._patchUser(u.username, { passwordB64: btoa(novaSenha), mustChangePassword: false });
    delete rec[u.username]; this.saveRecovery(rec);
    return { ok:true };
  },

  // Máscara para exibir e-mail parcialmente (ex.: jo***@gmail.com)
  mascararEmail(email) {
    if (!email || !email.includes('@')) return email || '';
    const [u, d] = email.split('@');
    const ini = u.slice(0, Math.min(2, u.length));
    return `${ini}${'*'.repeat(Math.max(u.length-2, 1))}@${d}`;
  },

  // Dispara o e-mail com o código de recuperação via Apps Script (relay).
  // Retorna uma Promise; em modo no-cors não há leitura da resposta.
  async enviarEmailRecuperacao({ email, nome, code }) {
    if (typeof GRO_CONFIG === 'undefined' || !GRO_CONFIG.SHEETS_URL)
      return { ok:false, msg:'Envio de e-mail não configurado (SHEETS_URL).' };
    try {
      await fetch(GRO_CONFIG.SHEETS_URL, {
        method:'POST', mode:'no-cors',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ action:'recuperarSenha', data:{ to:email, nome, code } })
      });
      return { ok:true };
    } catch (e) {
      return { ok:false, msg:'Falha ao contatar o servidor de e-mail.' };
    }
  }
};

// ============================================================
//  Migração de credenciais (reset automático por versão)
//  Quando GRO_CONFIG.CRED_VERSION aumenta, cada navegador:
//   • reabilita os usuários padrão que possam ter sido desativados;
//   • descarta senhas/flag de troca sobrescritas localmente (overrides),
//     fazendo valer as senhas definidas em config.js (exceto admin).
// ============================================================
(function migrarCredenciais() {
  try {
    if (typeof GRO_CONFIG === 'undefined') return;
    const KEY = 'gro_cred_version';
    const ver = String(GRO_CONFIG.CRED_VERSION || 0);
    if (localStorage.getItem(KEY) === ver) return;

    // 1) Reabilita TODOS os usuários padrão (remove-os da lista de desativados)
    const dis = GRO_AUTH.getDisabled().filter(
      x => !GRO_CONFIG.USERS.some(u => u.username === x)
    );
    GRO_AUTH.saveDisabled(dis);

    // 2) Limpa overrides de senha/troca dos usuários padrão (menos admin)
    const ov = GRO_AUTH.getOverrides();
    GRO_CONFIG.USERS.forEach(u => {
      if (u.username === 'admin' || !ov[u.username]) return;
      delete ov[u.username].passwordB64;
      delete ov[u.username].mustChangePassword;
      if (Object.keys(ov[u.username]).length === 0) delete ov[u.username];
    });
    GRO_AUTH.saveOverrides(ov);

    localStorage.setItem(KEY, ver);
  } catch (e) { /* silencioso */ }
})();
