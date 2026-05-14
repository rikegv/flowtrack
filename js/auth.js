// ─────────────────────────────────────────────────────────────
// FlowTrack — PIN + Gate de e-mail + Whitelist
// ─────────────────────────────────────────────────────────────

// ── PIN de 4 dígitos ─────────────────────────────────────────
let _pinBuffer = '';
let _pinCallback = null;

function getPin()          { return localStorage.getItem(PIN_KEY) || null; }
function isPinUnlocked()   { return sessionStorage.getItem(PIN_SESS_KEY) === '1'; }
function pinUnlock()       { sessionStorage.setItem(PIN_SESS_KEY, '1'); }
function pinLockout()      { sessionStorage.removeItem(PIN_SESS_KEY); }

function requirePin(cb) {
  const pin = getPin();
  if (!pin || isPinUnlocked()) { cb(); return; }
  _pinBuffer = '';
  _pinCallback = cb;
  _updatePinDots();
  document.getElementById('pin-error').style.display = 'none';
  document.getElementById('pin-overlay').style.display = 'flex';
}

function pinKey(d) {
  if (_pinBuffer.length >= 4) return;
  _pinBuffer += d;
  _updatePinDots();
  if (_pinBuffer.length === 4) {
    setTimeout(() => {
      if (_pinBuffer === getPin()) {
        pinUnlock();
        document.getElementById('pin-overlay').style.display = 'none';
        _pinBuffer = '';
        if (_pinCallback) { _pinCallback(); _pinCallback = null; }
      } else {
        const errEl = document.getElementById('pin-error');
        errEl.style.display = 'block';
        _pinBuffer = '';
        _updatePinDots();
        errEl.style.animation = 'none';
        // força reflow para reiniciar a animação de shake
        void errEl.offsetHeight;
        errEl.style.animation = 'shake .3s ease';
      }
    }, 120);
  }
}

function pinBack() {
  if (_pinBuffer.length > 0) {
    _pinBuffer = _pinBuffer.slice(0, -1);
    _updatePinDots();
  }
}

function pinCancel() {
  _pinBuffer = '';
  _pinCallback = null;
  document.getElementById('pin-overlay').style.display = 'none';
}

function _updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    if (dot) dot.classList.toggle('filled', i < _pinBuffer.length);
  }
}

// ── Gate de e-mail (whitelist) ───────────────────────────────
function isEmailVerified()      { return !!sessionStorage.getItem(SESS_EMAIL_KEY); }
function setEmailVerified(e)    { sessionStorage.setItem(SESS_EMAIL_KEY, e); }
function getVerifiedEmail()     { return sessionStorage.getItem(SESS_EMAIL_KEY) || ''; }
function emailKey(e) {
  return e.toLowerCase().trim().replace(/\./g, '_dot_').replace(/@/g, '_at_');
}

async function loadAllowedEmails() {
  if (STORE.mode === 'firebase' && STORE.fbRef) {
    return new Promise(res => {
      STORE.fbRef.child(ACCESS_PATH).once('value', snap => res(snap.val() || {}));
    });
  }
  return JSON.parse(localStorage.getItem('ft_allowed_emails') || '{}');
}

async function isEmailAllowed(email) {
  const list = await loadAllowedEmails();
  if (Object.keys(list).length === 0) return true;     // lista vazia = aberto
  return !!list[emailKey(email)];
}

async function checkEmailAccess() {
  if (isEmailVerified()) return true;
  const list = await loadAllowedEmails();
  if (Object.keys(list).length === 0) return true;
  document.getElementById('email-gate').style.display = 'flex';
  return false;
}

async function gateSubmit() {
  const email = document.getElementById('gate-email').value.trim();
  const err = document.getElementById('gate-error');
  if (!email || !email.includes('@')) {
    err.textContent = 'Digite um e-mail válido.';
    err.style.display = 'block';
    return;
  }
  err.style.display = 'none';
  const ok = await isEmailAllowed(email);
  if (ok) {
    setEmailVerified(email);
    document.getElementById('email-gate').style.display = 'none';
    launchApp();
  } else {
    err.textContent = 'E-mail não autorizado. Solicite acesso ao administrador.';
    err.style.display = 'block';
  }
}

// ── Administração da whitelist ───────────────────────────────
async function addAllowedEmail() {
  const input = document.getElementById('add-email-input');
  const email = (input.value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) { toast('E-mail inválido.', 'err'); return; }
  const key = emailKey(email);
  if (STORE.mode === 'firebase' && STORE.fbRef) {
    await STORE.fbRef.child(`${ACCESS_PATH}/${key}`).set(email);
  } else {
    const list = JSON.parse(localStorage.getItem('ft_allowed_emails') || '{}');
    list[key] = email;
    localStorage.setItem('ft_allowed_emails', JSON.stringify(list));
  }
  input.value = '';
  toast(`${email} adicionado!`, 'ok');
  renderAllowedEmails();
}

async function removeAllowedEmail(key) {
  if (STORE.mode === 'firebase' && STORE.fbRef) {
    await STORE.fbRef.child(`${ACCESS_PATH}/${key}`).remove();
  } else {
    const list = JSON.parse(localStorage.getItem('ft_allowed_emails') || '{}');
    delete list[key];
    localStorage.setItem('ft_allowed_emails', JSON.stringify(list));
  }
  toast('E-mail removido.', 'warn');
  renderAllowedEmails();
}

async function renderAllowedEmails() {
  const list = await loadAllowedEmails();
  const el = document.getElementById('allowed-emails-list');
  if (!el) return;
  const keys = Object.keys(list);
  const restricted = keys.length > 0;

  const uTotal   = document.getElementById('u-stat-total');
  const uMode    = document.getElementById('u-stat-mode');
  const uModeLbl = document.getElementById('u-stat-mode-lbl');
  const uEmail   = document.getElementById('u-stat-email');
  const uCount   = document.getElementById('u-list-count');
  if (uTotal)   uTotal.textContent   = keys.length;
  if (uMode)    uMode.textContent    = restricted ? '🔒' : '🌍';
  if (uModeLbl) uModeLbl.textContent = restricted ? 'Restrito' : 'Aberto';
  if (uEmail)   uEmail.textContent   = getVerifiedEmail() || '(admin)';
  if (uCount)   uCount.textContent   = keys.length > 0
    ? `${keys.length} usuário${keys.length > 1 ? 's' : ''}`
    : 'Lista vazia';

  el.innerHTML = keys.length === 0
    ? `<div style="color:var(--txt3);font-size:13px;text-align:center;padding:28px 12px">
         <div style="font-size:32px;margin-bottom:10px;opacity:.35">👥</div>
         Nenhum e-mail cadastrado.<br>
         <span style="font-size:12px">Com a lista vazia, qualquer pessoa com o link pode acessar.</span>
       </div>`
    : keys.map(k => `
      <div style="display:flex;align-items:center;gap:12px;background:var(--s3);border:1px solid var(--b1);border-radius:9px;padding:11px 14px">
        <div style="width:32px;height:32px;border-radius:50%;background:rgba(37,99,235,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accentL)"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <span style="flex:1;font-size:13px;font-weight:500;color:var(--txt)">${esc(list[k])}</span>
        <span style="font-size:11px;color:var(--ok);background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);border-radius:20px;padding:2px 9px;font-weight:600">Ativo</span>
        <button onclick="removeAllowedEmail('${k}')" class="btn btn-danger btn-sm" style="padding:4px 10px;font-size:11px">Remover</button>
      </div>`).join('');
}
