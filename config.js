// ============================================================
//  config.js — Configurações da GRO Saúde
//  Edite este arquivo para configurar credenciais e integrações
// ============================================================

const GRO_CONFIG = {

  // ---- GOOGLE SHEETS INTEGRATION ----
  // 1. Crie um Google Sheet para agendamentos
  // 2. Acesse Extensões > Apps Script e cole o código de apps-script.gs
  // 3. Publique como "Implantar > Novo Implantação > App da Web"
  // 4. Cole a URL gerada aqui:
  SHEETS_URL: '',

  // ---- USUARIOS DO SISTEMA ----
  // Senhas em Base64. Para gerar: btoa('sua_senha') no console do browser
  // Padrão: admin = gro@2026 | recepcao = recep@2026
  USERS: [
    { username: 'admin',    passwordB64: 'Z3JvQDIwMjY=',   role: 'admin', name: 'Administrador' },
    { username: 'recepcao', passwordB64: 'cmVjZXBAMjAyNg==', role: 'user',  name: 'Recepção GRO'  },
    { username: 'medico',   passwordB64: 'bWVkQDIwMjY=',   role: 'medico', name: 'Médico'        },
  ],
  // Para trocar as senhas, gere o Base64 em btoa('nova_senha') e cole acima.

  CLINICA: {
    nome:   'GRO Saúde',
    slogan: 'Gestão de Segurança e Medicina Ocupacional',
  }
};
