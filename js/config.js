// ─────────────────────────────────────────────────────────────
// FlowTrack — Configuração global e constantes de exibição
// ─────────────────────────────────────────────────────────────

// Horário comercial e dias úteis (sobrescrito pelo Settings)
let CFG = { workStart: 8, workEnd: 17, workDays: [1, 2, 3, 4, 5] };

// Credenciais Firebase embutidas. Quando não-nulo, o app pula o
// wizard e conecta automaticamente (modo "link compartilhado").
const EMBEDDED_FB_CFG = {
  apiKey: "AIzaSyCxQytxGbowmwfVFt2wx_6kQn6ki4OMOIk",
  databaseURL: "https://gestaodeprojetos-4a4b7-default-rtdb.firebaseio.com",
  projectId: "gestaodeprojetos-4a4b7"
};

// Rótulos e cores
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

// Chaves de storage
const PIN_KEY        = 'ft_pin';
const PIN_SESS_KEY   = 'ft_pin_unlocked';
const SESS_EMAIL_KEY = 'ft_email_ok';
const ACCESS_PATH    = 'ft_access/emails';
