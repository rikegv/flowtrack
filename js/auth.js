// ─────────────────────────────────────────────────────────────
// FlowTrack — Autenticação (Google Sign-In) + Setup do usuário
// ─────────────────────────────────────────────────────────────

// ── PIN protection (mantido para Configurações) ──────────────
let _pinBuffer = '';
let _pinCallback = null;

function getPin()        { return localStorage.getItem(PIN_KEY) || null; }
function isPinUnlocked() { return sessionStorage.getItem(PIN_SESS_KEY) === '1'; }
function pinUnlock()     { sessionStorage.setItem(PIN_SESS_KEY, '1'); }
function pinLockout()    { sessionStorage.removeItem(PIN_SESS_KEY); }

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
        void errEl.offsetHeight;
        errEl.style.animation = 'shake .3s ease';
      }
    }, 120);
  }
}

function pinBack()   { if (_pinBuffer.length) { _pinBuffer = _pinBuffer.slice(0, -1); _updatePinDots(); } }
function pinCancel() { _pinBuffer = ''; _pinCallback = null; document.getElementById('pin-overlay').style.display = 'none'; }

function _updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById('pd' + i);
    if (dot) dot.classList.toggle('filled', i < _pinBuffer.length);
  }
}

// ── Google Sign-In ───────────────────────────────────────────
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  const btn = document.getElementById('signin-google-btn');
  if (btn) btn.disabled = true;
  try {
    await auth.signInWithPopup(provider);
    // O onAuthStateChanged em app.js cuida do resto
  } catch (e) {
    console.error('Sign-in failed:', e);
    const err = document.getElementById('signin-error');
    if (err) {
      err.textContent = 'Falha no login: ' + (e.message || e.code || 'desconhecido');
      err.style.display = 'block';
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function signOutUser() {
  try {
    STORE.stopSync();
    await auth.signOut();
  } catch (e) { console.warn(e); }
  // Limpa estado local sensível (mantém preferências de UI)
  sessionStorage.removeItem(PIN_SESS_KEY);
  localStorage.removeItem(CURRENT_WS_KEY);
  location.reload();
}

// ── Fluxo pós sign-in: garante perfil, super admin, workspace pessoal ──
async function onUserSignedIn(authUser) {
  const uid = authUser.uid;
  const email = authUser.email;
  if (!email) {
    await auth.signOut();
    throw new Error('Sua conta Google não expôs e-mail.');
  }
  const ekey = emailKey(email);

  // 1. Verifica whitelist (allowedEmails) ou semente de super admin
  const [allowedSnap, seedSnap, existingSAsnap] = await Promise.all([
    db.ref('ft_access/allowedEmails/' + ekey).once('value'),
    db.ref('ft_access/seedSuperAdmin').once('value'),
    db.ref('ft_access/superAdmins/' + uid).once('value'),
  ]);
  const isSeedSA      = seedSnap.val() === email;
  const isAlreadySA   = existingSAsnap.exists();
  const isAllowed     = allowedSnap.exists() || isSeedSA || isAlreadySA;

  if (!isAllowed) {
    await auth.signOut();
    showAccessDenied(email);
    throw new Error('not_authorized');
  }

  // 2. Reverse index email -> uid (para resolver convites futuros)
  try { await db.ref('emailToUid/' + ekey).set(uid); } catch (e) { console.warn('emailToUid set failed', e); }

  // 3. Claim de super admin (se houver semente)
  let isSuperAdmin = isAlreadySA;
  if (isSeedSA && !isAlreadySA) {
    try {
      await db.ref('ft_access/superAdmins/' + uid).set({ email, grantedAt: Date.now() });
      // Remove semente (uso único)
      await db.ref('ft_access/seedSuperAdmin').remove();
      isSuperAdmin = true;
    } catch (e) {
      console.warn('Super admin claim failed:', e);
    }
  }

  // 4. Carrega/cria perfil
  let userData = (await db.ref('users/' + uid).once('value')).val();
  if (!userData) {
    userData = {
      uid, email, emailKey: ekey,
      displayName: authUser.displayName || email.split('@')[0],
      photoURL: authUser.photoURL || null,
      isSuperAdmin,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      workspaceIds: {}
    };
    await db.ref('users/' + uid).set(userData);
  } else {
    const updates = { lastSeenAt: Date.now(), isSuperAdmin };
    if (!userData.displayName) updates.displayName = authUser.displayName || email.split('@')[0];
    if (!userData.photoURL && authUser.photoURL) updates.photoURL = authUser.photoURL;
    await db.ref('users/' + uid).update(updates);
    userData = { ...userData, ...updates };
  }

  STORE.setUser(userData);

  // 5. Claim de workspace pessoal seedado (migração de dados antigos)
  const seedPersonalSnap = await db.ref('ft_access/seedPersonalWs/' + ekey).once('value');
  const seededWsId = seedPersonalSnap.val();
  if (seededWsId) {
    const wsSnap = await db.ref('workspaces/' + seededWsId).once('value');
    const wsData = wsSnap.val();
    if (wsData && !wsData.ownerUid) {
      const updates = {};
      updates[`workspaces/${seededWsId}/ownerUid`]            = uid;
      updates[`workspaces/${seededWsId}/members/${uid}`]      = 'owner';
      updates[`users/${uid}/workspaceIds/${seededWsId}`]      = 'owner';
      updates[`users/${uid}/personalWsId`]                    = seededWsId;
      await db.ref().update(updates);
      try { await db.ref('ft_access/seedPersonalWs/' + ekey).remove(); } catch (e) {}
      userData.personalWsId = seededWsId;
      userData.workspaceIds = { ...(userData.workspaceIds || {}), [seededWsId]: 'owner' };
    }
  }

  // 6. Garante que o usuário tenha um workspace pessoal
  if (!userData.personalWsId) {
    const wsId = 'ws' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const ws = {
      id: wsId,
      name: 'Pessoal — ' + (userData.displayName || email),
      ownerUid: uid,
      ownerEmail: email,
      type: 'personal',
      createdAt: Date.now(),
      members: { [uid]: 'owner' }
    };
    const updates = {};
    updates[`workspaces/${wsId}`]                = ws;
    updates[`users/${uid}/personalWsId`]         = wsId;
    updates[`users/${uid}/workspaceIds/${wsId}`] = 'owner';
    await db.ref().update(updates);
    userData.personalWsId = wsId;
    userData.workspaceIds = { ...(userData.workspaceIds || {}), [wsId]: 'owner' };
  }

  // 7. Processa convites pendentes
  const pendingSnap = await db.ref('pendingInvitesByEmail/' + ekey).once('value');
  const pending = pendingSnap.val() || {};
  for (const [wsId, role] of Object.entries(pending)) {
    try {
      const updates = {};
      updates[`workspaces/${wsId}/members/${uid}`]   = role;
      updates[`workspaces/${wsId}/invites/${ekey}`]  = null;
      updates[`users/${uid}/workspaceIds/${wsId}`]   = role;
      updates[`pendingInvitesByEmail/${ekey}/${wsId}`] = null;
      await db.ref().update(updates);
    } catch (e) {
      console.warn('Failed to accept invite for', wsId, e);
    }
  }
}

// ── Atualização de perfil ────────────────────────────────────
async function updateProfileName(newName) {
  if (!STORE.user) return;
  const name = String(newName || '').trim().slice(0, 60);
  if (!name) return;
  await db.ref('users/' + STORE.user.uid + '/displayName').set(name);
  STORE.user.displayName = name;
  toast('Nome atualizado!', 'ok');
  if (typeof onData === 'function') onData();
  const sbName = document.getElementById('sb-user-name');
  if (sbName) sbName.textContent = name;
}

// ── Tela de "acesso negado" ──────────────────────────────────
function showAccessDenied(email) {
  document.getElementById('signin-screen').style.display = 'none';
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('app').style.display = 'none';
  const el = document.getElementById('access-denied');
  if (el) {
    el.style.display = 'flex';
    const e = document.getElementById('denied-email');
    if (e) e.textContent = email;
  }
}
