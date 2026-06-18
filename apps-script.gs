// ============================================================
//  GOOGLE APPS SCRIPT — Sistema GRO Saúde
//  Backend da planilha: grava agendamentos do site, serve os
//  dados e ENVIA RELATÓRIO DIÁRIO por e-mail toda tarde.
//
//  ░░ COMO INSTALAR (uma única vez) ░░
//  1. Abra a planilha "Sistema GRO Saúde — Agendamentos"
//  2. Menu Extensões > Apps Script
//  3. Apague o conteúdo e cole TODO este arquivo
//  4. Salve (ícone de disquete)
//  5. No seletor de função, escolha  instalarSistema  e clique em ▶ Executar
//     -> Autorize as permissões quando solicitado (planilha + e-mail)
//     Isso cria as abas e agenda o e-mail diário automaticamente.
//  6. Clique em  Implantar > Nova implantação > tipo "App da Web"
//       - Executar como: Eu
//       - Quem pode acessar: Qualquer pessoa
//     Copie a URL gerada e cole em config.js  ->  SHEETS_URL
//
//  ░░ BASE HISTÓRICA AUTOMÁTICA ░░
//  A função  importarBaseDoSite  lê o data.js publicado no site e regrava a
//  aba "BaseExames" com TODOS os registros. Roda sozinha toda madrugada (4h)
//  e também pode ser executada na mão (selecione importarBaseDoSite e ▶ Executar)
//  ou pela URL:  SHEETS_URL?action=importarBase
// ============================================================

var EMAIL_RELATORIO = 'e-protecao@hotmail.com';
var HORA_ENVIO      = 17;          // 17h30 = fim de tarde
var MINUTO_ENVIO    = 30;
var ABA_AG          = 'Agendamentos';
var TZ              = 'America/Sao_Paulo';

// Abas de cada entidade do sistema + seus cabeçalhos
var TAB_USER = 'Usuarios';
var TAB_PROC = 'Procedimentos';
var TAB_TIPO = 'Tipos';
var TAB_EMP  = 'Empresas';
var TAB_CFG  = 'ConfigAgenda';
var TAB_BASE = 'BaseExames';     // base histórica completa (espelho do data.js)
var HEAD_BASE = ['Data','Tipo','Procedimento','Empresa','Paciente','Status'];

// Endereço do data.js publicado no GitHub Pages (fonte da base histórica)
var SITE_DATA_URL = 'https://grosaudegerencia-cell.github.io/gestaodeexames/data.js';
var HORA_SYNC_BASE = 4;          // sincroniza a base toda madrugada (4h)
var HEAD_USER = ['username','passwordB64','role','name','email','mustChangePassword'];
var HEAD_PROC = ['nome','categoria'];
var HEAD_CFG  = ['inicio','fim','intervalo','almocoIni','almocoFim'];

// ---------- INSTALAÇÃO (rode 1x) ----------
function instalarSistema() {
  getAba();                 // aba de agendamentos
  ensureSheet(TAB_USER, HEAD_USER);
  ensureSheet(TAB_PROC, HEAD_PROC);
  ensureSheet(TAB_TIPO, ['nome']);
  ensureSheet(TAB_EMP,  ['nome']);
  ensureSheet(TAB_CFG,  HEAD_CFG);
  ensureSheet(TAB_BASE, HEAD_BASE);
  embelezarPlanilha();      // formata bonito
  instalarGatilhoDiario();  // agenda o e-mail diário
  instalarSyncBaseDiario(); // agenda a sincronização da base histórica
  try { importarBaseDoSite(); } catch(e) {}   // já popula a base na instalação
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Sistema instalado! Abas criadas + relatório diário às ' + HORA_ENVIO + 'h' + MINUTO_ENVIO +
    ' + base histórica sincronizada do site.',
    'GRO Saúde', 8);
}

// ---------- SINCRONIZAÇÃO DA BASE HISTÓRICA (data.js -> planilha) ----------
//  Lê o data.js publicado no GitHub Pages e regrava a aba "BaseExames"
//  com TODOS os registros (Data | Tipo | Procedimento | Empresa | Paciente | Status).
//  Pode ser executada manualmente (▶ Executar) ou pelo gatilho diário.
function importarBaseDoSite() {
  var raw = UrlFetchApp.fetch(SITE_DATA_URL, { muteHttpExceptions:true, followRedirects:true }).getContentText();
  var ini = raw.indexOf('[');
  var fim = raw.lastIndexOf(']');
  if (ini < 0 || fim < 0) throw new Error('data.js sem array de registros');
  var body = raw.substring(ini, fim + 1);
  body = body.replace(/\/\/[^\n]*/g, '');                 // remove comentários //
  body = body.replace(/([a-zA-Z_]\w*)\s*:/g, '"$1":');    // coloca aspas nas chaves
  body = body.replace(/,\s*]/g, ']');                     // remove vírgula final
  var arr = JSON.parse(body);

  var aba = ensureSheet(TAB_BASE, HEAD_BASE);
  aba.clearContents();
  aba.getRange(1, 1, 1, HEAD_BASE.length).setValues([HEAD_BASE]);
  var linhas = arr.map(function(r){
    return [r.data, r.tipo, r.descricao, r.empresa, r.paciente, r.status];
  });
  if (linhas.length) aba.getRange(2, 1, linhas.length, HEAD_BASE.length).setValues(linhas);

  // formatação do cabeçalho
  aba.getRange(1,1,1,HEAD_BASE.length).setBackground('#1a6e3c').setFontColor('white')
     .setFontWeight('bold').setHorizontalAlignment('center');
  aba.setFrozenRows(1);
  return { success:true, registros:linhas.length };
}

function instalarSyncBaseDiario() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'importarBaseDoSite') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('importarBaseDoSite')
    .timeBased().everyDays(1).atHour(HORA_SYNC_BASE).inTimezone(TZ).create();
}

// Garante que uma aba exista com o cabeçalho informado
function ensureSheet(nome, head) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(nome);
  if (!aba) { aba = ss.insertSheet(nome); aba.appendRow(head); }
  else if (aba.getLastRow() === 0) { aba.appendRow(head); }
  return aba;
}

function instalarGatilhoDiario() {
  // remove gatilhos antigos do relatório
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'enviarRelatorioDiario') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarRelatorioDiario')
    .timeBased().everyDays(1).atHour(HORA_ENVIO).nearMinute(MINUTO_ENVIO).inTimezone(TZ).create();
}

// ---------- WEB APP (site <-> planilha) ----------
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'list';
  var out;
  try {
    if (action === 'getAll')     out = getAll();
    else if (action === 'list')  out = { success:true, data: listar() };
    else if (action === 'stats') out = getEstatisticas();
    else if (action === 'enviarAgora') { enviarRelatorioDiario(); out = { success:true, msg:'Relatório enviado' }; }
    else if (action === 'importarBase') out = importarBaseDoSite();
    else out = { error:'ação desconhecida' };
  } catch(err) { out = { error:String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents);
    var a = body.action;
    var d = body.data || {};
    // ----- Agendamentos -----
    if (a === 'insert')             out = inserir(d);
    else if (a === 'update')        out = atualizar(d);
    else if (a === 'delete')        out = excluir(d.id);
    // ----- Usuários -----
    else if (a === 'saveUsuario')   out = saveUsuario(d);
    else if (a === 'deleteUsuario') out = deleteUsuario(d.username);
    // ----- Procedimentos / Exames -----
    else if (a === 'saveProcedimento')   out = saveProcedimento(d);
    else if (a === 'deleteProcedimento') out = deleteByName(TAB_PROC, d.nome);
    // ----- Tipos de exame -----
    else if (a === 'saveTipo')      out = saveName(TAB_TIPO, d.nome);
    else if (a === 'deleteTipo')    out = deleteByName(TAB_TIPO, d.nome);
    // ----- Empresas -----
    else if (a === 'saveEmpresa')   out = saveName(TAB_EMP, d.nome);
    else if (a === 'deleteEmpresa') out = deleteByName(TAB_EMP, d.nome);
    // ----- Configuração da agenda -----
    else if (a === 'saveConfig')    out = saveConfig(d);
    // ----- Recuperação de senha -----
    else if (a === 'recuperarSenha') out = enviarCodigoRecuperacao(d);
    else out = { error:'ação desconhecida' };
  } catch(err) { out = { error:String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- LEITURA AGREGADA (1 chamada traz tudo) ----------
function getAll() {
  return {
    success: true,
    agendamentos:  listar(),
    usuarios:      listUsuarios(),
    procedimentos: listProcedimentos(),
    tipos:         listNames(TAB_TIPO),
    empresas:      listNames(TAB_EMP),
    config:        getConfig()
  };
}

// ---------- USUÁRIOS ----------
function listUsuarios() {
  var aba = ensureSheet(TAB_USER, HEAD_USER);
  var v = aba.getDataRange().getValues(); var res = [];
  for (var i=1;i<v.length;i++) {
    if (!v[i][0]) continue;
    res.push({
      username:String(v[i][0]), passwordB64:String(v[i][1]), role:String(v[i][2]),
      name:String(v[i][3]), email:String(v[i][4]),
      mustChangePassword: (String(v[i][5])==='true' || v[i][5]===true), fixo:false
    });
  }
  return res;
}
function saveUsuario(d) {
  if (!d || !d.username) return { error:'username obrigatório' };
  var aba = ensureSheet(TAB_USER, HEAD_USER);
  var v = aba.getDataRange().getValues();
  var row = [d.username, d.passwordB64||'', d.role||'user', d.name||'', d.email||'', d.mustChangePassword?true:false];
  for (var i=1;i<v.length;i++) if (String(v[i][0])===String(d.username)) {
    aba.getRange(i+1,1,1,HEAD_USER.length).setValues([row]); return { success:true, updated:true };
  }
  aba.appendRow(row); return { success:true, created:true };
}
function deleteUsuario(username) {
  var aba = ensureSheet(TAB_USER, HEAD_USER); var v = aba.getDataRange().getValues();
  for (var i=v.length-1;i>=1;i--) if (String(v[i][0])===String(username)) { aba.deleteRow(i+1); return {success:true}; }
  return { success:true, naoExistia:true };
}

// ---------- PROCEDIMENTOS (nome + categoria) ----------
function listProcedimentos() {
  var aba = ensureSheet(TAB_PROC, HEAD_PROC);
  var v = aba.getDataRange().getValues(); var res = [];
  for (var i=1;i<v.length;i++) if (v[i][0]) res.push({ nome:String(v[i][0]), categoria:String(v[i][1]||'Outros') });
  return res;
}
function saveProcedimento(d) {
  if (!d || !d.nome) return { error:'nome obrigatório' };
  var aba = ensureSheet(TAB_PROC, HEAD_PROC); var v = aba.getDataRange().getValues();
  for (var i=1;i<v.length;i++) if (String(v[i][0]).toLowerCase()===String(d.nome).toLowerCase()) {
    aba.getRange(i+1,1,1,2).setValues([[d.nome, d.categoria||'Outros']]); return { success:true, updated:true };
  }
  aba.appendRow([d.nome, d.categoria||'Outros']); return { success:true, created:true };
}

// ---------- LISTAS SIMPLES (só "nome": Tipos, Empresas) ----------
function listNames(tab) {
  var aba = ensureSheet(tab, ['nome']); var v = aba.getDataRange().getValues(); var res = [];
  for (var i=1;i<v.length;i++) if (v[i][0]) res.push(String(v[i][0]));
  return res;
}
function saveName(tab, nome) {
  if (!nome) return { error:'nome obrigatório' };
  var aba = ensureSheet(tab, ['nome']); var v = aba.getDataRange().getValues();
  for (var i=1;i<v.length;i++) if (String(v[i][0]).toLowerCase()===String(nome).toLowerCase()) return { success:true, jaExistia:true };
  aba.appendRow([nome]); return { success:true, created:true };
}
function deleteByName(tab, nome) {
  var aba = ensureSheet(tab, ['nome']); var v = aba.getDataRange().getValues();
  for (var i=v.length-1;i>=1;i--) if (String(v[i][0])===String(nome)) { aba.deleteRow(i+1); return {success:true}; }
  return { success:true, naoExistia:true };
}

// ---------- CONFIG DA AGENDA ----------
function getConfig() {
  var aba = ensureSheet(TAB_CFG, HEAD_CFG); var v = aba.getDataRange().getValues();
  if (v.length < 2) return null;
  return { inicio:String(v[1][0]||'07:00'), fim:String(v[1][1]||'17:00'),
           intervalo:Number(v[1][2]||5), almocoIni:String(v[1][3]||''), almocoFim:String(v[1][4]||'') };
}
function saveConfig(d) {
  var aba = ensureSheet(TAB_CFG, HEAD_CFG);
  var row = [d.inicio||'07:00', d.fim||'17:00', d.intervalo||5, d.almocoIni||'', d.almocoFim||''];
  if (aba.getLastRow() < 2) aba.appendRow(row);
  else aba.getRange(2,1,1,HEAD_CFG.length).setValues([row]);
  return { success:true };
}

function getAba() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var aba = ss.getSheetByName(ABA_AG);
  if (!aba) {
    aba = ss.insertSheet(ABA_AG);
    aba.appendRow(['ID','Data','Hora','Paciente','CPF','Empresa','Tipo','Procedimentos','Médico','Status','Observações','CriadoEm']);
  }
  return aba;
}

function listar() {
  var aba = getAba();
  var v = aba.getDataRange().getValues();
  var res = [];
  for (var i=1;i<v.length;i++) {
    if (!v[i][0]) continue;
    res.push({
      id:String(v[i][0]), data:fmtData(v[i][1]), hora:String(v[i][2]), paciente:String(v[i][3]),
      cpf:String(v[i][4]), empresa:String(v[i][5]), tipo:String(v[i][6]),
      procedimentos:String(v[i][7]).split(';').map(function(s){return s.trim();}).filter(String),
      medico:String(v[i][8]), status:String(v[i][9]), obs:String(v[i][10])
    });
  }
  return res;
}

function fmtData(x) {
  if (x instanceof Date) return Utilities.formatDate(x, TZ, 'yyyy-MM-dd');
  return String(x);
}

function inserir(d) {
  var aba = getAba();
  aba.appendRow([d.id||('ag_'+Date.now()), d.data, d.hora, d.paciente, d.cpf, d.empresa,
    d.tipo, (d.procedimentos||[]).join('; '), d.medico, d.status, d.obs, d.criadoEm||new Date().toISOString()]);
  if (d.empresa) try { saveName(TAB_EMP, d.empresa); } catch(e) {}  // registra empresa nova
  return { success:true };
}

function atualizar(d) {
  var aba = getAba(); var v = aba.getDataRange().getValues();
  for (var i=1;i<v.length;i++) if (String(v[i][0])===String(d.id)) {
    aba.getRange(i+1,1,1,12).setValues([[d.id,d.data,d.hora,d.paciente,d.cpf,d.empresa,
      d.tipo,(d.procedimentos||[]).join('; '),d.medico,d.status,d.obs,v[i][11]||'']]);
    return { success:true };
  }
  return inserir(d);
}

function excluir(id) {
  var aba = getAba(); var v = aba.getDataRange().getValues();
  for (var i=v.length-1;i>=1;i--) if (String(v[i][0])===String(id)) { aba.deleteRow(i+1); return {success:true}; }
  return { error:'não encontrado' };
}

// ---------- RECUPERAÇÃO DE SENHA (envio de código por e-mail) ----------
function enviarCodigoRecuperacao(d) {
  if (!d || !d.to || !d.code) return { error:'dados incompletos' };
  var nome = d.nome || 'usuário';
  var code = String(d.code);
  var html =
  '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1B392A">'+
    '<div style="background:linear-gradient(135deg,#1B392A,#16A94A);color:#fff;padding:22px 24px;border-radius:12px 12px 0 0">'+
      '<h2 style="margin:0">GRO Saúde — Recuperação de Senha</h2>'+
      '<p style="margin:4px 0 0;opacity:.85">Gestão de Segurança e Medicina Ocupacional</p>'+
    '</div>'+
    '<div style="border:1px solid #e3efe8;border-top:none;padding:26px;border-radius:0 0 12px 12px">'+
      '<p>Olá, <b>'+nome+'</b>.</p>'+
      '<p>Recebemos uma solicitação para redefinir a senha de acesso ao Sistema GRO Saúde. Use o código abaixo para criar uma nova senha:</p>'+
      '<div style="text-align:center;margin:24px 0">'+
        '<div style="display:inline-block;background:#eafaf1;border:2px dashed #16A94A;border-radius:12px;padding:16px 32px;font-size:34px;font-weight:800;letter-spacing:8px;color:#1a6e3c">'+code+'</div>'+
      '</div>'+
      '<p style="color:#7f9e8a;font-size:13px">Este código expira em <b>15 minutos</b>. Se você não solicitou a recuperação, ignore este e-mail — sua senha permanece a mesma.</p>'+
      '<p style="margin-top:22px;font-size:12px;color:#9db3a4">E-mail automático do Sistema GRO Saúde.</p>'+
    '</div>'+
  '</div>';
  MailApp.sendEmail({ to:d.to, subject:'GRO Saúde — Código de recuperação de senha: '+code, htmlBody:html });
  return { success:true };
}

// ---------- RELATÓRIO DIÁRIO POR E-MAIL ----------
function enviarRelatorioDiario() {
  var hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var todos = listar();
  var doDia = todos.filter(function(r){ return r.data === hoje; });

  var porStatus = {}, porTipo = {}, totProc = 0;
  doDia.forEach(function(r){
    porStatus[r.status] = (porStatus[r.status]||0)+1;
    porTipo[r.tipo] = (porTipo[r.tipo]||0)+1;
    totProc += (r.procedimentos||[]).length;
  });

  var dataBR = Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy');
  var realizados = porStatus['Realizado']||0;
  var agendados  = (porStatus['Agendado']||0)+(porStatus['Confirmado']||0);
  var faltas     = porStatus['Faltou']||0;

  var linhas = doDia.sort(function(a,b){return a.hora<b.hora?-1:1;}).map(function(r){
    return '<tr>'+
      '<td style="padding:6px 10px;border-bottom:1px solid #e3efe8">'+r.hora+'</td>'+
      '<td style="padding:6px 10px;border-bottom:1px solid #e3efe8">'+r.paciente+'</td>'+
      '<td style="padding:6px 10px;border-bottom:1px solid #e3efe8">'+r.empresa+'</td>'+
      '<td style="padding:6px 10px;border-bottom:1px solid #e3efe8">'+r.tipo+'</td>'+
      '<td style="padding:6px 10px;border-bottom:1px solid #e3efe8">'+(r.procedimentos||[]).join(', ')+'</td>'+
      '<td style="padding:6px 10px;border-bottom:1px solid #e3efe8">'+r.status+'</td></tr>';
  }).join('');

  var tipoLinhas = Object.keys(porTipo).map(function(k){
    return '<li>'+k+': <b>'+porTipo[k]+'</b></li>';
  }).join('');

  var html =
  '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#1B392A">'+
    '<div style="background:linear-gradient(135deg,#1B392A,#16A94A);color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">'+
      '<h2 style="margin:0">GRO Saúde — Relatório do Dia</h2>'+
      '<p style="margin:4px 0 0;opacity:.85">'+dataBR+' · Gestão de Segurança e Medicina Ocupacional</p>'+
    '</div>'+
    '<div style="border:1px solid #e3efe8;border-top:none;padding:24px;border-radius:0 0 12px 12px">'+
      '<table style="width:100%;border-collapse:collapse;margin-bottom:18px"><tr>'+
        card('Atendimentos', doDia.length, '#16A94A')+
        card('Realizados', realizados, '#2980b9')+
        card('Agendados', agendados, '#f39c12')+
        card('Faltas', faltas, '#e74c3c')+
      '</tr></table>'+
      '<p style="margin:0 0 6px"><b>Total de exames/procedimentos no dia:</b> '+totProc+'</p>'+
      '<p style="margin:14px 0 6px"><b>Por tipo de exame:</b></p><ul style="margin:0 0 16px">'+(tipoLinhas||'<li>—</li>')+'</ul>'+
      '<h3 style="margin:18px 0 8px;color:#1a6e3c">Detalhamento</h3>'+
      (doDia.length ?
      '<table style="width:100%;border-collapse:collapse;font-size:13px">'+
        '<tr style="background:#1B392A;color:#fff;text-align:left">'+
          '<th style="padding:8px 10px">Hora</th><th style="padding:8px 10px">Paciente</th>'+
          '<th style="padding:8px 10px">Empresa</th><th style="padding:8px 10px">Tipo</th>'+
          '<th style="padding:8px 10px">Procedimentos</th><th style="padding:8px 10px">Status</th></tr>'+
        linhas+'</table>'
      : '<p style="color:#7f9e8a;font-style:italic">Nenhum atendimento registrado para hoje.</p>')+
      '<p style="margin-top:22px;font-size:12px;color:#9db3a4">E-mail automático do Sistema GRO Saúde · enviado às '+HORA_ENVIO+'h'+MINUTO_ENVIO+'.</p>'+
    '</div>'+
  '</div>';

  MailApp.sendEmail({
    to: EMAIL_RELATORIO,
    subject: 'GRO Saúde — Relatório do dia '+dataBR+' ('+doDia.length+' atendimentos)',
    htmlBody: html
  });
}

function card(label, valor, cor) {
  return '<td style="width:25%;text-align:center;padding:6px">'+
    '<div style="border:1px solid #e3efe8;border-top:3px solid '+cor+';border-radius:8px;padding:12px 6px">'+
      '<div style="font-size:26px;font-weight:800;color:'+cor+'">'+valor+'</div>'+
      '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#7f9e8a">'+label+'</div>'+
    '</div></td>';
}

// ---------- ESTATÍSTICAS ----------
function getEstatisticas() {
  var todos = listar();
  var hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  return { success:true, total:todos.length,
    hoje: todos.filter(function(r){return r.data===hoje;}).length };
}

// ---------- FORMATAÇÃO ----------
function embelezarPlanilha() {
  var aba = getAba();
  var nc = 12, nl = Math.max(aba.getLastRow(),1);
  aba.getRange(1,1,1,nc).setBackground('#1a6e3c').setFontColor('white').setFontWeight('bold')
     .setHorizontalAlignment('center');
  aba.setFrozenRows(1); aba.setRowHeight(1,32);
  if (nl>1) aba.getRange(1,1,nl,nc).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREEN, true, false);
  for (var c=1;c<=nc;c++){ aba.autoResizeColumn(c); if (aba.getColumnWidth(c)<90) aba.setColumnWidth(c,90); }
  // cores por status
  var colStatus = 10;
  if (nl>1) {
    var rng = aba.getRange(2,colStatus,nl-1,1);
    aba.setConditionalFormatRules([
      regra(rng,'Realizado','#d5f5e3','#1a6e3c'),
      regra(rng,'Agendado','#fef9e7','#b8860b'),
      regra(rng,'Confirmado','#dbeafe','#1d4ed8'),
      regra(rng,'Faltou','#fdeaea','#c0392b'),
      regra(rng,'Cancelado','#f1f1f1','#666')
    ]);
  }
}
function regra(rng,txt,bg,fg){
  return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(txt)
    .setBackground(bg).setFontColor(fg).setBold(true).setRanges([rng]).build();
}
