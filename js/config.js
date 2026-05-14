// ─────────────────────────────────────────────────────────────
// FlowTrack — Configuração global e constantes
// ─────────────────────────────────────────────────────────────

// Horário comercial e dias úteis (sobrescrito pelo Settings)
let CFG = { workStart: 8, workEnd: 17, workDays: [1, 2, 3, 4, 5] };

// Credenciais Firebase (sempre conectado)
const FIREBASE_CFG = {
  apiKey: "AIzaSyCxQytxGbowmwfVFt2wx_6kQn6ki4OMOIk",
  authDomain: "gestaodeprojetos-4a4b7.firebaseapp.com",
  databaseURL: "https://gestaodeprojetos-4a4b7-default-rtdb.firebaseio.com",
  projectId: "gestaodeprojetos-4a4b7"
};

// Fallback de super admin (utilizado se ninguém ainda reivindicou na DB).
// Útil só para o primeiro boot — após isso o DB é a fonte de verdade.
const SUPER_ADMIN_EMAILS_FALLBACK = ['henrique.vieira@soulan.com.br'];

// Papéis (ordem importa: do maior privilégio ao menor)
const ROLES = ['owner', 'admin', 'member', 'viewer'];
const ROLE_LABELS = {
  owner:  'Proprietário',
  admin:  'Administrador',
  member: 'Membro',
  viewer: 'Visualizador'
};
const ROLE_COLORS = {
  owner:  '#A78BFA',
  admin:  '#60A5FA',
  member: '#34D399',
  viewer: '#A8B0CC'
};

// Rótulos e cores de projetos
const P_LABELS = ['', 'P1 · Crítico', 'P2 · Alto', 'P3 · Médio', 'P4 · Baixo', 'P5 · Mínimo'];
const P_COLORS = ['', 'var(--p1c)', 'var(--p2c)', 'var(--p3c)', 'var(--p4c)', 'var(--p5c)'];

const SLA_LABEL = {
  great: 'Tranquilo', ok: 'No prazo', warning: 'Atenção',
  danger: 'Em risco', critical: 'Crítico', overdue: 'Atrasado', completed: 'Concluído'
};
const SLA_COLOR = {
  great: '#10B981', ok: '#34D399', warning: '#F59E0B',
  danger: '#F97316', critical: '#EF4444', overdue: '#DC2626', completed: '#2563EB'
};
const SLA_ORDER = ['overdue', 'critical', 'danger', 'warning', 'ok', 'great', 'completed'];

const STATUS_LABELS = {
  active: 'Em andamento', paused: 'Pausado',
  pending: 'Pendente', completed: 'Concluído'
};
const DOT_CLASS = {
  active: 'dot-active', paused: 'dot-paused',
  pending: 'dot-pending', completed: 'dot-completed'
};

// Chaves de storage local
const PIN_KEY        = 'ft_pin';
const PIN_SESS_KEY   = 'ft_pin_unlocked';
const CURRENT_WS_KEY = 'ft_current_ws';
