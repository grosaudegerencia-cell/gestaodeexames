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
  //  Campo "email" é usado para recuperação de senha. Preencha com o e-mail
  //  real de cada colaborador (ou edite depois na tela "Usuários").
  //  IMPORTANTE: usuários criados pela tela "Usuários" ficam salvos APENAS no
  //  navegador onde foram criados (não funcionam em outro computador/celular).
  //  Para um usuário acessar de QUALQUER dispositivo, cadastre-o aqui embaixo.
  //  Senha padrão "gro2026" (Base64 Z3JvMjAyNg==) com troca obrigatória no 1º acesso.
  USERS: [
    { username: 'admin',    passwordB64: 'Z3JvQDIwMjY=', role: 'admin',  name: 'Administrador GRO', email: 'grosaudegerencia@gmail.com', fixo: true },
    { username: 'recepcao', passwordB64: 'Z3JvMjAyNg==', role: 'user',   name: 'Recepção GRO',      email: '', fixo: true },
    { username: 'medico',   passwordB64: 'Z3JvMjAyNg==', role: 'medico', name: 'Médico',            email: '', fixo: true },
    // --- Colaboradores (acesso em qualquer dispositivo) ---
    { username: 'marianas', passwordB64: 'Z3JvMjAyNg==', role: 'user', name: 'Mariana A. L. da Silva', email: 'marianaandradelopes2301@gmail.com', mustChangePassword: true, fixo: true },
    { username: 'gabrielaq', passwordB64: 'Z3JvMjAyNg==', role: 'user', name: 'Gabriela A. Querici', email: 'gquerici@gmail.com', mustChangePassword: true, fixo: true },
    { username: 'marcia',   passwordB64: 'Z3JvMjAyNg==', role: 'user', name: 'Elis Márcia', email: 'elismarcia03@hotmail.com', mustChangePassword: true, fixo: true },
  ],

  // Versão das credenciais. Ao aumentar este número, todos os navegadores
  // reabilitam os usuários padrão e descartam senhas alteradas localmente
  // (overrides), forçando o uso das senhas definidas acima em USERS.
  CRED_VERSION: 2,

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
