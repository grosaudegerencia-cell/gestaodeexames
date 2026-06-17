// ============================================================
//  config.js — Configurações da GRO Saúde
// ============================================================

const GRO_CONFIG = {

  // ============================================================
  //  GOOGLE SHEETS — Planilha de Exames e Agendamentos
  // ============================================================
  //  Planilha criada automaticamente no Drive da GRO Saúde:
  //  "GRO Saúde — Base de Exames e Agendamentos"
  //
  //  PARA O SITE LER A PLANILHA (somente leitura, mais fácil):
  //  1. Abra a planilha no Google Sheets
  //  2. Clique em "Compartilhar" (botão azul, canto superior direito)
  //  3. Em "Acesso geral", mude para "Qualquer pessoa com o link"
  //  4. Permissão: "Leitor" > Concluir
  //  Pronto! O dashboard lê os dados da aba abaixo automaticamente.
  // ============================================================
  SHEET_ID:   '1mK15eeIsEmLEhoRB4ZqbcUhEK66OipKGFZqFOCVGRZk',
  SHEET_ABA:  'Exames',          // nome da aba com os dados históricos
  SHEET_ABA_AGENDA: 'Agendamentos',
  USAR_SHEETS: true,             // true = lê da planilha; false = usa data.js

  // ============================================================
  //  ESCRITA BIDIRECIONAL (Agendamentos site -> planilha)
  // ============================================================
  //  Para que os agendamentos feitos no site sejam GRAVADOS na
  //  planilha, é necessário publicar o Apps Script (arquivo
  //  apps-script.gs). Veja as instruções nesse arquivo e cole a
  //  URL do "App da Web" abaixo:
  // ============================================================
  SHEETS_URL: '',

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
