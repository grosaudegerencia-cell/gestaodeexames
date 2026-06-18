// ============================================================
//  nav.js — Barra de navegação do Sistema GRO Saúde
//  Injeta o cabeçalho + menu em todas as telas.
//  Uso: <body><div id="gro-header" data-page="agenda"></div>...
// ============================================================

(function () {
  const LOGO = 'logo.png';
  const MENU = [
    { id:'dashboard',  href:'index.html',     label:'Dashboard',        icon:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
    { id:'agenda',     href:'agenda.html',    label:'Agenda',           icon:'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { id:'cadastros',  href:'cadastros.html', label:'Cadastrar Exames', icon:'M12 6v6m0 0v6m0-6h6m-6 0H6', adminOnly:true },
    { id:'usuarios',   href:'usuarios.html',  label:'Usuários',         icon:'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', adminOnly:true },
  ];

  function render() {
    const mount = document.getElementById('gro-header');
    if (!mount) return;
    const page = mount.dataset.page || '';
    const user = (typeof GRO_AUTH !== 'undefined') ? GRO_AUTH.getUser() : null;
    const isAdmin = user && user.role === 'admin';

    const itens = MENU.filter(m => !m.adminOnly || isAdmin).map(m => `
      <a href="${m.href}" class="gro-nav-item ${m.id===page?'active':''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${m.icon}"/></svg>
        <span>${m.label}</span>
      </a>`).join('');

    mount.innerHTML = `
      <header class="gro-topbar">
        <div class="gro-topbar-inner">
          <div class="gro-brand">
            <img src="${LOGO}" alt="GRO Saúde" class="gro-logo"/>
            <div class="gro-brand-text">
              <span class="gro-brand-name">GRO Saúde</span>
              <span class="gro-brand-sub">Sistema de Gestão de Exames</span>
            </div>
          </div>
          <div class="gro-user">
            ${user ? `<span class="gro-user-name">${user.name}</span>` : ''}
            <button class="gro-logout" onclick="GRO_AUTH.logout()" title="Sair">Sair</button>
          </div>
        </div>
        <nav class="gro-nav">${itens}</nav>
      </header>`;
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', render);
  else render();
})();
