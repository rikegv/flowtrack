// ─────────────────────────────────────────────────────────────
// FlowTrack — Renderização (workspace-aware)
// ─────────────────────────────────────────────────────────────

let currentDetId = null;

// ── Hook central ─────────────────────────────────────────────
function onData() {
  renderWorkspaceSwitcher();
  renderUserProfile();
  renderDash();
  renderProjects();
  renderMembers();
  renderRightPanel();
  renderSuperAdminPanel();
  updateBadge();
  updateSbTimer();
  syncRoleVisibility();
}

// ── Helpers de UI ────────────────────────────────────────────
function openM(id)  { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function closeM(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

let _cfmCb = null;
function cfmDialog(msg, cb) {
  _cfmCb = cb;
  document.getElementById('cfm-msg').textContent = msg;
  document.getElementById('cfm-ok').onclick = () => { closeM('cfm-modal'); if (_cfmCb) _cfmCb(); };
  openM('cfm-modal');
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toasts');
  if (!c) return;
  const t = ['ok', 'warn', 'err', 'info'].includes(type) ? type : 'info';
  const el = document.createElement('div');
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
  return `${z(Math.floor(s / 3600))}:${z(Math.floor((s % 3600) / 60))}:${z(s % 60)}`;
}

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Tema ─────────────────────────────────────────────────────
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
function initTheme() { applyTheme(localStorage.getItem('ft_theme') || 'dark'); }

// ── Navegação ────────────────────────────────────────────────
function showView(name) {
  if (name === 'settings') { requirePin(() => _doShowView(name)); return; }
  if (name === 'superadmin' && !STORE.isSuperAdmin()) { toast('Acesso restrito a super admins.', 'warn'); return; }
  if (name === 'members' && !STORE.canManage()) { toast('Apenas Owner/Admin gerenciam membros.', 'warn'); return; }
  _doShowView(name);
}

function _doShowView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const v = document.getElementById(`view-${name}`);
  const n = document.querySelector(`[data-view="${name}"]`);
  if (v) v.classList.add('active');
  if (n) n.classList.add('active');
  if (name === 'dashboard')  renderDash();
  if (name === 'projects')   renderProjects();
  if (name === 'members')    renderMembers();
  if (name === 'settings')   loadCfgForm();
  if (name === 'superadmin') renderSuperAdminPanel();
  document.getElementById('sidebar').classList.remove('open');
}

// ── Visibilidade por papel ───────────────────────────────────
function syncRoleVisibility() {
  const navMembers = document.querySelector('[data-view="members"]');
  if (navMembers) navMembers.style.display = STORE.canManage() ? 'flex' : 'none';
  const navSA = document.querySelector('[data-view="superadmin"]');
  if (navSA) navSA.style.display = STORE.isSuperAdmin() ? 'flex' : 'none';

  // Botões dependentes de edição
  document.querySelectorAll('[data-needs-edit]').forEach(el => {
    el.style.display = STORE.canEdit() ? '' : 'none';
  });
}

// ── Sidebar: workspace switcher ──────────────────────────────
function renderWorkspaceSwitcher() {
  const cur = STORE.current();
  const nameEl = document.getElementById('ws-current-name');
  const subEl  = document.getElementById('ws-current-sub');
  if (nameEl) nameEl.textContent = cur ? cur.name : 'Sem workspace';
  if (subEl)  subEl.textContent  = cur ? (cur.type === 'personal' ? 'Pessoal' : 'Compartilhado') : '—';

  const list = STORE.list().sort((a, b) => {
    // Pessoal primeiro, depois compartilhados por nome
    if (a.type === 'personal' && b.type !== 'personal') return -1;
    if (b.type === 'personal' && a.type !== 'personal') return 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  const dd = document.getElementById('ws-dropdown-list');
  if (!dd) return;
  dd.innerHTML = list.map(w => {
    const isCurrent = w.id === STORE.currentWsId;
    const memberCount = Object.keys(w.members || {}).length;
    return `<div class="ws-dd-item ${isCurrent ? 'selected' : ''}" onclick="switchWs('${w.id}')">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(w.name)}</div>
        <div style="font-size:10.5px;color:var(--txt3);margin-top:1px">${w.type === 'personal' ? 'Pessoal' : memberCount + ' membro' + (memberCount !== 1 ? 's' : '')}</div>
      </div>
      ${isCurrent ? '<span style="color:var(--accentL);font-size:14px">✓</span>' : ''}
    </div>`;
  }).join('');
}

function toggleWsDropdown() {
  const dd = document.getElementById('ws-dropdown');
  if (!dd) return;
  dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}

function switchWs(wsId) {
  STORE.switchTo(wsId);
  document.getElementById('ws-dropdown').style.display = 'none';
  _doShowView('dashboard');
}

// Click fora fecha dropdown
document.addEventListener('click', e => {
  const dd = document.getElementById('ws-dropdown');
  const trigger = document.getElementById('ws-switcher-trigger');
  if (!dd || !trigger) return;
  if (!dd.contains(e.target) && !trigger.contains(e.target)) {
    dd.style.display = 'none';
  }
});

// ── Sidebar: perfil de usuário ───────────────────────────────
function renderUserProfile() {
  const u = STORE.user;
  if (!u) return;
  const nameEl = document.getElementById('sb-user-name');
  const emailEl = document.getElementById('sb-user-email');
  const avatarEl = document.getElementById('sb-user-avatar');
  if (nameEl) nameEl.textContent = u.displayName || u.email.split('@')[0];
  if (emailEl) emailEl.textContent = u.email;
  if (avatarEl) {
    if (u.photoURL) {
      avatarEl.innerHTML = `<img src="${esc(u.photoURL)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`;
    } else {
      const initials = (u.displayName || u.email).split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
      avatarEl.innerHTML = `<span style="font-size:12px;font-weight:700;color:#fff">${esc(initials)}</span>`;
    }
  }
  const badge = document.getElementById('sb-superadmin-badge');
  if (badge) badge.style.display = u.isSuperAdmin ? 'inline-block' : 'none';
}

function toggleUserMenu() {
  const m = document.getElementById('user-menu');
  if (!m) return;
  m.style.display = m.style.display === 'block' ? 'none' : 'block';
}
document.addEventListener('click', e => {
  const m = document.getElementById('user-menu');
  const t = document.getElementById('user-menu-trigger');
  if (!m || !t) return;
  if (!m.contains(e.target) && !t.contains(e.target)) m.style.display = 'none';
});

// ── Banner + sidebar timer ───────────────────────────────────
function updateSbTimer() {
  const active = STORE.currentProjects().find(p => p.activeSessionStart && p.status !== 'completed');
  const sbt = document.getElementById('sb-timer');
  const ban = document.getElementById('active-banner');
  if (active) {
    if (sbt) sbt.style.display = 'block';
    const sp = document.getElementById('sb-proj-name');
    if (sp) sp.textContent = active.name;
    if (ban) ban.style.display = 'flex';
    const bn = document.getElementById('ban-name');
    if (bn) bn.textContent = active.name;
  } else {
    if (sbt) sbt.style.display = 'none';
    if (ban) ban.style.display = 'none';
  }
}

function updateRPActive(p) {
  if (!p) return;
  const sla = calcSLA(p);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('rpa-worked', sla.worked.toFixed(1) + 'h');
  const sv = document.getElementById('rpa-sla-val');
  if (sv) { sv.textContent = SLA_LABEL[sla.status]; sv.style.color = SLA_COLOR[sla.status]; }
  const pct = Math.round(sla.progressPct);
  set('rpa-prog-pct', pct + '%');
  const fill = document.getElementById('rpa-fill');
  if (fill) { fill.style.width = pct + '%'; fill.className = `sla-fill sla-${sla.status}`; }
}

function updateBadge() {
  const now = Date.now();
  const n = STORE.currentProjects().filter(p => {
    if (p.status === 'completed') return false;
    return ['danger', 'critical', 'overdue'].includes(calcSLA(p, now).status);
  }).length;
  const el = document.getElementById('sla-badge');
  if (el) { el.textContent = n; el.style.display = n > 0 ? 'inline' : 'none'; }
}

// ── Dashboard ────────────────────────────────────────────────
function renderDash() {
  const all = STORE.currentProjects(), now = Date.now();
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
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, 3);
  rows = [...rows, ...recentDone];

  const tbody = document.getElementById('dash-tbody');
  if (!tbody) return;
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>
      <p>Nenhum projeto neste workspace.${STORE.canEdit() ? ' Clique em "Novo Projeto" para começar.' : ''}</p>
    </div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(p => buildRow(p, now)).join('');
}

function renderProjects() {
  const search = (document.getElementById('ps-search')?.value || '').toLowerCase();
  const fStatus = document.getElementById('ps-status')?.value || '';
  const fPri    = document.getElementById('ps-pri')?.value || '';
  const sortBy  = document.getElementById('ps-sort')?.value || 'priority';
  const now = Date.now();

  const rows = STORE.currentProjects().filter(p => {
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
  if (STORE.canEdit() && p.status !== 'completed') {
    actions = isActive
      ? `<button class="btn btn-pause btn-sm" onclick="event.stopPropagation();pauseActive()">⏸ Pausar</button>`
      : `<button class="btn btn-work btn-sm" onclick="event.stopPropagation();startWork('${p.id}')">▶ Trabalhar</button>`;
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
      <td><div class="proj-row ${activeCls}"><span class="pb pb${p.priority}">${P_LABELS[p.priority]}</span></div></td>
      <td><div class="proj-row ${activeCls}"><div style="width:100%">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--txt3);margin-bottom:4px">
          <span style="font-weight:700;color:${slaColor}">${SLA_LABEL[sla.status]}</span>
          <span>${sla.worked.toFixed(1)}h / ${p.estimatedHours}h</span>
        </div>
        <div class="sla-bar"><div class="sla-fill ${barCls}" style="width:${barPct}%"></div></div>
        ${p.status !== 'completed' ? `<div style="font-size:10.5px;color:var(--txt3);margin-top:3px">${sla.hoursLeft.toFixed(1)}h úteis disponíveis</div>` : ''}
      </div></div></td>
      <td><div class="proj-row ${activeCls}"><div>
        <div style="font-size:13px;font-weight:600;color:var(--txt)">${dlStr}</div>
        ${p.status !== 'completed' ? `<div style="font-size:11px;color:${sla.daysLeft <= 3 ? 'var(--err)' : sla.daysLeft <= 7 ? 'var(--warn)' : 'var(--txt3)'}">${sla.daysLeft}d restantes</div>` : ''}
      </div></div></td>
      <td><div class="proj-row ${activeCls}"><div style="display:flex;align-items:center;gap:6px">
        <span class="dot ${DOT_CLASS[p.status] || 'dot-pending'}"></span>
        <span style="font-size:12px;color:var(--txt2)">${STATUS_LABELS[p.status] || p.status}</span>
      </div></div></td>
      <td><div class="proj-row ${activeCls}" style="gap:6px">
        ${actions}
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDet('${p.id}')">•••</button>
      </div></div></td>
    </tr>`;
}

// ── Right panel ──────────────────────────────────────────────
function renderRightPanel() {
  const now = Date.now();
  const all = STORE.currentProjects();
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

  const upcoming = all.filter(p => p.status !== 'completed')
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 6);
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

  const actEl = document.getElementById('rp-activity');
  if (actEl) {
    const items = STORE.recentActivity().slice(0, 8);
    actEl.innerHTML = items.length === 0
      ? '<div style="font-size:12px;color:var(--txt3)">Nenhuma atividade ainda.</div>'
      : items.map(it => {
          const d = new Date(it.ts);
          const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          return `<div class="activity-item">
            <div class="activity-dot" style="background:var(--accent)"></div>
            <div style="flex:1">
              <div style="color:var(--txt2)"><strong style="color:var(--txt)">${esc(it.actorName || '—')}</strong> ${esc(it.msg)}</div>
              <div style="font-size:10.5px;color:var(--txt3);margin-top:1px">${dateStr} ${timeStr}</div>
            </div>
          </div>`;
        }).join('');
  }
}

// ── Modal de detalhes ────────────────────────────────────────
function openDet(id) {
  const p = STORE.getProject(id);
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

  const canEdit = STORE.canEdit();
  const wb = document.getElementById('det-work-btn');
  const db_ = document.getElementById('det-done-btn');
  const eb = document.getElementById('det-edit-btn');
  const xb = document.getElementById('det-del-btn');
  if (eb) eb.style.display = canEdit ? 'inline-flex' : 'none';
  if (xb) xb.style.display = canEdit ? 'inline-flex' : 'none';
  if (!canEdit) {
    if (wb) wb.style.display = 'none';
    if (db_) db_.style.display = 'none';
  } else if (p.status === 'completed') {
    if (wb) wb.style.display = 'none';
    if (db_) db_.style.display = 'none';
  } else if (p.activeSessionStart) {
    if (wb) wb.style.display = 'none';
    if (db_) db_.style.display = 'inline-flex';
  } else {
    if (wb) wb.style.display = 'inline-flex';
    if (db_) db_.style.display = 'inline-flex';
  }

  openM('det-modal');
}

// ── Membros (view) ───────────────────────────────────────────
async function renderMembers() {
  const ws = STORE.current();
  const wrap = document.getElementById('members-list');
  const inviteWrap = document.getElementById('members-invites');
  if (!ws || !wrap) return;

  // Cabeçalho com nome do workspace
  const titleEl = document.getElementById('members-ws-name');
  if (titleEl) titleEl.textContent = ws.name;

  const isOwnerOrAdmin = STORE.canManage();
  const myUid = STORE.user?.uid;
  const members = ws.members || {};
  const uids = Object.keys(members);

  // Carrega perfis
  const profiles = await Promise.all(uids.map(uid => STORE.loadUser(uid)));
  const rows = uids.map((uid, i) => {
    const role = members[uid];
    const u = profiles[i] || { uid, displayName: '(perfil não encontrado)', email: '' };
    const isMe = uid === myUid;
    const isOwner = role === 'owner';
    const initials = (u.displayName || u.email || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
    const avatar = u.photoURL
      ? `<img src="${esc(u.photoURL)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--purple));display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700">${esc(initials)}</div>`;
    return `<div class="member-row">
      ${avatar}
      <div style="flex:1;min-width:0">
        <div style="font-size:13.5px;font-weight:600;color:var(--txt)">${esc(u.displayName || u.email)}${isMe ? ' <span style="color:var(--txt3);font-weight:400">(você)</span>' : ''}</div>
        <div style="font-size:11.5px;color:var(--txt3)">${esc(u.email)}</div>
      </div>
      ${isOwnerOrAdmin && !isMe && !isOwner ? `
        <select class="role-select" onchange="changeRole('${ws.id}','${uid}',this.value)" style="width:auto;padding:5px 9px;font-size:12px">
          ${ROLES.filter(r => r !== 'owner').map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('')}
        </select>
        <button class="btn btn-danger btn-sm" onclick="removeMemberAction('${ws.id}','${uid}','${esc(u.displayName || u.email)}')" style="padding:4px 10px;font-size:11px">Remover</button>
      ` : `<span class="pb" style="background:${ROLE_COLORS[role]}22;color:${ROLE_COLORS[role]};border:1px solid ${ROLE_COLORS[role]}55">${ROLE_LABELS[role] || role}</span>`}
    </div>`;
  }).join('');
  wrap.innerHTML = rows || '<div style="color:var(--txt3);font-size:13px;padding:14px">Sem membros.</div>';

  // Convites pendentes
  const invites = ws.invites || {};
  const inviteKeys = Object.keys(invites);
  if (inviteWrap) {
    if (inviteKeys.length === 0) {
      inviteWrap.innerHTML = '';
    } else {
      inviteWrap.innerHTML = `
        <div class="rp-title" style="margin-top:24px;margin-bottom:10px">Convites pendentes (${inviteKeys.length})</div>
        ${inviteKeys.map(ek => {
          const inv = invites[ek];
          const email = inv?.email || ek.replace(/_dot_/g, '.').replace(/_at_/g, '@');
          const role = inv?.role || 'member';
          return `<div class="member-row">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--s3);border:1px dashed var(--b2);display:flex;align-items:center;justify-content:center;color:var(--txt3);font-size:16px">✉</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13.5px;font-weight:600;color:var(--txt)">${esc(email)}</div>
              <div style="font-size:11.5px;color:var(--txt3)">Aguardando primeiro login</div>
            </div>
            <span class="pb" style="background:${ROLE_COLORS[role]}22;color:${ROLE_COLORS[role]};border:1px solid ${ROLE_COLORS[role]}55">${ROLE_LABELS[role] || role}</span>
            ${isOwnerOrAdmin ? `<button class="btn btn-ghost btn-sm" onclick="cancelInviteAction('${ws.id}','${ek}')" style="padding:4px 10px;font-size:11px">Cancelar</button>` : ''}
          </div>`;
        }).join('')}`;
    }
  }

  const addBtn = document.getElementById('members-add-btn');
  if (addBtn) addBtn.style.display = isOwnerOrAdmin ? 'inline-flex' : 'none';
}

// ── Painel super admin ───────────────────────────────────────
async function renderSuperAdminPanel() {
  if (!STORE.isSuperAdmin()) return;
  const wrap = document.getElementById('sa-content');
  if (!wrap) return;

  const [allowedSnap, saSnap] = await Promise.all([
    db.ref('ft_access/allowedEmails').once('value'),
    db.ref('ft_access/superAdmins').once('value'),
  ]);
  const allowed = allowedSnap.val() || {};
  const sa = saSnap.val() || {};
  const allowedKeys = Object.keys(allowed);
  const saUids = Object.keys(sa);

  wrap.innerHTML = `
    <div class="settings-block">
      <div class="sb-title">📨 E-mails permitidos no app</div>
      <div class="sb-sub">Somente e-mails desta lista conseguem entrar via Google Sign-In. Super admins entram sempre.</div>
      <div style="display:flex;gap:10px;margin-bottom:14px">
        <input type="email" id="sa-add-email" placeholder="novo@empresa.com" style="flex:1" onkeydown="if(event.key==='Enter')addAllowedEmail()">
        <button class="btn btn-primary btn-sm" onclick="addAllowedEmail()">+ Adicionar</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${allowedKeys.length === 0
          ? '<div style="color:var(--txt3);font-size:13px;text-align:center;padding:16px">Lista vazia. Apenas super admins entram.</div>'
          : allowedKeys.map(k => `<div class="member-row" style="padding:8px 12px">
              <span style="flex:1;font-size:13px">${esc(allowed[k])}</span>
              <button class="btn btn-danger btn-sm" onclick="removeAllowedEmail('${k}')" style="padding:3px 9px;font-size:11px">Remover</button>
            </div>`).join('')}
      </div>
    </div>

    <div class="settings-block">
      <div class="sb-title">👑 Super Admins</div>
      <div class="sb-sub">Têm controle total sobre o sistema (gerenciam e-mails permitidos, todos os workspaces, etc.).</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${saUids.map(uid => `<div class="member-row" style="padding:8px 12px">
            <span style="flex:1;font-size:13px">${esc(sa[uid]?.email || uid)}</span>
            <span class="pb" style="background:${ROLE_COLORS.owner}22;color:${ROLE_COLORS.owner};border:1px solid ${ROLE_COLORS.owner}55">SUPER</span>
            ${uid !== STORE.user.uid ? `<button class="btn btn-danger btn-sm" onclick="revokeSuperAdmin('${uid}')" style="padding:3px 9px;font-size:11px">Revogar</button>` : ''}
          </div>`).join('')}
      </div>
    </div>
  `;
}
