// ─────────────────────────────────────────────────────────────
// FlowTrack — Camada de dados (auth + workspaces + projects)
// ─────────────────────────────────────────────────────────────

// Inicializa Firebase imediatamente (vai ser usado por auth.js também)
firebase.initializeApp(FIREBASE_CFG);
const db = firebase.database();
const auth = firebase.auth();

// Helpers de email
function emailKey(e) {
  return String(e || '').toLowerCase().trim().replace(/\./g, '_dot_').replace(/@/g, '_at_');
}

const STORE = {
  user: null,                // { uid, email, emailKey, displayName, photoURL, isSuperAdmin, personalWsId, workspaceIds }
  currentWsId: null,         // workspace selecionado
  workspaces: {},            // { wsId: workspaceData } — assinado ao vivo
  _wsListeners: {},          // { wsId: { ref, cb } }
  _membershipListener: null, // listener no /users/{uid}/workspaceIds

  setUser(user) { this.user = user; },

  // ── Sincronização de membership e workspaces ───────────────
  startSync() {
    if (!this.user) return;
    const ref = db.ref('users/' + this.user.uid + '/workspaceIds');
    this._membershipListener = { ref, cb: ref.on('value', snap => {
      const ids = Object.keys(snap.val() || {});
      this._syncWorkspaceListeners(ids);
    }) };
  },

  stopSync() {
    if (this._membershipListener) {
      this._membershipListener.ref.off('value', this._membershipListener.cb);
      this._membershipListener = null;
    }
    for (const id of Object.keys(this._wsListeners)) {
      const { ref, cb } = this._wsListeners[id];
      ref.off('value', cb);
    }
    this._wsListeners = {};
    this.workspaces = {};
    this.currentWsId = null;
    this.user = null;
  },

  _syncWorkspaceListeners(wsIds) {
    // Adiciona listeners novos
    for (const id of wsIds) {
      if (!this._wsListeners[id]) {
        const ref = db.ref('workspaces/' + id);
        const cb = ref.on('value', snap => {
          const data = snap.val();
          if (data) {
            this.workspaces[id] = data;
          } else {
            delete this.workspaces[id];
          }
          if (typeof onData === 'function') onData();
        }, err => {
          console.warn('Workspace listener error', id, err);
          delete this.workspaces[id];
          if (typeof onData === 'function') onData();
        });
        this._wsListeners[id] = { ref, cb };
      }
    }
    // Remove os que saíram
    for (const id of Object.keys(this._wsListeners)) {
      if (!wsIds.includes(id)) {
        const { ref, cb } = this._wsListeners[id];
        ref.off('value', cb);
        delete this._wsListeners[id];
        delete this.workspaces[id];
      }
    }
    // Seleciona workspace atual
    if (this.currentWsId && !wsIds.includes(this.currentWsId)) {
      this.currentWsId = null;
    }
    if (!this.currentWsId && wsIds.length > 0) {
      const saved = localStorage.getItem(CURRENT_WS_KEY);
      this.currentWsId = wsIds.includes(saved) ? saved : (this.user?.personalWsId && wsIds.includes(this.user.personalWsId) ? this.user.personalWsId : wsIds[0]);
    }
    if (this.currentWsId) localStorage.setItem(CURRENT_WS_KEY, this.currentWsId);
    if (typeof onData === 'function') onData();
  },

  // ── Workspace atual ───────────────────────────────────────
  current() { return this.currentWsId ? this.workspaces[this.currentWsId] : null; },

  switchTo(wsId) {
    if (!this.workspaces[wsId]) return;
    this.currentWsId = wsId;
    localStorage.setItem(CURRENT_WS_KEY, wsId);
    if (typeof onData === 'function') onData();
  },

  list() {
    return Object.values(this.workspaces).filter(w => w && w.id);
  },

  // ── Projetos do workspace atual ───────────────────────────
  currentProjects() {
    const ws = this.current();
    if (!ws || !ws.projects) return [];
    return Object.values(ws.projects).filter(p => p && p.id && p.name);
  },

  getProject(id) {
    const ws = this.current();
    return ws?.projects?.[id] || null;
  },

  async saveProject(p) {
    if (!this.currentWsId) throw new Error('Nenhum workspace selecionado');
    p.workspaceId = this.currentWsId;
    if (!p.createdByUid && this.user) p.createdByUid = this.user.uid;
    await db.ref(`workspaces/${this.currentWsId}/projects/${p.id}`).set(p);
  },

  async removeProject(id) {
    if (!this.currentWsId) return;
    await db.ref(`workspaces/${this.currentWsId}/projects/${id}`).remove();
  },

  // ── Papéis ────────────────────────────────────────────────
  currentRole() {
    const ws = this.current();
    if (!ws || !this.user) return null;
    if (this.user.isSuperAdmin) return 'owner';
    return ws.members?.[this.user.uid] || null;
  },

  isSuperAdmin() { return !!this.user?.isSuperAdmin; },
  isOwner()      { return this.currentRole() === 'owner'; },
  isAdmin()      { const r = this.currentRole(); return r === 'owner' || r === 'admin'; },
  canEdit()      { const r = this.currentRole(); return r === 'owner' || r === 'admin' || r === 'member'; },
  canManage()    { const r = this.currentRole(); return r === 'owner' || r === 'admin'; },

  // ── Log de atividade (por workspace) ──────────────────────
  async pushActivity(msg) {
    if (!this.currentWsId || !this.user) return;
    const entry = {
      actorUid: this.user.uid,
      actorName: this.user.displayName || this.user.email || 'usuário',
      msg, ts: Date.now()
    };
    try {
      await db.ref(`workspaces/${this.currentWsId}/activity`).push(entry);
    } catch (e) {
      console.warn('Activity push failed:', e);
    }
  },

  recentActivity() {
    const ws = this.current();
    if (!ws?.activity) return [];
    return Object.entries(ws.activity)
      .map(([k, v]) => ({ ...v, _key: k }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
      .slice(0, 30);
  },

  // ── Workspace CRUD ────────────────────────────────────────
  async createWorkspace(name) {
    if (!this.user) throw new Error('not_authenticated');
    const wsId = 'ws' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const ws = {
      id: wsId,
      name: String(name || 'Novo workspace').slice(0, 80),
      ownerUid: this.user.uid,
      ownerEmail: this.user.email,
      type: 'shared',
      createdAt: Date.now(),
      members: { [this.user.uid]: 'owner' }
    };
    const updates = {};
    updates[`workspaces/${wsId}`] = ws;
    updates[`users/${this.user.uid}/workspaceIds/${wsId}`] = 'owner';
    await db.ref().update(updates);
    return wsId;
  },

  async renameWorkspace(wsId, name) {
    await db.ref(`workspaces/${wsId}/name`).set(String(name).slice(0, 80));
  },

  async deleteWorkspace(wsId) {
    const ws = this.workspaces[wsId];
    if (!ws) return;
    const updates = {};
    updates[`workspaces/${wsId}`] = null;
    for (const uid of Object.keys(ws.members || {})) {
      updates[`users/${uid}/workspaceIds/${wsId}`] = null;
    }
    await db.ref().update(updates);
  },

  // ── Members CRUD ──────────────────────────────────────────
  async addMember(wsId, email, role) {
    const ekey = emailKey(email);
    const uidSnap = await db.ref('emailToUid/' + ekey).once('value');
    const targetUid = uidSnap.val();
    const updates = {};
    if (targetUid) {
      updates[`workspaces/${wsId}/members/${targetUid}`] = role;
      updates[`users/${targetUid}/workspaceIds/${wsId}`] = role;
    } else {
      updates[`pendingInvitesByEmail/${ekey}/${wsId}`] = role;
      updates[`workspaces/${wsId}/invites/${ekey}`] = { email, role };
    }
    await db.ref().update(updates);
    return !!targetUid;
  },

  async changeMemberRole(wsId, uid, role) {
    const updates = {};
    updates[`workspaces/${wsId}/members/${uid}`] = role;
    updates[`users/${uid}/workspaceIds/${wsId}`] = role;
    await db.ref().update(updates);
  },

  async removeMember(wsId, uid) {
    const updates = {};
    updates[`workspaces/${wsId}/members/${uid}`] = null;
    updates[`users/${uid}/workspaceIds/${wsId}`] = null;
    await db.ref().update(updates);
  },

  async cancelInvite(wsId, ekey) {
    const updates = {};
    updates[`workspaces/${wsId}/invites/${ekey}`] = null;
    updates[`pendingInvitesByEmail/${ekey}/${wsId}`] = null;
    await db.ref().update(updates);
  },

  // ── Lookup de usuário (cache local) ───────────────────────
  _userCache: {},
  async loadUser(uid) {
    if (this._userCache[uid]) return this._userCache[uid];
    try {
      const snap = await db.ref('users/' + uid).once('value');
      const u = snap.val();
      if (u) this._userCache[uid] = u;
      return u;
    } catch {
      return null;
    }
  },
};
