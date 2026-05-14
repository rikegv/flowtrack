// ─────────────────────────────────────────────────────────────
// FlowTrack — Cálculo de horas úteis e status SLA
// ─────────────────────────────────────────────────────────────

function z(n)   { return String(n).padStart(2, '0'); }
function fmt(d) { return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }

// Páscoa pelo algoritmo de Meeus/Jones/Butcher
function easterDate(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo  = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, day);
}

const _holCache = {};
function getHolidays(year) {
  if (_holCache[year]) return _holCache[year];
  const e  = easterDate(year);
  const gf = new Date(e); gf.setDate(gf.getDate() - 2);   // Sexta-feira Santa
  const cc = new Date(e); cc.setDate(cc.getDate() + 60);  // Corpus Christi
  const set = new Set([
    `${year}-01-01`,  // Confraternização Universal
    fmt(gf),
    `${year}-04-21`,  // Tiradentes
    `${year}-05-01`,  // Dia do Trabalho
    fmt(cc),
    `${year}-09-07`,  // Independência
    `${year}-10-12`,  // N. Sra. Aparecida
    `${year}-11-02`,  // Finados
    `${year}-11-15`,  // Proclamação da República
    `${year}-11-20`,  // Consciência Negra
    `${year}-12-25`,  // Natal
  ]);
  _holCache[year] = set;
  return set;
}

function isWorkDay(d) {
  return CFG.workDays.includes(d.getDay()) &&
         !getHolidays(d.getFullYear()).has(fmt(d));
}

// Soma horas comerciais entre dois timestamps, respeitando dias
// úteis + horário de trabalho + feriados nacionais.
function bizHours(startMs, endMs) {
  if (endMs <= startMs) return 0;
  let total = 0;
  const cur = new Date(startMs);
  cur.setSeconds(0, 0);
  const end = new Date(endMs);
  while (cur < end) {
    if (isWorkDay(cur)) {
      const ws = new Date(cur); ws.setHours(CFG.workStart, 0, 0, 0);
      const we = new Date(cur); we.setHours(CFG.workEnd,   0, 0, 0);
      const nd = new Date(cur); nd.setHours(23, 59, 59, 999);
      const pe = end < nd ? end : nd;
      const os = Math.max(cur.getTime(), ws.getTime());
      const oe = Math.min(pe.getTime(), we.getTime());
      if (oe > os) total += (oe - os) / 3600000;
    }
    cur.setDate(cur.getDate() + 1);
    cur.setHours(0, 0, 0, 0);
  }
  return Math.max(0, total);
}

// Calcula métricas SLA do projeto naquele instante.
function calcSLA(p, now = Date.now()) {
  const deadline = new Date(`${p.deadline}T${z(CFG.workEnd)}:00:00`).getTime();

  let worked = 0;
  for (const s of (p.sessions || [])) worked += bizHours(s.start, s.end);
  if (p.activeSessionStart) worked += bizHours(p.activeSessionStart, Math.min(now, deadline));
  worked = Math.min(worked, p.estimatedHours);

  const remaining   = Math.max(0, p.estimatedHours - worked);
  const hoursLeft   = Math.max(0, bizHours(now, deadline));
  const progressPct = p.estimatedHours > 0 ? Math.min(100, (worked / p.estimatedHours) * 100) : 0;
  const msLeft      = Math.max(0, deadline - now);
  const daysLeft    = Math.floor(msLeft / 86400000);

  const health = remaining < 0.1 ? (hoursLeft > 0 ? 99 : 1) : hoursLeft / remaining;
  let status;
  if (now > deadline)     status = 'overdue';
  else if (health >= 2.5) status = 'great';
  else if (health >= 1.5) status = 'ok';
  else if (health >= 1.0) status = 'warning';
  else if (health >= 0.5) status = 'danger';
  else                    status = 'critical';
  if (p.status === 'completed') status = 'completed';

  return { worked, remaining, hoursLeft, progressPct, health, status, daysLeft, deadline };
}
