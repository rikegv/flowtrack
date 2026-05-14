// ─────────────────────────────────────────────────────────────
// FlowTrack — Renderização (dashboard, projetos, modais, panels)
// ─────────────────────────────────────────────────────────────

let currentDetId = null;

// ── Hook central: chamado sempre que os dados mudam ─────────
function onData() {
  renderDash();
  renderProjects();
  renderRightPanel();
  updateBadge();
  updateSbTimer();
}

// ── Helpers de UI ───────────────────────────────────────────
function openM(id)  { document.getElementById(id).style.display = 'flex'; }
function closeM(id) { document.getElementById(id).style.display = 'none'; }

let _cfmCb = null;
function cfmDialog(msg, cb) {
  _cfmCb = cb;
  document.getElementById('cfm-msg').textContent = msg;
  document.getElementById('cfm-ok').onclick = () => {
    closeM('cfm-modal');
    if (_cfmCb) _cfmCb();
  };
  openM('cfm-modal');
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  const t = ['ok', 'warn', 'err', 'info'].includes(type) ? type : 'info';
  el.className = `toast t-${t}`;
  const icons = { ok: '✓', warn: '⚠', err: '✕', info: 'ℹ' };
  el.innerHTML = `<span style="font-size:15px;flex-shrink:0">${icons[t]}</span><span>${esc(msg)}</span>`;
  c.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'tOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 4500);
}

function fmtDur(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${z(h)}:${z(m)}:${z(sc)}`;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Tema ────────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('ft_theme', t);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = t === 'light' ? '☀️' : '🌙';
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}
function initTheme() {
  applyTheme(localStorage.getItem('ft_theme') || 'dark');
}

// ── Navegação entre views ───────────────────────────────────
function showView(name) {
  if (name === 'settings' || name === 'users') {
    requirePin(() => _doShowView(name));
    return;
  }
  _doShowView(name);
}

function _doShowView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const v = document.getElementById(`view-${name}`);
  const n = document.querySelector(`[data-view="${name}"]`);
  if (v) v.classList.add('active');
  if (n) n.classList.add('active');
  if (name === 'dashboard') renderDash();
  if (name === 'projects')  renderProjects();
  if (name === 'settings')  loadCfgForm();
  if (name === 'users')     renderAllowedEmails();
  document.getElementById('sidebar').classList.remove('open');
}

// ── Banner ativo + sidebar timer ────────────────────────────
function updateSbTimer() {
  const active = STORE.all().find(p => p.activeSessionStart && p.status !== 'completed');
  const sbt = document.getElementById('sb-timer');
  const ban = document.getElementById('active-banner');
  if (active) {
    sbt.style.display = 'block';
    document.getElementById('sb-proj-name').textContent = active.name;
    ban.style.display = 'flex';
    document.getElementById('ban-name').textContent = active.name;
  } else {
    sbt.style.display = 'none';
    ban.style.display = 'none';
  }
}

function updateRPActive(p) {
  if (!p) return;
  const sla = calcSLA(p);
  const el = document.getElementById('rpa-worked');
  if (el) el.textContent = sla.worked.toFixed(1) + 'h';
  const sv = document.getElementById('rpa-sla-val');
  if (sv) { sv.textContent = SLA_LABEL[sla.status]; sv.style.color = SLA_COLOR[sla.status]; }
  const pct = Math.round(sla.progressPct);
  const pp = document.getElementById('rpa-prog-pct');
  if (pp) pp.textContent = pct + '%';
  const fill = document.getElementById('rpa-fill');
  if (fill) { fill.style.width = pct + '%'; fill.className = `sla-fill sla-${sla.status}`; }
}

// ── Badge de SLA na sidebar ─────────────────────────────────
function updateBadge() {
  const now = Date.now();
  const n = STORE.all().filter(p => {
    if (p.status === 'completed') return false;
    return ['danger', 'critical', 'overdue'].includes(calcSLA(p, now).status);
  }).length;
  const el = document.getElementById('sla-badge');
  if (el) { el.textContent = n; el.style.display = n > 0 ? 'inline' : 'none'; }
}

// ── Dashboard ───────────────────────────────────────────────
function renderDash() {
  const all = STORE.all(), now = Date.now();
  const total  = all.length;
  const active = all.filter(p => p.status === 'active').length;
  const paused = all.filter(p => p.status === 'paused').length;
  const done   = all.filter(p => p.status === 'completed').length;
  const atRisk = all.filter(p => p.status !== 'completed' &&
    ['danger', 'critical', 'overdue'].includes(calcSLA(p, now).status)).length;

  const statsEl = document.getElementById('stats-row');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat"><div class="stat-lbl">Total</div><div class="stat-val" style="color:var(--txt)">${total}</div><div class="stat-sub">${done} concluído(s)</div></div>
    <div class="stat"><div class="stat-lbl">Em andamento</div><div class="stat-val" style="color:var(--ok)">${active}</div><div class="stat-sub">${paused} pausado(s)</div></div>
    <div class="stat"><div class="stat-lbl">Risco de SLA</div><div class="stat-val" style="color:${atRisk > 0 ? 'var(--err)' : 'var(--ok)'}">${atRisk}</div><div class="stat-sub">Exigem atenção</div></div>
    <div class="stat"><div class="stat-lbl">Conclusão</div><div class="stat-val" style="color:var(--accent)">${total > 0 ? Math.round(done / total * 100) : 0}%</div><div class="stat-sub">${done} de ${total}</div></div>
  `;
  updateSbTimer();

  const sortBy = document.getElementById('dash-sort')?.value || 'priority';
  let rows = all.filter(p => p.status !== 'completed').sort((a, b) => {
    if (sortBy === 'priority') return a.priority - b.priority;
    if (sortBy === 'deadline') return new Date(a.deadline) - new Date(b.deadline);
    if (sortBy === 'sla') return SLA_ORDER.indexOf(calcSLA(a, now).status) - SLA_ORDER.indexOf(calcSLA(b, now).status);
    return 0;
  });
  const recentDone = all.filter(p => p.status === 'completed')
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
    .slice(0, 3);
  rows = [...rows, ...recentDone];

  const tbody = document.getElementById('dash-tbody');
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
      <p>Nenhum projeto ainda. Clique em "Novo Projeto" para começar.</p>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(p => buildRow(p, now)).join('');
}

// ── Lista de projetos completa ──────────────────────────────
function renderProjects() {
  const search = (document.getElementById('ps-search')?.value || '').toLowerCase();
  const fStatus = document.getElementById('ps-status')?.value || '';
  const fPri    = document.getElementById('ps-pri')?.value || '';
  const sortBy  = document.getElementById('ps-sort')?.value || 'priority';
  const now = Date.now();

  const rows = STORE.all().filter(p => {
    if (search && !p.name.toLowerCase().includes(search) &&
        !(p.description || '').toLowerCase().includes(search)) return false;
    if (fStatus && p.status !== fStatus) return false;
    if (fPri && String(p.priority) !== fPri) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === 'priority') return a.priority - b.priority || new Date(a.deadline) - new Date(b.deadline);
    if (sortBy === 'deadline') return new Date(a.deadline) - new Date(b.deadline);
    if (sortBy === 'sla')      return SLA_ORDER.indexOf(calcSLA(a, now).status) - SLA_ORDER.indexOf(calcSLA(b, now).status);
    if (sortBy === 'name')     return a.name.localeCompare(b.name);
    return 0;
  });

  const tbody = document.getElementById('proj-tbody');
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <p>Nenhum projeto encontrado.</p>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(p => buildRow(p, now)).join('');
}

function buildRow(p, now) {
  const sla = calcSLA(p, now);
  const isActive = !!p.activeSessionStart;
  const dlDate = p.deadline ? new Date(p.deadline + 'T12:00:00') : null;
  const dlStr  = dlDate ? dlDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';
  const barPct = Math.min(100, Math.max(0, sla.progressPct));
  const barCls = p.status === 'completed' ? 'sla-completed' : `sla-${sla.status}`;
  const slaColor = SLA_COLOR[sla.status] || '#94A3B8';

  let actions = '';
  if (p.status !== 'completed') {
    if (isActive) {
      actions = `<button class="btn btn-pause btn-sm" onclick="event.stopPropagation();pauseActive()">⏸ Pausar</button>`;
    } else {
      actions = `<button class="btn btn-work btn-sm" onclick="event.stopPropagation();startWork('${p.id}')">▶ Trabalhar</button>`;
    }
  }

  const activeCls = isActive ? 'row-active' : '';
  return `
    <tr>
      <td><div class="proj-row ${activeCls}" onclick="openDet('${p.id}')" style="padding:0 14px;height:100%;align-items:stretch;display:flex">
        <div style="width:3px;border-radius:2px;background:${P_COLORS[p.priority]};flex-shrink:0;margin:8px 0;align-self:stretch"></div>
      </div></td>
      <td><div class="proj-row ${activeCls}" onclick="openDet('${p.id}')" style="cursor:pointer">
        <div style="flex:1;min-width:0">
          <div style="font-size:13.5px;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px">${esc(p.name)}</div>
          <div style="font-size:11.5px;color:var(--txt3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;margin-top:1px">${esc(p.description || '—')}</div>
        </div>
      </div></td>
      <td><div class="proj-row ${activeCls}">
        <span class="pb pb${p.priority}">${P_LABELS[p.priority]}</span>
      </div></td>
      <td><div class="proj-row ${activeCls}">
        <div style="width:100%">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--txt3);margin-bottom:4px">
            <span style="font-weight:700;color:${slaColor}">${SLA_LABEL[sla.status]}</span>
            <span>${sla.worked.toFixed(1)}h / ${p.estimatedHours}h</span>
          </div>
          <div class="sla-bar"><div class="sla-fill ${barCls}" style="width:${barPct}%"></div></div>
          ${p.status !== 'completed' ? `<div style="font-size:10.5px;color:var(--txt3);margin-top:3px">${sla.hoursLeft.toFixed(1)}h úteis disponíveis</div>` : ''}
        </div>
      </div></td>
      <td><div class="proj-row ${activeCls}">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--txt)">${dlStr}</div>
          ${p.status !== 'completed' ? `<div style="font-size:11px;color:${sla.daysLeft <= 3 ? 'var(--err)' : sla.daysLeft <= 7 ? 'var(--warn)' : 'var(--txt3)'}">${sla.daysLeft}d restantes</div>` : ''}
        </div>
      </div></td>
      <td><div class="proj-row ${activeCls}">
        <div style="display:flex;align-items:center;gap:6px">
          <span class="dot ${DOT_CLASS[p.status] || 'dot-pending'}"></span>
          <span style="font-size:12px;color:var(--txt2)">${STATUS_LABELS[p.status] || p.status}</span>
        </div>
      </div></td>
      <td><div class="proj-row ${activeCls}" style="gap:6px">
        ${actions}
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDet('${p.id}')">•••</button>
      </div></td>
    </tr>`;
}

// ── Right panel ─────────────────────────────────────────────
function renderRightPanel() {
  const now = Date.now();
  const all = STORE.all();
  const active = all.find(p => p.activeSessionStart && p.status !== 'completed');

  const emptyEl = document.getElementById('rp-active-empty');
  const infoEl  = document.getElementById('rp-active-info');
  if (emptyEl && infoEl) {
    if (active) {
      emptyEl.style.display = 'none';
      infoEl.style.display = 'block';
      document.getElementById('rpa-name').textContent = active.name;
      updateRPActive(active);
    } else {
      emptyEl.style.display = 'block';
      infoEl.style.display = 'none';
    }
  }

  // Prazos próximos
  const upcoming = all.filter(p => p.status !== 'completed')
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 6);
  const dlEl = document.getElementById('rp-deadlines');
  if (dlEl) {
    dlEl.innerHTML = upcoming.length === 0
      ? '<div style="font-size:12.5px;color:var(--txt3);padding:4px 0">Nenhum prazo pendente.</div>'
      : upcoming.map(p => {
          const sla = calcSLA(p, now);
          const color = SLA_COLOR[sla.status] || '#2563EB';
          const dlDate = new Date(p.deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
          return `<div class="deadline-item" onclick="openDet('${p.id}')">
            <div class="deadline-bar" style="background:${color}"></div>
            <div style="flex:1;min-width:0">
              <div class="deadline-name">${esc(p.name)}</div>
              <div class="deadline-date">${dlDate} · ${sla.daysLeft}d · <span style="color:${color}">${SLA_LABEL[sla.status]}</span></div>
            </div>
            <span class="pb pb${p.priority}" style="font-size:10px;padding:2px 7px">${p.priority}</span>
          </div>`;
        }).join('');
  }

  // Saúde geral SLA
  const counts = { overdue: 0, critical: 0, danger: 0, warning: 0, ok: 0, great: 0 };
  all.filter(p => p.status !== 'completed').forEach(p => {
    const s = calcSLA(p, now).status;
    if (counts[s] !== undefined) counts[s]++;
  });
  const healthEl = document.getElementById('rp-health');
  if (healthEl) {
    const pairs = [
      { label: 'OK', value: counts.great + counts.ok, color: '#10B981' },
      { label: 'Atenção', value: counts.warning, color: '#F59E0B' },
      { label: 'Risco', value: counts.danger + counts.critical + counts.overdue, color: '#EF4444' },
    ];
    healthEl.innerHTML = pairs.map(({ label, value, color }) => `
      <div class="health-item">
        <div class="health-item-val" style="color:${color}">${value}</div>
        <div class="health-item-lbl">${label}</div>
      </div>`).join('');
  }

  // Atividade recente
  const actEl = document.getElementById('rp-activity');
  if (actEl) {
    const items = ACTIVITY.items.slice(0, 8);
    actEl.innerHTML = items.length === 0
      ? '<div style="font-size:12px;color:var(--txt3)">Nenhuma atividade ainda.</div>'
      : items.map(it => {
          const d = new Date(it.ts);
          const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          return `<div class="activity-item">
            <div class="activity-dot" style="background:var(--accent)"></div>
            <div style="flex:1">
              <div style="color:var(--txt2)">${esc(it.msg)}</div>
              <div style="font-size:10.5px;color:var(--txt3);margin-top:1px">${dateStr} ${timeStr}</div>
            </div>
          </div>`;
        }).join('');
  }
}

// ── Modal de detalhes ───────────────────────────────────────
function openDet(id) {
  const p = STORE.get(id);
  if (!p) return;
  currentDetId = id;
  const now = Date.now();
  const sla = calcSLA(p, now);
  const dlDate = p.deadline ? new Date(p.deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  const sdDate = p.startDate ? new Date(p.startDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

  document.getElementById('det-name').textContent = p.name;
  document.getElementById('det-pb').innerHTML = `<span class="pb pb${p.priority}">${P_LABELS[p.priority]}</span>`;
  document.getElementById('det-desc').textContent = p.description || 'Sem descrição.';

  document.getElementById('det-metrics').innerHTML = `
    <div style="background:var(--s3);border:1px solid var(--b1);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:var(--txt)">${sla.worked.toFixed(1)}h</div>
      <div style="font-size:10px;color:var(--txt3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Trabalhadas</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:2px">de ${p.estimatedHours}h estimadas</div>
    </div>
    <div style="background:var(--s3);border:1px solid var(--b1);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:${SLA_COLOR[sla.status]}">${SLA_LABEL[sla.status]}</div>
      <div style="font-size:10px;color:var(--txt3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Status SLA</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:2px">${sla.hoursLeft.toFixed(1)}h úteis disp.</div>
    </div>
    <div style="background:var(--s3);border:1px solid var(--b1);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:var(--txt)">${sla.daysLeft}</div>
      <div style="font-size:10px;color:var(--txt3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Dias restantes</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:2px">${dlDate}</div>
    </div>
    <div style="background:var(--s3);border:1px solid var(--b1);border-radius:10px;padding:14px;text-align:center">
      <div style="font-size:22px;font-weight:800;color:var(--txt)">${Math.round(sla.progressPct)}%</div>
      <div style="font-size:10px;color:var(--txt3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-top:3px">Executado</div>
      <div style="font-size:11px;color:var(--txt3);margin-top:2px">${Math.max(0, p.estimatedHours - sla.worked).toFixed(1)}h restantes</div>
    </div>
  `;

  const barPct = Math.min(100, Math.max(0, sla.progressPct));
  document.getElementById('det-sla-wrap').innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--txt2);margin-bottom:6px">
      <span>Progresso de execução</span>
      <span>Horas úteis até o prazo: <strong style="color:${SLA_COLOR[sla.status]}">${sla.hoursLeft.toFixed(1)}h</strong></span>
    </div>
    <div class="sla-bar" style="height:9px">
      <div class="sla-fill sla-${p.status === 'completed' ? 'completed' : sla.status}" style="width:${barPct}%;height:9px"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--txt3);margin-top:5px">
      <span>${Math.round(barPct)}% das horas estimadas executadas</span>
      <span style="color:${SLA_COLOR[sla.status]}">${SLA_LABEL[sla.status]}</span>
    </div>
  `;

  // Sessões
  const allSessions = [...(p.sessions || [])];
  if (p.activeSessionStart) allSessions.push({ start: p.activeSessionStart, end: now, active: true });
  const sessHtml = allSessions.length === 0
    ? '<div style="color:var(--txt3);font-size:12.5px;padding:8px 0">Nenhuma sessão registrada.</div>'
    : allSessions.reverse().slice(0, 20).map((s, i) => {
        const bh = bizHours(s.start, s.end).toFixed(2);
        const st = new Date(s.start).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        const en = s.active ? `<span style="color:var(--ok);font-weight:700">→ agora</span>`
          : new Date(s.end).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        return `<div class="session-row">
          <div style="width:18px;height:18px;border-radius:50%;background:var(--s3);border:1px solid var(--b2);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--txt3);flex-shrink:0">${allSessions.length - i}</div>
          <div style="flex:1;font-size:12px">${st} → ${en}</div>
          <div style="font-size:12px;font-weight:700;color:var(--accentL)">${bh}h</div>
        </div>`;
      }).join('');
  document.getElementById('det-sessions').innerHTML = sessHtml;

  document.getElementById('det-info').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b1)">
        <span style="color:var(--txt2)">Data de início</span><span style="font-weight:600">${sdDate}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b1)">
        <span style="color:var(--txt2)">Prazo de entrega</span><span style="font-weight:600">${dlDate}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b1)">
        <span style="color:var(--txt2)">Horas estimadas</span><span style="font-weight:600">${p.estimatedHours}h</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b1)">
        <span style="color:var(--txt2)">Horas trabalhadas</span><span style="font-weight:600;color:var(--accentL)">${sla.worked.toFixed(2)}h</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--b1)">
        <span style="color:var(--txt2)">Sessões registradas</span><span style="font-weight:600">${(p.sessions || []).length}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:8px 0">
        <span style="color:var(--txt2)">Criado em</span><span style="font-weight:600">${new Date(p.createdAt || Date.now()).toLocaleDateString('pt-BR')}</span>
      </div>
    </div>
  `;

  const wb = document.getElementById('det-work-btn');
  const db = document.getElementById('det-done-btn');
  if (p.status === 'completed') {
    wb.style.display = 'none';
    db.style.display = 'none';
  } else if (p.activeSessionStart) {
    wb.style.display = 'none';
    db.style.display = 'inline-flex';
  } else {
    wb.style.display = 'inline-flex';
    db.style.display = 'inline-flex';
  }

  openM('det-modal');
}
