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
// ============================================================

var EMAIL_RELATORIO = 'e-protecao@hotmail.com';
var HORA_ENVIO      = 17;          // 17h30 = fim de tarde
var MINUTO_ENVIO    = 30;
var ABA_AG          = 'Agendamentos';
var TZ              = 'America/Sao_Paulo';

// ---------- INSTALAÇÃO (rode 1x) ----------
function instalarSistema() {
  getAba();                 // garante a aba e cabeçalho
  embelezarPlanilha();      // formata bonito
  instalarGatilhoDiario();  // agenda o e-mail diário
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Sistema instalado! Relatório diário às ' + HORA_ENVIO + 'h' + MINUTO_ENVIO + ' para ' + EMAIL_RELATORIO,
    'GRO Saúde', 8);
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
    if (action === 'list')       out = { success:true, data: listar() };
    else if (action === 'stats') out = getEstatisticas();
    else if (action === 'enviarAgora') { enviarRelatorioDiario(); out = { success:true, msg:'Relatório enviado' }; }
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
    if (a === 'insert')      out = inserir(d);
    else if (a === 'update') out = atualizar(d);
    else if (a === 'delete') out = excluir(d.id);
    else if (a === 'recuperarSenha') out = enviarCodigoRecuperacao(d);
    else out = { error:'ação desconhecida' };
  } catch(err) { out = { error:String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
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
