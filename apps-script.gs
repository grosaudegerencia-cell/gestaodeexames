// ============================================================
//  GOOGLE APPS SCRIPT — GRO Saúde | Dashboard de Exames
//
//  COMO IMPLANTAR:
//  1. Abra o Google Sheets da sua agenda
//  2. Extensões > Apps Script
//  3. Cole TODO este código substituindo o conteúdo existente
//  4. Clique em Implantar > Nova Implantação
//  5. Tipo: "App da Web"
//  6. Executar como: "Eu (sua conta)"
//  7. Quem pode acessar: "Qualquer pessoa"
//  8. Copie a URL gerada e cole em config.js > SHEETS_URL
// ============================================================

const SHEET_NAME_AGENDA  = 'Agendamentos';
const SHEET_NAME_EXAMES  = 'Exames';

function doGet(e) {
  const action = e.parameter.action || 'list';
  let result;
  try {
    if      (action === 'list')       result = listarAgendamentos();
    else if (action === 'listExames') result = listarExames();
    else if (action === 'stats')      result = getEstatisticas();
    else result = { error: 'Ação desconhecida' };
  } catch(err) {
    result = { error: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let body, result;
  try {
    body = JSON.parse(e.postData.contents);
    const action = body.action;
    if      (action === 'insert') result = inserirAgendamento(body.data);
    else if (action === 'update') result = atualizarStatus(body.id, body.status);
    else if (action === 'delete') result = excluirAgendamento(body.id);
    else if (action === 'insertExame') result = inserirExame(body.data);
    else result = { error: 'Ação desconhecida' };
  } catch(err) {
    result = { error: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ---- AGENDAMENTOS ----

function getAbaAgenda() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba  = ss.getSheetByName(SHEET_NAME_AGENDA);
  if (!aba) {
    aba = ss.insertSheet(SHEET_NAME_AGENDA);
    aba.appendRow(['ID','Data','Hora','Paciente','CPF','Empresa','Tipo','Procedimento','Médico','Status','Observações','CriadoEm']);
    aba.getRange(1,1,1,12).setFontWeight('bold').setBackground('#1a6e3c').setFontColor('white');
  }
  return aba;
}

function listarAgendamentos() {
  const aba  = getAbaAgenda();
  const rows = aba.getDataRange().getValues();
  const [header, ...data] = rows;
  const keys = header.map(h => String(h).toLowerCase().replace(/[^a-z]/g,''));
  const result = data.map(row => {
    const obj = {};
    keys.forEach((k,i) => obj[k] = String(row[i] || ''));
    // normaliza campos esperados pelo site
    return {
      id:        obj['id']         || '',
      data:      obj['data']       || '',
      hora:      obj['hora']       || '',
      paciente:  obj['paciente']   || '',
      cpf:       obj['cpf']        || '',
      empresa:   obj['empresa']    || '',
      tipo:      obj['tipo']       || '',
      descricao: obj['procedimento'] || obj['descricao'] || '',
      medico:    obj['mdico']      || obj['medico'] || '',
      status:    obj['status']     || 'Agendado',
      obs:       obj['observaes']  || obj['obs'] || '',
      criadoEm:  obj['criadoem']   || '',
    };
  }).filter(r => r.id);
  return { success: true, data: result };
}

function inserirAgendamento(d) {
  const aba = getAbaAgenda();
  aba.appendRow([
    d.id, d.data, d.hora, d.paciente, d.cpf,
    d.empresa, d.tipo, d.descricao, d.medico,
    d.status || 'Agendado', d.obs, d.criadoEm
  ]);
  return { success: true };
}

function atualizarStatus(id, novoStatus) {
  const aba  = getAbaAgenda();
  const rows = aba.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(id)) {
      aba.getRange(i+1, 10).setValue(novoStatus);
      return { success: true };
    }
  }
  return { error: 'Registro não encontrado' };
}

function excluirAgendamento(id) {
  const aba  = getAbaAgenda();
  const rows = aba.getDataRange().getValues();
  for (let i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]) === String(id)) {
      aba.deleteRow(i+1);
      return { success: true };
    }
  }
  return { error: 'Registro não encontrado' };
}

// ---- EXAMES (aba histórica) ----

function getAbaExames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba  = ss.getSheetByName(SHEET_NAME_EXAMES);
  if (!aba) {
    aba = ss.insertSheet(SHEET_NAME_EXAMES);
    aba.appendRow(['Data','Tipo','Procedimento','Empresa','Paciente','Status']);
    aba.getRange(1,1,1,6).setFontWeight('bold').setBackground('#1a6e3c').setFontColor('white');
  }
  return aba;
}

function listarExames() {
  const aba  = getAbaExames();
  const rows = aba.getDataRange().getValues();
  const [header, ...data] = rows;
  const result = data.map(row => ({
    data:      row[0] ? Utilities.formatDate(new Date(row[0]), 'America/Sao_Paulo', 'yyyy-MM-dd') : '',
    tipo:      row[1] || '',
    descricao: row[2] || '',
    empresa:   row[3] || '',
    paciente:  row[4] || '',
    status:    row[5] || 'Realizado',
  })).filter(r => r.data);
  return { success: true, data: result };
}

function inserirExame(d) {
  const aba = getAbaExames();
  aba.appendRow([d.data, d.tipo, d.descricao, d.empresa, d.paciente, d.status || 'Realizado']);
  return { success: true };
}

// ============================================================
//  FORMATAÇÃO BONITA — rode uma vez pelo menu Executar > embelezarPlanilha
//  (deixa a planilha com a identidade visual da GRO Saúde)
// ============================================================
function embelezarPlanilha() {
  const VERDE      = '#1a6e3c';
  const VERDE_CLARO= '#eafaf1';
  const VERDE_ESC  = '#1B392A';

  ['Exames', 'Agendamentos'].forEach(nome => {
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
    if (!aba) return;
    const ultCol = aba.getLastColumn() || 6;
    const ultLin = Math.max(aba.getLastRow(), 1);

    // Cabeçalho
    const head = aba.getRange(1, 1, 1, ultCol);
    head.setBackground(VERDE).setFontColor('white').setFontWeight('bold')
        .setFontSize(11).setHorizontalAlignment('center').setVerticalAlignment('middle');
    aba.setRowHeight(1, 34);
    aba.setFrozenRows(1);

    // Corpo: fonte e bordas
    if (ultLin > 1) {
      const corpo = aba.getRange(2, 1, ultLin-1, ultCol);
      corpo.setFontSize(10).setVerticalAlignment('middle');
      // Linhas zebradas
      aba.getRange(1, 1, ultLin, ultCol).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREEN, true, false);
    }

    // Largura das colunas
    aba.autoResizeColumns(1, ultCol);
    for (let c = 1; c <= ultCol; c++) {
      if (aba.getColumnWidth(c) < 110) aba.setColumnWidth(c, 110);
    }

    // Formatação condicional do Status (procura a coluna "Status")
    const headers = aba.getRange(1,1,1,ultCol).getValues()[0];
    const colStatus = headers.indexOf('Status') + 1;
    if (colStatus > 0 && ultLin > 1) {
      const rng = aba.getRange(2, colStatus, ultLin-1, 1);
      const regras = [
        criarRegra(rng, 'Realizado',  '#d5f5e3', '#1a6e3c'),
        criarRegra(rng, 'Agendado',   '#fef9e7', '#b8860b'),
        criarRegra(rng, 'Confirmado', '#dbeafe', '#1d4ed8'),
        criarRegra(rng, 'Cancelado',  '#fdeaea', '#c0392b'),
      ];
      aba.setConditionalFormatRules(regras);
    }
  });

  // Aba de resumo / capa
  criarAbaResumo();
  SpreadsheetApp.getActiveSpreadsheet().toast('Planilha formatada com sucesso!', 'GRO Saúde', 5);
}

function criarRegra(rng, texto, bg, fg) {
  return SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo(texto)
    .setBackground(bg).setFontColor(fg).setBold(true)
    .setRanges([rng]).build();
}

function criarAbaResumo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName('📊 Resumo');
  if (!aba) aba = ss.insertSheet('📊 Resumo', 0);
  aba.clear();
  const st = getEstatisticas();
  aba.getRange('B2').setValue('GRO SAÚDE — RESUMO DE EXAMES')
     .setFontSize(16).setFontWeight('bold').setFontColor('#1B392A');
  aba.getRange('B3').setValue('Gestão de Segurança e Medicina Ocupacional')
     .setFontColor('#2EB45D').setFontWeight('bold');
  const linhas = [
    ['Total de Exames', st.totalExames],
    ['Exames Agendados', st.totalAgendados],
    ['Exames Hoje', st.examesHoje],
  ];
  aba.getRange(5, 2, linhas.length, 2).setValues(linhas);
  aba.getRange(5, 2, linhas.length, 1).setFontWeight('bold').setFontColor('#1a6e3c');
  aba.setColumnWidth(2, 220); aba.setColumnWidth(3, 120);
  aba.setHiddenGridlines(true);
}

// ---- ESTATÍSTICAS ----

function getEstatisticas() {
  const exames = listarExames().data;
  const agenda = listarAgendamentos().data;
  const anoAtual = new Date().getFullYear();

  const porAno  = {};
  const porMes  = {};
  const porTipo = {};
  const porDesc = {};

  exames.forEach(r => {
    if (!r.data) return;
    const d   = new Date(r.data);
    const ano = d.getFullYear();
    const mes = `${ano}-${String(d.getMonth()+1).padStart(2,'0')}`;
    porAno[ano]   = (porAno[ano]  ||0)+1;
    porMes[mes]   = (porMes[mes]  ||0)+1;
    porTipo[r.tipo]     = (porTipo[r.tipo]    ||0)+1;
    porDesc[r.descricao]= (porDesc[r.descricao]||0)+1;
  });

  return {
    success: true,
    totalExames:   exames.length,
    totalAgendados:agenda.filter(r=>r.status==='Agendado').length,
    porAno, porMes, porTipo, porDesc,
    examesHoje: exames.filter(r=>r.data===Utilities.formatDate(new Date(),'America/Sao_Paulo','yyyy-MM-dd')).length,
  };
}
