// ─────────────────────────────────────────────────────────────
// FlowTrack — Camada de dados (STORE + ACTIVITY)
// ─────────────────────────────────────────────────────────────
//
// STORE.fbRef aponta para a RAIZ do database, não para /projects.
// Os projetos vivem em /projects e a whitelist em /ft_access/emails.
// Manter namespaces separados evita que entradas administrativas
// apareçam na listagem de projetos (bug original).

const STORE = {
  mode: 'local',
  fbRef: null,        // referência para a raiz quando em modo firebase
  projects: {},

  async init(mode, fbCfg) {
    this.mode = mode;
    if (mode === 'firebase' && fbCfg?.apiKey) {
      try {
        if (!firebase.apps.length) firebase.initializeApp(fbCfg);
        this.fbRef = firebase.database().ref();
        this.fbRef.child('projects').on('value', snap => {
          this.projects = snap.val() || {};
          if (typeof onData === 'function') onData();
        });
        return true;
      } catch (e) {
        console.error('Firebase init falhou:', e);
        return false;
      }
    }
    this.projects = JSON.parse(localStorage.getItem('ft_projects') || '{}');
    return true;
  },

  async save(p) {
    this.projects[p.id] = p;
    if (this.mode === 'firebase' && this.fbRef) {
      await this.fbRef.child(`projects/${p.id}`).set(p);
    } else {
      localStorage.setItem('ft_projects', JSON.stringify(this.projects));
    }
  },

  async remove(id) {
    delete this.projects[id];
    if (this.mode === 'firebase' && this.fbRef) {
      await this.fbRef.child(`projects/${id}`).remove();
    } else {
      localStorage.setItem('ft_projects', JSON.stringify(this.projects));
    }
  },

  // Filtra qualquer entrada inválida que possa ter sobrado em /projects
  // (defesa contra dados legados gravados em path errado).
  all() {
    return Object.values(this.projects).filter(p => p && p.id && p.name);
  },

  get(id) { return this.projects[id]; }
};

// Log de atividade — sempre local (não sincroniza entre dispositivos).
const ACTIVITY = {
  items: JSON.parse(localStorage.getItem('ft_act') || '[]'),
  push(msg) {
    this.items.unshift({ msg, ts: Date.now() });
    this.items = this.items.slice(0, 30);
    localStorage.setItem('ft_act', JSON.stringify(this.items));
  }
};
