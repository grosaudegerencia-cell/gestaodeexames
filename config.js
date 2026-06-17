// ============================================================
//  config.js — Configurações da GRO Saúde
// ============================================================

const GRO_CONFIG = {

  // ============================================================
  //  GOOGLE SHEETS — Planilha de Base de Exames (Dashboard)
  // ============================================================
  //  Planilha principal de histórico de exames (Google Drive GRO Saúde):
  //  "GRO Saúde — Base de Exames e Agendamentos"
  //  https://docs.google.com/spreadsheets/d/1mK15eeIsEmLEhoRB4ZqbcUhEK66OipKGFZqFOCVGRZk/edit
  //
  //  Colunas: Data | Tipo | Procedimento | Empresa | Paciente | Status
  //
  //  Para sincronização ao vivo:
  //   1. Abra a planilha e vá em Arquivo → Compartilhar → "Qualquer pessoa com o link"
  //   2. Publique: Arquivo → Publicar na web → CSV
  //   3. Mude USAR_SHEETS para true abaixo
  // ============================================================
  SHEET_ID:          '1mK15eeIsEmLEhoRB4ZqbcUhEK66OipKGFZqFOCVGRZk',
  SHEET_ABA:         'Planilha1',
  SHEET_ABA_AGENDA:  'Agendamentos',
  USAR_SHEETS:       false,   // mude para true após publicar a planilha no Google Sheets

  // E-mail que recebe o relatório diário (configurado no apps-script.gs)
  EMAIL_RELATORIO:   'e-protecao@hotmail.com',

  // ============================================================
  //  GRAVAÇÃO AUTOMÁTICA (Agenda do site -> planilha do sistema)
  // ============================================================
  //  Depois de publicar o Apps Script como "App da Web" (veja as
  //  instruções no início do arquivo apps-script.gs), cole aqui a
  //  URL gerada. A partir daí, cada vaga agendada na Agenda é
  //  gravada na planilha automaticamente.
  // ============================================================
  SHEETS_URL: 'https://script.google.com/macros/s/AKfycbwLZ6_Fv7OS8LVdj_yOszJhrlXGXltCo04AxVeA4etLixuFVf07EL2wVWYtn4BGgdkz/exec',

  // ============================================================
  //  USUÁRIOS DO SISTEMA
  // ============================================================
  //  Estes são os usuários padrão (sempre disponíveis).
  //  O admin pode criar/remover usuários adicionais pela tela
  //  "Gerenciar Usuários" (ficam salvos no navegador).
  //  Senhas em Base64 — gere em btoa('senha') no console (F12).
  USERS: [
    { username: 'admin',    passwordB64: 'Z3JvQDIwMjY=',     role: 'admin',  name: 'Administrador GRO', fixo: true },
    { username: 'recepcao', passwordB64: 'cmVjZXBAMjAyNg==', role: 'user',   name: 'Recepção GRO',      fixo: true },
    { username: 'medico',   passwordB64: 'bWVkQDIwMjY=',     role: 'medico', name: 'Médico',            fixo: true },
  ],

  CLINICA: {
    nome:   'GRO Saúde',
    slogan: 'Gestão de Segurança e Medicina Ocupacional',
  }
};

// URL pública de leitura da planilha (CSV via gviz) — montada automaticamente
GRO_CONFIG.getSheetCsvUrl = function(aba) {
  const nome = aba || this.SHEET_ABA;
  return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nome)}`;
};
GRO_CONFIG.getSheetEditUrl = function() {
  return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/edit`;
};
