# FlowTrack

Sistema de gestão de projetos com SLA em horas úteis brasileiras.

## Funcionalidades

- Cadastro de projetos com prioridade (P1–P5), horas estimadas e prazo
- Cronômetro de sessão (start / pause) com histórico
- Motor de SLA em horas úteis (horário comercial configurável + feriados nacionais)
- Controle de acesso por whitelist de e-mails
- PIN de 4 dígitos para proteger Configurações
- Sincronização em tempo real via Firebase Realtime Database
- Tema claro / escuro

## Estrutura

```
flowtrack/
├── index.html              # estrutura HTML
├── css/
│   └── styles.css          # estilos
├── js/
│   ├── config.js           # constantes + credenciais Firebase embutidas
│   ├── sla.js              # cálculo de horas úteis e status SLA
│   ├── firebase.js         # camada de dados (STORE + ACTIVITY)
│   ├── auth.js             # PIN + gate de e-mail + whitelist
│   ├── ui.js               # renderização (dashboard, projetos, modais)
│   └── app.js              # boot + ações de projeto + configurações + roteamento
├── firebase-rules.json     # regras de segurança para colar no Console
└── README.md
```

## Deploy (GitHub Pages)

1. `git push origin main`
2. Acesse `https://github.com/rikegv/flowtrack/settings/pages`
3. Em **Source** → selecione **Deploy from a branch** → **main** → **/ (root)** → Save
4. Após ~2 min o link público fica disponível em `https://rikegv.github.io/flowtrack/`

## Firebase

Projeto: `gestaodeprojetos-4a4b7`
Database URL: `https://gestaodeprojetos-4a4b7-default-rtdb.firebaseio.com`

As credenciais já estão embutidas em `js/config.js` (são públicas por design no Firebase — a segurança vem das **Rules**). Veja `firebase-rules.json` para as regras recomendadas.
