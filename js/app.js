// ─────────────────────────────────────────────────────────────
// FlowTrack — Boot + ações de projeto + configurações + roteamento
// ─────────────────────────────────────────────────────────────

let _tickInterval = null;

// ── Boot ────────────────────────────────────────────────────
async function initApp() {
  initTheme();
  const saved = localStorage.getItem('ft_cfg');
  if (saved) Object.assign(CFG, JSON.parse(saved));

  // Modo "link compartilhado": credenciais embutidas em config.js
  if (EMBEDDED_FB_CFG) {
    localStorage.setItem('ft_fb', JSON.stringify(EMBEDDED_FB_CFG));
    localStorage.setItem('ft_mode', 'firebase');
    document.getElementById('wizard-view').style.display = 'none';
    await STORE.init('firebase', EMBEDDED_FB_CFG);
    const emailOk = await checkEmailAccess();
    if (!emailOk) return;  // gate de e-mail visível, app aguarda
    launchApp();
    return;
  }

  const mode = localStorage.getItem('ft_mode');
  const fbCfg = JSON.parse(localStorage.getItem('ft_fb') || 'null');
  if (!mode) {
    document.getElementById('wizard-view').style.display = 'flex';
  } else {
    document.getElementById('wizard-view').style.display = 'none';
    await STORE.init(mode, fbCfg);
    launchApp();
  }
}

function launchApp() {
  document.getElementById('app').style.display = 'grid';
  loadCfgForm();
  onData();
  startClock();
  startTick();
  setTimeout(checkAlerts, 2500);

  const email = getVerifiedEmail();
  const sbEmail = document.getElementById('sb-email');
  if (sbEmail && email) {
    sbEmail.textContent = '👤 ' + email;
    sbEmail.style.display = 'block';
  }

  const navUsers = document.getElementById('nav-users');
  if (navUsers) navUsers.style.display = STORE.mode === 'firebase' ? 'flex' : 'none';
}

async function startApp() {
  const isFirebase = document.getElementById('opt-firebase').classList.contains('sel');
  let fbCfg = null;
  if (isFirebase) {
    fbCfg = {
      apiKey:      document.getElementById('wb-apiKey').value.trim(),
      databaseURL: document.getElementById('wb-dbUrl').value.trim(),
      projectId:   document.getElementById('wb-projId').value.trim(),
    };
    if (!fbCfg.apiKey || !fbCfg.databaseURL) {
      toast('Preencha API Key e Database URL.', 'err');
      return;
    }
    localStorage.setItem('ft_fb', JSON.stringify(fbCfg));
  }
  localStorage.setItem('ft_mode', isFirebase ? 'firebase' : 'local');
  document.getElementById('wizard-view').style.display = 'none';
  await STORE.init(isFirebase ? 'firebase' : 'local', fbCfg);
  launchApp();
}

function selMode(m) {
  document.getElementById('opt-local').classList.toggle('sel',    m === 'local');
  document.getElementById('opt-firebase').classList.toggle('sel', m === 'firebase');
  document.getElementById('wiz-fb-cfg').style.display = m === 'firebase' ? 'block' : 'none';
}

// ── Relógio e ticker ────────────────────────────────────────
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
    if (dg) dg.textContent = `${greet}, Rike 👋`;
    const dd = document.getElementById('dash-date');
    if (dd) {
      const mon = MONTHS_PT[now.getMonth()];
      dd.textContent = `${DAYS_PT[now.getDay()]}, ${now.getDate()} de ${mon.charAt(0).toUpperCase()+mon.slice(1)} de ${now.getFullYear()}`;
    }
    const mode = localStorage.getItem('ft_mode') || 'local';
    const sbMode = document.getElementById('sb-mode');
    if (sbMode) sbMode.innerHTML = mode === 'firebase'
      ? '<span style="color:var(--ok)">●</span> Firebase (compartilhado)'
      : '<span style="color:var(--txt3)">○</span> Local';
  };
  tick();
  setInterval(tick, 60000);
}

function startTick() {
  if (_tickInterval) clearInterval(_tickInterval);
  _tickInterval = setInterval(() => {
    const active = STORE.all().find(p => p.activeSessionStart && p.status !== 'completed');
    if (active) {
      const dur = Date.now() - active.activeSessionStart;
      const s = fmtDur(dur);
      ['sb-timer-val', 'ban-timer', 'rpa-timer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = s;
      });
      updateRPActive(active);
    }
  }, 1000);
}

// ── Ações de projeto ────────────────────────────────────────
function genId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function openNew() {
  document.getElementById('fm-title').textContent = 'Novo Projeto';
  document.getElementById('fm-sub').textContent = 'Preencha as informações do projeto';
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
  closeM('det-modal');
  const p = STORE.get(id);
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
  if (eid) {
    const p = { ...STORE.get(eid), name, description: desc, priority: pri, estimatedHours: hrs, startDate: sd, deadline: dl };
    await STORE.save(p);
    ACTIVITY.push(`Projeto "${name}" atualizado.`);
    toast('Projeto atualizado!', 'ok');
  } else {
    const p = {
      id: genId(), name, description: desc, priority: pri,
      estimatedHours: hrs, startDate: sd, deadline: dl,
      status: 'pending', sessions: [], activeSessionStart: null,
      createdAt: Date.now()
    };
    await STORE.save(p);
    ACTIVITY.push(`Projeto "${name}" criado.`);
    toast('Projeto criado com sucesso! 🎉', 'ok');
  }
  closeM('proj-modal');
  onData();
}

async function startWork(id) {
  const now = Date.now();
  const cur = STORE.all().find(p => p.activeSessionStart && p.id !== id);
  if (cur) {
    const paused = {
      ...cur,
      sessions: [...(cur.sessions || []), { start: cur.activeSessionStart, end: now }],
      activeSessionStart: null, status: 'paused'
    };
    await STORE.save(paused);
    ACTIVITY.push(`"${cur.name}" pausado.`);
    toast(`"${cur.name}" pausado. SLA congelada.`, 'warn');
  }
  const p = STORE.get(id);
  if (!p || p.status === 'completed') return;
  if (p.activeSessionStart) { toast('Você já está trabalhando neste projeto.', 'info'); return; }

  const updated = { ...p, activeSessionStart: now, status: 'active' };
  await STORE.save(updated);
  ACTIVITY.push(`Iniciou trabalho em "${p.name}".`);
  toast(`▶ Trabalhando em "${p.name}"`, 'ok');
  closeM('det-modal');
  onData();
  startTick();
}

async function pauseActive() {
  const now = Date.now();
  const active = STORE.all().find(p => p.activeSessionStart);
  if (!active) return;
  const bh = bizHours(active.activeSessionStart, now);
  const updated = {
    ...active,
    sessions: [...(active.sessions || []), { start: active.activeSessionStart, end: now }],
    activeSessionStart: null, status: 'paused'
  };
  await STORE.save(updated);
  ACTIVITY.push(`"${active.name}" pausado (${bh.toFixed(2)}h úteis).`);
  toast(`"${active.name}" pausado. SLA congelada. ⏸`, 'warn');
  onData();
}

async function completeProj(id) {
  const p = STORE.get(id);
  if (!p) return;
  const now = Date.now();
  let sessions = p.sessions || [];
  if (p.activeSessionStart) sessions = [...sessions, { start: p.activeSessionStart, end: now }];
  const updated = { ...p, status: 'completed', activeSessionStart: null, sessions, completedAt: now };
  await STORE.save(updated);
  ACTIVITY.push(`"${p.name}" concluído! ✓`);
  toast(`"${p.name}" concluído! 🎉`, 'ok');
  closeM('det-modal');
  onData();
}

async function delProj(id) {
  const p = STORE.get(id);
  if (!p) return;
  closeM('det-modal');
  cfmDialog(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`, async () => {
    await STORE.remove(id);
    ACTIVITY.push(`"${p.name}" excluído.`);
    toast('Projeto excluído.', 'info');
    onData();
  });
}

// ── Configurações ───────────────────────────────────────────
function loadCfgForm() {
  const s = document.getElementById('cfg-start');
  const e = document.getElementById('cfg-end');
  if (s) s.value = `${z(CFG.workStart)}:00`;
  if (e) e.value = `${z(CFG.workEnd)}:00`;
  document.querySelectorAll('#cfg-days input').forEach(cb => {
    cb.checked = CFG.workDays.includes(parseInt(cb.value));
  });

  const mode  = localStorage.getItem('ft_mode') || 'local';
  const fbCfg = JSON.parse(localStorage.getItem('ft_fb') || 'null');
  const si = document.getElementById('fb-status-info');
  if (si) si.innerHTML = mode === 'firebase' && fbCfg
    ? `<span style="color:var(--ok)">✓ Conectado — Firebase</span> · Projeto: <strong>${esc(fbCfg.projectId || '—')}</strong>`
    : `<span style="color:var(--txt3)">○ Modo local (sem compartilhamento)</span>`;
  if (fbCfg) {
    const sa = document.getElementById('s-apiKey');
    const sd = document.getElementById('s-dbUrl');
    const sp = document.getElementById('s-projId');
    if (sa) sa.value = fbCfg.apiKey || '';
    if (sd) sd.value = fbCfg.databaseURL || '';
    if (sp) sp.value = fbCfg.projectId || '';
  }

  const pinEl = document.getElementById('pin-status-info');
  if (pinEl) {
    pinEl.innerHTML = getPin()
      ? `<span style="color:var(--ok)">🔒 PIN ativo</span> — As configurações estão protegidas. Somente quem tiver o PIN pode acessar.`
      : `<span style="color:var(--txt3)">🔓 Sem PIN</span> — Qualquer pessoa com o link pode acessar as configurações.`;
  }
  const pn = document.getElementById('pin-new');
  const pc = document.getElementById('pin-confirm');
  if (pn) pn.value = '';
  if (pc) pc.value = '';

  const navUsers = document.getElementById('nav-users');
  if (navUsers) navUsers.style.display = STORE.mode === 'firebase' ? 'flex' : 'none';
}

function savePinCfg() {
  const pn = document.getElementById('pin-new').value.trim();
  const pc = document.getElementById('pin-confirm').value.trim();
  if (!/^\d{4}$/.test(pn))  { toast('O PIN deve ter exatamente 4 dígitos numéricos.', 'err'); return; }
  if (pn !== pc)            { toast('Os PINs não coincidem.', 'err'); return; }
  localStorage.setItem(PIN_KEY, pn);
  pinUnlock();
  toast('PIN salvo. As configurações agora estão protegidas.', 'ok');
  loadCfgForm();
}

function removePinCfg() {
  localStorage.removeItem(PIN_KEY);
  pinLockout();
  toast('PIN removido. Configurações sem proteção.', 'warn');
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

async function saveFbCfg() {
  const apiKey      = document.getElementById('s-apiKey').value.trim();
  const databaseURL = document.getElementById('s-dbUrl').value.trim();
  const projectId   = document.getElementById('s-projId').value.trim();
  if (!apiKey || !databaseURL) { toast('Preencha API Key e Database URL.', 'err'); return; }
  const fbCfg = { apiKey, databaseURL, projectId };
  localStorage.setItem('ft_fb', JSON.stringify(fbCfg));
  localStorage.setItem('ft_mode', 'firebase');
  toast('Conectando ao Firebase...', 'info');
  const ok = await STORE.init('firebase', fbCfg);
  if (ok) { toast('Firebase conectado! Dados sincronizando.', 'ok'); loadCfgForm(); onData(); }
  else    { toast('Erro ao conectar. Verifique as configurações.', 'err'); }
}

function discFb() {
  localStorage.setItem('ft_mode', 'local');
  localStorage.removeItem('ft_fb');
  STORE.mode = 'local';
  STORE.fbRef = null;
  toast('Desconectado. Usando modo local.', 'info');
  loadCfgForm();
}

function clearData() {
  cfmDialog('Apagar TODOS os dados locais? Esta ação é irreversível!', () => {
    ['ft_projects','ft_mode','ft_fb','ft_cfg','ft_act','ft_allowed_emails'].forEach(k => localStorage.removeItem(k));
    toast('Dados apagados. Recarregando...', 'info');
    setTimeout(() => location.reload(), 1500);
  });
}

// ── Alertas ─────────────────────────────────────────────────
function checkAlerts() {
  const now = Date.now();
  const atRisk = STORE.all().filter(p => {
    if (p.status === 'completed') return false;
    return ['danger', 'critical', 'overdue'].includes(calcSLA(p, now).status);
  });
  if (atRisk.length > 0) toast(`⚠ ${atRisk.length} projeto(s) com SLA em risco!`, 'warn');
  updateBadge();
  setInterval(updateBadge, 60000);
}

// ── Atalhos de teclado ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') ['proj-modal', 'det-modal', 'cfm-modal'].forEach(closeM);
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); openNew(); }
});

// ── Boot ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initApp);
