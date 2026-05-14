// ─────────────────────────────────────────────────────────────
// FlowTrack — Boot, ações de projeto, workspaces e configurações
// ─────────────────────────────────────────────────────────────

let _tickInterval = null;

// ── Boot ─────────────────────────────────────────────────────
function initApp() {
  initTheme();
  const saved = localStorage.getItem('ft_cfg');
  if (saved) Object.assign(CFG, JSON.parse(saved));

  // Mostra splash de login enquanto Firebase decide se já há sessão
  document.getElementById('signin-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'flex';

  auth.onAuthStateChanged(async user => {
    if (!user) {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('app').style.display = 'none';
      document.getElementById('access-denied').style.display = 'none';
      document.getElementById('signin-screen').style.display = 'flex';
      return;
    }
    try {
      document.getElementById('loading-screen').style.display = 'flex';
      document.getElementById('signin-screen').style.display = 'none';
      await onUserSignedIn(user);
      STORE.startSync();
      document.getElementById('loading-screen').style.display = 'none';
      launchApp();
    } catch (e) {
      if (e.message === 'not_authorized') return;   // gateado pelo showAccessDenied
      console.error('Boot failed:', e);
      toast('Erro ao entrar: ' + (e.message || e), 'err');
      try { await auth.signOut(); } catch {}
    }
  });
}

function launchApp() {
  document.getElementById('app').style.display = 'grid';
  loadCfgForm();
  onData();
  startClock();
  startTick();
  setTimeout(checkAlerts, 2500);
}

// ── Relógio + ticker ─────────────────────────────────────────
const DAYS_PT   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function startClock() {
  const tick = () => {
    const now = new Date();
    const sbDate = document.getElementById('sb-date');
    if (sbDate) sbDate.textContent = `${DAYS_PT[now.getDay()]}, ${now.getDate()} ${MONTHS_PT[now.getMonth()]}`;

    const h = now.getHours();
    const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const dg = document.getElementById('dash-greet');
    if (dg && STORE.user) {
      dg.textContent = `${greet}, ${STORE.user.displayName?.split(/\s+/)[0] || STORE.user.email.split('@')[0]} 👋`;
    }
    const dd = document.getElementById('dash-date');
    if (dd) {
      const mon = MONTHS_PT[now.getMonth()];
      dd.textContent = `${DAYS_PT[now.getDay()]}, ${now.getDate()} de ${mon.charAt(0).toUpperCase()+mon.slice(1)} de ${now.getFullYear()}`;
    }
  };
  tick();
  setInterval(tick, 60000);
}

function startTick() {
  if (_tickInterval) clearInterval(_tickInterval);
  _tickInterval = setInterval(() => {
    const active = STORE.currentProjects().find(p => p.activeSessionStart && p.status !== 'completed');
    if (active) {
      const s = fmtDur(Date.now() - active.activeSessionStart);
      ['sb-timer-val', 'ban-timer', 'rpa-timer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = s;
      });
      updateRPActive(active);
    }
  }, 1000);
}

// ── Project actions ──────────────────────────────────────────
function genId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function openNew() {
  if (!STORE.canEdit()) { toast('Sem permissão para criar projetos.', 'warn'); return; }
  document.getElementById('fm-title').textContent = 'Novo Projeto';
  document.getElementById('fm-sub').textContent = 'Em ' + (STORE.current()?.name || '');
  document.getElementById('fe-id').value = '';
  document.getElementById('fe-name').value = '';
  document.getElementById('fe-desc').value = '';
  document.getElementById('fe-pri').value = '3';
  document.getElementById('fe-hrs').value = '';
  document.getElementById('fe-start').value = fmt(new Date());
  document.getElementById('fe-dl').value = '';
  openM('proj-modal');
  setTimeout(() => document.getElementById('fe-name').focus(), 120);
}

function editProj(id) {
  if (!STORE.canEdit()) { toast('Sem permissão para editar.', 'warn'); return; }
  closeM('det-modal');
  const p = STORE.getProject(id);
  if (!p) return;
  document.getElementById('fm-title').textContent = 'Editar Projeto';
  document.getElementById('fm-sub').textContent = p.name;
  document.getElementById('fe-id').value = id;
  document.getElementById('fe-name').value = p.name;
  document.getElementById('fe-desc').value = p.description || '';
  document.getElementById('fe-pri').value = p.priority;
  document.getElementById('fe-hrs').value = p.estimatedHours;
  document.getElementById('fe-start').value = p.startDate;
  document.getElementById('fe-dl').value = p.deadline;
  openM('proj-modal');
}

async function saveProj() {
  const name = document.getElementById('fe-name').value.trim();
  const desc = document.getElementById('fe-desc').value.trim();
  const pri  = parseInt(document.getElementById('fe-pri').value);
  const hrs  = parseFloat(document.getElementById('fe-hrs').value);
  const sd   = document.getElementById('fe-start').value;
  const dl   = document.getElementById('fe-dl').value;

  if (!name) { toast('Informe o nome do projeto.', 'err'); return; }
  if (!hrs || hrs <= 0) { toast('Informe horas estimadas válidas.', 'err'); return; }
  if (!dl) { toast('Informe o prazo de entrega.', 'err'); return; }
  if (dl < sd) { toast('O prazo não pode ser anterior à data de início.', 'err'); return; }

  const eid = document.getElementById('fe-id').value;
  try {
    if (eid) {
      const p = { ...STORE.getProject(eid), name, description: desc, priority: pri, estimatedHours: hrs, startDate: sd, deadline: dl };
      await STORE.saveProject(p);
      await STORE.pushActivity(`atualizou "${name}"`);
      toast('Projeto atualizado!', 'ok');
    } else {
      const p = {
        id: genId(), name, description: desc, priority: pri,
        estimatedHours: hrs, startDate: sd, deadline: dl,
        status: 'pending', sessions: [], activeSessionStart: null,
        createdAt: Date.now()
      };
      await STORE.saveProject(p);
      await STORE.pushActivity(`criou projeto "${name}"`);
      toast('Projeto criado! 🎉', 'ok');
    }
    closeM('proj-modal');
  } catch (e) {
    toast('Erro ao salvar: ' + e.message, 'err');
  }
}

async function startWork(id) {
  if (!STORE.canEdit()) { toast('Sem permissão.', 'warn'); return; }
  const now = Date.now();
  const cur = STORE.currentProjects().find(p => p.activeSessionStart && p.id !== id);
  if (cur) {
    const paused = {
      ...cur,
      sessions: [...(cur.sessions || []), { start: cur.activeSessionStart, end: now }],
      activeSessionStart: null, status: 'paused'
    };
    await STORE.saveProject(paused);
    await STORE.pushActivity(`pausou "${cur.name}"`);
  }
  const p = STORE.getProject(id);
  if (!p || p.status === 'completed') return;
  if (p.activeSessionStart) { toast('Você já está trabalhando neste projeto.', 'info'); return; }

  await STORE.saveProject({ ...p, activeSessionStart: now, status: 'active' });
  await STORE.pushActivity(`iniciou "${p.name}"`);
  toast(`▶ Trabalhando em "${p.name}"`, 'ok');
  closeM('det-modal');
  startTick();
}

async function pauseActive() {
  const now = Date.now();
  const active = STORE.currentProjects().find(p => p.activeSessionStart);
  if (!active) return;
  const bh = bizHours(active.activeSessionStart, now);
  await STORE.saveProject({
    ...active,
    sessions: [...(active.sessions || []), { start: active.activeSessionStart, end: now }],
    activeSessionStart: null, status: 'paused'
  });
  await STORE.pushActivity(`pausou "${active.name}" (${bh.toFixed(2)}h úteis)`);
  toast(`"${active.name}" pausado. ⏸`, 'warn');
}

async function completeProj(id) {
  const p = STORE.getProject(id);
  if (!p) return;
  const now = Date.now();
  let sessions = p.sessions || [];
  if (p.activeSessionStart) sessions = [...sessions, { start: p.activeSessionStart, end: now }];
  await STORE.saveProject({ ...p, status: 'completed', activeSessionStart: null, sessions, completedAt: now });
  await STORE.pushActivity(`concluiu "${p.name}"`);
  toast(`"${p.name}" concluído! 🎉`, 'ok');
  closeM('det-modal');
}

async function delProj(id) {
  const p = STORE.getProject(id);
  if (!p) return;
  closeM('det-modal');
  cfmDialog(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`, async () => {
    await STORE.removeProject(id);
    await STORE.pushActivity(`excluiu "${p.name}"`);
    toast('Projeto excluído.', 'info');
  });
}

async function moveProjectAction() {
  const sel = document.querySelector('input[name="move-target"]:checked');
  if (!sel || !_movingProjId) { toast('Selecione um workspace de destino.', 'err'); return; }
  const targetWsId = sel.value;
  const projId = _movingProjId;
  const p = STORE.getProject(projId);
  const sourceWsName = STORE.current()?.name;
  const targetWsName = STORE.workspaces[targetWsId]?.name;
  try {
    await STORE.pushActivity(`moveu "${p.name}" para "${targetWsName}"`);
    await STORE.moveProject(projId, targetWsId);
    closeM('move-proj-modal');
    closeM('det-modal');
    toast(`"${p.name}" movido para "${targetWsName}".`, 'ok');
    _movingProjId = null;
    // Log no workspace de destino também (assina antes de mudar contexto)
    const prevWs = STORE.currentWsId;
    STORE.currentWsId = targetWsId;
    try { await STORE.pushActivity(`recebeu "${p.name}" de "${sourceWsName}"`); } catch {}
    STORE.currentWsId = prevWs;
  } catch (e) {
    toast('Erro ao mover: ' + e.message, 'err');
  }
}

// ── Workspace actions ────────────────────────────────────────
function openNewWs() {
  document.getElementById('new-ws-name').value = '';
  openM('new-ws-modal');
  setTimeout(() => document.getElementById('new-ws-name').focus(), 120);
}

async function createWsAction() {
  const name = document.getElementById('new-ws-name').value.trim();
  if (!name) { toast('Informe o nome do workspace.', 'err'); return; }
  try {
    const wsId = await STORE.createWorkspace(name);
    closeM('new-ws-modal');
    toast('Workspace criado!', 'ok');
    setTimeout(() => STORE.switchTo(wsId), 300);
  } catch (e) {
    toast('Erro ao criar: ' + e.message, 'err');
  }
}

function openWsSettings() {
  const ws = STORE.current();
  if (!ws) return;
  if (!STORE.isOwner() && !STORE.isSuperAdmin()) {
    toast('Apenas o Owner pode editar o workspace.', 'warn');
    return;
  }
  document.getElementById('ws-set-name').value = ws.name;
  document.getElementById('ws-set-type').textContent = ws.type === 'personal' ? 'Pessoal' : 'Compartilhado';
  document.getElementById('ws-set-deleted').style.display = (ws.type === 'personal') ? 'none' : 'block';
  openM('ws-settings-modal');
}

async function renameWsAction() {
  const ws = STORE.current();
  if (!ws) return;
  const name = document.getElementById('ws-set-name').value.trim();
  if (!name) { toast('Nome inválido.', 'err'); return; }
  try {
    await STORE.renameWorkspace(ws.id, name);
    toast('Workspace renomeado.', 'ok');
    closeM('ws-settings-modal');
  } catch (e) {
    toast('Erro: ' + e.message, 'err');
  }
}

function deleteWsAction() {
  const ws = STORE.current();
  if (!ws) return;
  if (ws.type === 'personal') { toast('Workspace pessoal não pode ser apagado.', 'warn'); return; }
  cfmDialog(`Excluir o workspace "${ws.name}"? Todos os projetos dele serão perdidos.`, async () => {
    try {
      await STORE.deleteWorkspace(ws.id);
      closeM('ws-settings-modal');
      toast('Workspace excluído.', 'info');
    } catch (e) {
      toast('Erro ao excluir: ' + e.message, 'err');
    }
  });
}

// ── Member actions ───────────────────────────────────────────
function openMemberAdd() {
  if (!STORE.canManage()) { toast('Sem permissão.', 'warn'); return; }
  document.getElementById('member-email').value = '';
  document.getElementById('member-role').value = 'member';
  openM('member-add-modal');
  setTimeout(() => document.getElementById('member-email').focus(), 120);
}

async function addMemberAction() {
  const ws = STORE.current();
  if (!ws) return;
  const email = document.getElementById('member-email').value.trim();
  const role = document.getElementById('member-role').value;
  if (!email || !email.includes('@')) { toast('E-mail inválido.', 'err'); return; }
  if (!ROLES.includes(role) || role === 'owner') { toast('Papel inválido.', 'err'); return; }
  try {
    const immediate = await STORE.addMember(ws.id, email, role);
    closeM('member-add-modal');
    toast(immediate
      ? `${email} adicionado como ${ROLE_LABELS[role]}.`
      : `Convite enviado a ${email}. Vira membro no próximo login.`, 'ok');
    renderMembers();
  } catch (e) {
    toast('Erro: ' + e.message, 'err');
  }
}

async function changeRole(wsId, uid, role) {
  try {
    await STORE.changeMemberRole(wsId, uid, role);
    toast(`Papel alterado para ${ROLE_LABELS[role]}.`, 'ok');
  } catch (e) {
    toast('Erro: ' + e.message, 'err');
    renderMembers();
  }
}

function removeMemberAction(wsId, uid, name) {
  cfmDialog(`Remover ${name} deste workspace?`, async () => {
    try {
      await STORE.removeMember(wsId, uid);
      toast('Membro removido.', 'info');
    } catch (e) {
      toast('Erro: ' + e.message, 'err');
    }
  });
}

async function cancelInviteAction(wsId, ekey) {
  try {
    await STORE.cancelInvite(wsId, ekey);
    toast('Convite cancelado.', 'info');
  } catch (e) {
    toast('Erro: ' + e.message, 'err');
  }
}

// ── Super admin actions ──────────────────────────────────────
async function addAllowedEmail() {
  const inp = document.getElementById('sa-add-email');
  const email = (inp?.value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) { toast('E-mail inválido.', 'err'); return; }
  try {
    await db.ref('ft_access/allowedEmails/' + emailKey(email)).set(email);
    inp.value = '';
    toast(`${email} adicionado.`, 'ok');
    renderSuperAdminPanel();
  } catch (e) {
    toast('Erro: ' + e.message, 'err');
  }
}

async function removeAllowedEmail(ek) {
  try {
    await db.ref('ft_access/allowedEmails/' + ek).remove();
    toast('E-mail removido.', 'info');
    renderSuperAdminPanel();
  } catch (e) {
    toast('Erro: ' + e.message, 'err');
  }
}

async function revokeSuperAdmin(uid) {
  cfmDialog('Revogar super admin deste usuário?', async () => {
    try {
      await db.ref('ft_access/superAdmins/' + uid).remove();
      toast('Super admin revogado.', 'info');
      renderSuperAdminPanel();
    } catch (e) {
      toast('Erro: ' + e.message, 'err');
    }
  });
}

// ── Profile ──────────────────────────────────────────────────
function openProfileModal() {
  if (!STORE.user) return;
  document.getElementById('prof-name').value = STORE.user.displayName || '';
  document.getElementById('prof-email').textContent = STORE.user.email;
  openM('profile-modal');
}

async function saveProfileAction() {
  const name = document.getElementById('prof-name').value.trim();
  if (!name) { toast('Nome inválido.', 'err'); return; }
  await updateProfileName(name);
  closeM('profile-modal');
}

// ── Settings (work hours + PIN) ──────────────────────────────
function loadCfgForm() {
  const s = document.getElementById('cfg-start');
  const e = document.getElementById('cfg-end');
  if (s) s.value = `${z(CFG.workStart)}:00`;
  if (e) e.value = `${z(CFG.workEnd)}:00`;
  document.querySelectorAll('#cfg-days input').forEach(cb => {
    cb.checked = CFG.workDays.includes(parseInt(cb.value));
  });

  const pinEl = document.getElementById('pin-status-info');
  if (pinEl) {
    pinEl.innerHTML = getPin()
      ? `<span style="color:var(--ok)">🔒 PIN ativo</span> — Configurações protegidas localmente.`
      : `<span style="color:var(--txt3)">🔓 Sem PIN</span> — Configurações desprotegidas no seu navegador.`;
  }
  const pn = document.getElementById('pin-new');
  const pc = document.getElementById('pin-confirm');
  if (pn) pn.value = '';
  if (pc) pc.value = '';
}

function savePinCfg() {
  const pn = document.getElementById('pin-new').value.trim();
  const pc = document.getElementById('pin-confirm').value.trim();
  if (!/^\d{4}$/.test(pn))  { toast('O PIN deve ter exatamente 4 dígitos.', 'err'); return; }
  if (pn !== pc)            { toast('Os PINs não coincidem.', 'err'); return; }
  localStorage.setItem(PIN_KEY, pn);
  pinUnlock();
  toast('PIN salvo.', 'ok');
  loadCfgForm();
}

function removePinCfg() {
  localStorage.removeItem(PIN_KEY);
  pinLockout();
  toast('PIN removido.', 'warn');
  loadCfgForm();
}

function saveWorkCfg() {
  const s = parseInt(document.getElementById('cfg-start').value.split(':')[0]);
  const e = parseInt(document.getElementById('cfg-end').value.split(':')[0]);
  if (e <= s) { toast('O fim deve ser após o início.', 'err'); return; }
  const days = [];
  document.querySelectorAll('#cfg-days input:checked').forEach(cb => days.push(parseInt(cb.value)));
  if (days.length === 0) { toast('Selecione ao menos um dia útil.', 'err'); return; }
  CFG = { workStart: s, workEnd: e, workDays: days };
  localStorage.setItem('ft_cfg', JSON.stringify(CFG));
  toast('Configuração salva!', 'ok');
  onData();
}

// ── Alertas ──────────────────────────────────────────────────
function checkAlerts() {
  const now = Date.now();
  const atRisk = STORE.currentProjects().filter(p => {
    if (p.status === 'completed') return false;
    return ['danger', 'critical', 'overdue'].includes(calcSLA(p, now).status);
  });
  if (atRisk.length > 0) toast(`⚠ ${atRisk.length} projeto(s) com SLA em risco!`, 'warn');
  updateBadge();
  setInterval(updateBadge, 60000);
}

// ── Atalhos ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['proj-modal', 'det-modal', 'cfm-modal', 'new-ws-modal', 'ws-settings-modal', 'member-add-modal', 'profile-modal', 'move-proj-modal'].forEach(closeM);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openNew(); }
});

// ── Boot trigger ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initApp);
