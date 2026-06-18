// ============================================================
//  db.js — Camada de dados do Sistema GRO Saúde
//  Persistência local (navegador) de agendamentos, exames e config.
//  Quando o Apps Script estiver configurado, sincroniza com a planilha.
// ============================================================

const GRO_DB = {
  AG_KEY:    'gro_agendamentos',
  PROC_KEY:  'gro_procedimentos_cad',
  TIPOS_KEY: 'gro_tipos_cad',
  CFG_KEY:   'gro_cfg_agenda',

  // ---------- Procedimentos / Exames cadastrados ----------
  PROC_DEFAULT: [
    { nome:'Exame Clínico',          categoria:'Clínico' },
    { nome:'Audiometria',            categoria:'Imagem/Funcional' },
    { nome:'Acuidade Visual',        categoria:'Imagem/Funcional' },
    { nome:'Espirometria',           categoria:'Imagem/Funcional' },
    { nome:'Eletrocardiograma',      categoria:'Imagem/Funcional' },
    { nome:'Eletroencefalograma',    categoria:'Imagem/Funcional' },
    { nome:'Raio-X',                 categoria:'Imagem/Funcional' },
    { nome:'Hemograma',              categoria:'Laboratorial' },
    { nome:'Glicemia',               categoria:'Laboratorial' },
    { nome:'Colesterol',             categoria:'Laboratorial' },
    { nome:'Triglicerídeos',         categoria:'Laboratorial' },
    { nome:'Toxicológico',           categoria:'Laboratorial' },
    { nome:'Colinesterase',          categoria:'Laboratorial' },
    { nome:'Fenol',                  categoria:'Laboratorial' },
    { nome:'VDRL',                   categoria:'Laboratorial' },
    { nome:'Coprocultura',           categoria:'Laboratorial' },
    { nome:'Parasitológico',         categoria:'Laboratorial' },
    { nome:'Avaliação Psicossocial', categoria:'Clínico' },
  ],
  TIPOS_DEFAULT: [
    'ASO Admissional','ASO Periódico','ASO Demissional','ASO Retorno ao Trabalho',
    'ASO Mudança de Riscos','ASO Mudança de Função','Consulta Médica','Coleta Laboratorial',
  ],

  getProcedimentos() {
    try {
      const v = JSON.parse(localStorage.getItem(this.PROC_KEY));
      if (Array.isArray(v) && v.length) return v;
    } catch {}
    this.saveProcedimentos(this.PROC_DEFAULT);
    return [...this.PROC_DEFAULT];
  },
  saveProcedimentos(list) { localStorage.setItem(this.PROC_KEY, JSON.stringify(list)); },
  addProcedimento(nome, categoria) {
    nome = (nome||'').trim();
    if (!nome) return { ok:false, msg:'Informe o nome do exame.' };
    const list = this.getProcedimentos();
    if (list.some(p => p.nome.toLowerCase() === nome.toLowerCase()))
      return { ok:false, msg:'Esse exame já está cadastrado.' };
    const novo = { nome, categoria: categoria||'Outros' };
    list.push(novo);
    list.sort((a,b)=>a.nome.localeCompare(b.nome));
    this.saveProcedimentos(list);
    this._syncSheets('saveProcedimento', novo);
    return { ok:true };
  },
  removeProcedimento(nome) {
    this.saveProcedimentos(this.getProcedimentos().filter(p => p.nome !== nome));
    this._syncSheets('deleteProcedimento', { nome });
    return { ok:true };
  },

  getTipos() {
    try {
      const v = JSON.parse(localStorage.getItem(this.TIPOS_KEY));
      if (Array.isArray(v) && v.length) return v;
    } catch {}
    this.saveTipos(this.TIPOS_DEFAULT);
    return [...this.TIPOS_DEFAULT];
  },
  saveTipos(list) { localStorage.setItem(this.TIPOS_KEY, JSON.stringify(list)); },
  addTipo(nome) {
    nome = (nome||'').trim();
    if (!nome) return { ok:false, msg:'Informe o tipo de exame.' };
    const list = this.getTipos();
    if (list.some(t => t.toLowerCase() === nome.toLowerCase()))
      return { ok:false, msg:'Esse tipo já está cadastrado.' };
    list.push(nome); list.sort();
    this.saveTipos(list);
    this._syncSheets('saveTipo', { nome });
    return { ok:true };
  },
  removeTipo(nome) {
    this.saveTipos(this.getTipos().filter(t => t !== nome));
    this._syncSheets('deleteTipo', { nome });
    return { ok:true };
  },

  // ---------- Configuração da Agenda ----------
  CFG_DEFAULT: { inicio:'07:00', fim:'17:00', intervalo:5, almocoIni:'', almocoFim:'' },
  getConfigAgenda() {
    try { return { ...this.CFG_DEFAULT, ...(JSON.parse(localStorage.getItem(this.CFG_KEY))||{}) }; }
    catch { return { ...this.CFG_DEFAULT }; }
  },
  setConfigAgenda(cfg) {
    localStorage.setItem(this.CFG_KEY, JSON.stringify(cfg));
    this._syncSheets('saveConfig', cfg);
  },

  // ---------- Empresas (cache sincronizado) ----------
  EMP_KEY: 'gro_empresas_cad',
  getEmpresas() {
    try { return JSON.parse(localStorage.getItem(this.EMP_KEY)) || []; } catch { return []; }
  },
  addEmpresa(nome) {
    nome = (nome||'').trim();
    if (!nome) return;
    const list = this.getEmpresas();
    if (list.some(e => e.toLowerCase() === nome.toLowerCase())) return;
    list.push(nome); list.sort();
    localStorage.setItem(this.EMP_KEY, JSON.stringify(list));
    this._syncSheets('saveEmpresa', { nome });
  },

  // Gera os horários (slots) de um dia conforme config
  gerarSlots() {
    const c = this.getConfigAgenda();
    const [hi, mi] = c.inicio.split(':').map(Number);
    const [hf, mf] = c.fim.split(':').map(Number);
    const ini = hi*60+mi, fim = hf*60+mf, step = c.intervalo||5;
    const slots = [];
    for (let m = ini; m < fim; m += step) {
      const hh = String(Math.floor(m/60)).padStart(2,'0');
      const mm = String(m%60).padStart(2,'0');
      const hora = `${hh}:${mm}`;
      const almoco = c.almocoIni && c.almocoFim && hora >= c.almocoIni && hora < c.almocoFim;
      slots.push({ hora, almoco });
    }
    return slots;
  },

  // ---------- Agendamentos ----------
  getAgendamentos() {
    try { return JSON.parse(localStorage.getItem(this.AG_KEY)) || []; } catch { return []; }
  },
  saveAgendamentos(list) { localStorage.setItem(this.AG_KEY, JSON.stringify(list)); },
  getPorData(data) {
    return this.getAgendamentos().filter(a => a.data === data);
  },
  getSlot(data, hora) {
    return this.getAgendamentos().find(a => a.data === data && a.hora === hora);
  },
  addAgendamento(reg) {
    const list = this.getAgendamentos();
    reg.id = reg.id || ('ag_' + Date.now() + '_' + Math.floor(Math.random()*999));
    reg.criadoEm = new Date().toISOString();
    list.push(reg);
    this.saveAgendamentos(list);
    this._syncSheets('insert', reg);
    if (reg.empresa) this.addEmpresa(reg.empresa);   // mantém lista de empresas
    return reg;
  },
  updateAgendamento(id, patch) {
    const list = this.getAgendamentos().map(a => a.id === id ? { ...a, ...patch } : a);
    this.saveAgendamentos(list);
    const reg = list.find(a => a.id === id);
    this._syncSheets('update', reg);
    return reg;
  },
  removeAgendamento(id) {
    this.saveAgendamentos(this.getAgendamentos().filter(a => a.id !== id));
    this._syncSheets('delete', { id });
    return { ok:true };
  },

  // Envia uma alteração para a planilha (usa a camada de sync se disponível)
  _syncSheets(action, data) {
    if (typeof GRO_SYNC !== 'undefined' && GRO_SYNC.ativo()) { GRO_SYNC.enviar(action, data); return; }
    if (typeof GRO_CONFIG === 'undefined' || !GRO_CONFIG.SHEETS_URL) return;
    try {
      fetch(GRO_CONFIG.SHEETS_URL, {
        method:'POST', mode:'no-cors',
        headers:{ 'Content-Type':'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, data })
      });
    } catch {}
  },

  // Estatísticas rápidas de um dia
  statsDia(data) {
    const ags = this.getPorData(data).filter(a => a.status !== 'Cancelado');
    const slots = this.gerarSlots().filter(s => !s.almoco).length;
    return { ocupadas: ags.length, livres: Math.max(slots - ags.length, 0), total: slots };
  }
};

// ============================================================
//  Migração da configuração da agenda (intervalo 5 min, sem almoço)
//  Ajusta automaticamente qualquer configuração já salva no navegador:
//  força vagas de 5 em 5 minutos e libera o horário de almoço.
// ============================================================
(function migrarConfigAgenda() {
  try {
    const KEY = 'gro_cfg_version';
    const VER = '2';                       // aumente este número para reaplicar
    if (localStorage.getItem(KEY) === VER) return;
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem(GRO_DB.CFG_KEY)) || {}; } catch {}
    cfg.intervalo = 5;                     // vagas de 5 em 5 minutos
    cfg.almocoIni = '';                    // sem bloqueio de almoço
    cfg.almocoFim = '';
    localStorage.setItem(GRO_DB.CFG_KEY, JSON.stringify(cfg));
    if (typeof GRO_SYNC !== 'undefined' && GRO_SYNC.ativo()) {
      try { GRO_SYNC.enviar('saveConfig', cfg); } catch {}   // propaga p/ a planilha
    }
    localStorage.setItem(KEY, VER);
  } catch (e) { /* silencioso */ }
})();
