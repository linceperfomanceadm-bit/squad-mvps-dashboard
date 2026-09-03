# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm start          # CRA dev server on :3000 (reads .env.local)
npm run build      # production build into build/ (untracked)
npx firebase deploy --only functions   # deploys functions/ (Node 20)
```

There are no tests and no lint script — `react-scripts test` exists via CRA but no test files are present, and linting is only the inline `eslintConfig: ["react-app"]` that runs during `start`/`build`.

Frontend deploys to Vercel (`vercel.json`: SPA rewrite of everything to `/`, output `build/`). Only the six `REACT_APP_FIREBASE_*` vars are actually required — without them `initializeApp` receives an undefined config and the app renders blank. `REACT_APP_ADMIN_ID` and `REACT_APP_ADMIN_PASSWORD` are optional: they fall back to `admin` / `Dash@2026` in code (`AuthContext.js:34-35`). `functions/` deploys separately through the Firebase CLI — it is not part of the Vercel build.

> A CONFIRMAR: o comando de deploy das functions. Foi inferido de `firebase.json`; não há `.firebaserc`, project id, `package-lock.json` nem `node_modules` em `functions/`.
> A CONFIRMAR: se a Vercel é mesmo o deploy vivo (inferido de `vercel.json`) — existe um `build/` local não rastreado, que pode indicar publicação manual.
> A CONFIRMAR: se o `.env.local` do repo aponta para o projeto Firebase de produção ou para um de teste.

## Language

Code, comments, UI copy, and Firestore field semantics are in **Portuguese (pt-BR)**. Existing comments are long, explanatory, and explain *why* a rule exists (often referencing an agency decision or a legacy data shape). Match that: write new comments in Portuguese in the same register.

## Architecture

Create React App (JavaScript, no TypeScript, no state library, no CSS framework). Firebase is the entire backend: Firestore for data, Auth for the team login, Storage for uploads, one Cloud Function.

### Domain constants live in one file

`src/lib/firebase.js` is the single source of truth for the whole domain, not just the SDK init. Thirty exports, grouped: SDK handles (`db`, `auth`, `storage`, `functions`); auth (`AUTH_EMAIL_DOMAIN`, `loginIdToEmail`); identity (`SECTORS`, `ADMIN_CONFIG`, `CS_ROLES`); client lifecycle (`CLIENT_STAGES`, `stageOf`, `isStaffing`, `STAFFING_ALERT_DAYS`); sales/registration (`SERVICE_SECTOR_MAP`, `SALE_SERVICES`, `PAYMENT_METHODS`, `RECURRENCE_SERVICES`, `REQUESTING_SECTORS`); WebDesign (`WD_SERVICE_CONFIG`, `WD_WEB_SERVICES`, `ID_VISUAL_CONFIG`); CS reports (`REQUEST_STATUS`, `REQUEST_SECTORS`, `REQUEST_SLA_HOURS`); boards (`SM_COLUMNS`, `TASK_COLUMNS`, `TASK_PRIORITIES`, `APPROVAL_STATUS`, `SLA_DAYS`); portal (`ECOMMERCE_PLATFORMS`, `PRODUCT_CATEGORIES`, `PORTAL_STATUS`).

**Change a sector color or add a status there, and the whole app follows.** Always check this file before hardcoding a label, color, or status string anywhere else.

One trap: **ID Visual moved out of WebDesign into Design.** It is now its own client block, `idv`, owned by the responsible designer (`ID_VISUAL_CONFIG` `:155`, rendered by `IdVisualBoard.js`), and the current WD service list is `WD_WEB_SERVICES` (`:150`). `WD_SERVICE_CONFIG.id_visual` survives only for clients registered under the old flow.

### Data layer = hooks with live listeners

`src/hooks/use*.js` are the data layer for everything a screen renders. Each opens an `onSnapshot` on a collection, maps `{ id, ...data }` into state, and exposes CRUD closures. There is no cache, no normalization, no global store — components subscribe by calling the hook, and every open tab updates in real time. Firestore collections: `clients`, `collaborators`, `tasks`, `requests`, `documents` (+ `versions` subcollection), `portal_clients`, `portal_products`, `userIndex`, and the singleton `app_config/general`.

Four files bypass the hooks and hit Firestore directly, each for a reason:

- `contexts/AuthContext.js:81,87` — `getDocs` on `collaborators` during login, before any hook is mounted; also writes `userIndex` (`:96,110`) and `collaborators` (`:107,214,244`)
- `contexts/PortalAuthContext.js:38,63` — portal login lookup and `lastLoginAt`
- `components/shared/PatchNotesPopup.js:46,63` — reads and writes `collaborators.lastPatchSeen`
- `pages/sectors/DocPrintPage.js:56` — a single `getDoc` with no listener, so a document edited mid-print cannot change under the PDF

### Storage layout

Three unrelated areas share the bucket:

- `brand-hub/{clientId}/{id}_{file}` — brandbook/Cofre materials (`useClients.js:136`), indexed in the client doc under `brandbook.materials`
- `contratos/` and `briefings/` — registration attachments (`useClients.js:516`). Separate folders on purpose: the contract holds CPF, CNPJ and amounts and is **never rendered in any screen** of the app
- `portal-products/{portalClientId}/{productId}/{file}` — portal product photos (`usePortalProducts.js:84`)

### Two independent auth systems

- **Team** — `src/contexts/AuthContext.js`. Users type a `loginId`, which is converted to a synthetic email (`loginId@squadmvps.interno`, `loginIdToEmail`) for Firebase Auth. The profile (sector, isAdmin, csRole, leaderOf) lives in the `collaborators` doc, joined by `authUid`. It carries a **lazy migration** path: accounts predating Auth still hold a plaintext `password` in Firestore; on first login it validates against that, creates the Auth account, then nulls the field. Every Firestore call in the login chain is wrapped in `withTimeout` and is best-effort — nothing in the profile/index write path may block a login.
- **Portal clients** (external e-commerce customers uploading products) — `src/contexts/PortalAuthContext.js`. Completely separate: username + SHA-256 hash checked against `portal_clients`, session in `sessionStorage`. It never touches Firebase Auth.

Creating a collaborator uses a **secondary, disposable Firebase app instance** (`useCollaborators.js`) because `createUserWithEmailAndPassword` on the default instance would sign the admin out. Resetting someone else's password requires the Admin SDK, hence the sole Cloud Function `resetCollaboratorPassword`, which re-verifies the caller is an admin via `userIndex` then `collaborators.authUid`.

### Routing and access control

`src/App.js` holds every route plus `ProtectedRoute`, whose flags are the access model: `requireSector`, `requireAdmin`, `requireCsRole` (CS splits into `comercial`/`operacional` subpanels), and `allowAdmin` for routes shared between a sector and admin (the Lince Docs editor). Admins are force-redirected to `/admin` unless the route opts in.

| Route | Guard |
|---|---|
| `/` · `/login/:sectorId` · `/first-access` | public |
| `/webdesign` `/socialmedia` `/design` `/videomaker` `/trafego` | `requireSector` |
| `/cs` | redirect only — `CSRedirect` sends the user to `csHome(user)` |
| `/cs-comercial` · `/cs-operacional` | `requireCsRole` |
| `/documentos/:docId` · `/documentos/:docId/imprimir` | `requireSector="socialmedia"` + `allowAdmin` |
| `/admin` | `requireAdmin` |
| `/tv` | none — public wall panel, anonymous sign-in, read-only, lazy-loaded |
| `/portal/login` · `/portal` | `PortalProtectedRoute` (portal auth, not team auth) |

Note the client-side guards are UX only — the real boundary is Firestore rules.

> A CONFIRMAR: quais regras do Firestore estão realmente publicadas. Não há `firestore.rules` no repo e `firebase.json` não tem chave `firestore`; a única pista é o README, que manda abrir tudo (`allow read, write: if true`) — e pode estar desatualizado.

### Business-time engine

`src/lib/taskTime.js` computes everything in **business time** (Mon–Fri, 09:00–18:48, `BUSINESS_DAY`): per-person time held on a task, execution vs. rework vs. approval, and a deadline clock that *freezes* while a task sits in approval and refunds `pausedMs` if it comes back. Never compute a task duration with raw date math — use `taskTimeStats` / `deadlineState`.

The same clock governs CS reports: `REQUEST_SLA_HOURS` (4h urgent → 72h low) is measured with `businessMsBetween`, not wall time (`CSRequests.js:45-46`). It orders the queue and flags what is blowing the SLA; it blocks nothing.

### Client lifecycle

A client moves `staffing → kickoff → onboarding → live`. Until it reaches scheduled onboarding it is written with `active: false` (`useClients.js:69` on create, still `false` when staffing closes at `:373`, flipped to `true` only by `scheduleOnboarding` at `:457`), which is what hides it from every screen — the app filters on `active !== false` rather than checking stages in dozens of places.

Read the stage through `stageOf(client)` (`firebase.js:89`): it derives the effective stage, mapping the old single-call flow (`stage: 'live'` plus `kickoff.pending: true`) onto `onboarding`. Not all code does this yet — `AdminClients.js:178,206`, `AdminDashboard.js:109`, `GenericSectorDashboard.js:131` and `useClients.js:366,490` compare `c.stage === 'staffing'` directly. Those are safe only because `staffing` is never derived, unlike `onboarding`. Prefer `stageOf()` in new code.

**Two calls, two fields, confusingly named** (`useClients.js:313-318`):

- `kickoffCall{}` — call 1, the **Kick Off**, owned by CS Comercial (created at `:375`, scheduled at `:399-403`)
- `kickoff{}` — call 2, the **Onboarding**, owned by CS Operacional (`scheduleOnboarding`, `:452-463`)

So `kickoff.pending` refers to the *onboarding* call, which is also what `stageOf` reads to rescue legacy clients. The name is legacy and was kept deliberately — renaming would mean migrating the whole base for no gain. Both calls generate a Google Calendar link through `src/lib/calendarLink.js` (`googleCalendarUrl` `:32`, `clientCallCalendarUrl` `:50`).

The codebase generally tolerates legacy shapes in place of migrating (e.g. `responsibles` may be a string or an array — see `asArray`; `useTasks.js` auto-repairs tasks stuck in approval).

### Client health — two independent lights

`src/hooks/useClientHealth.js`. A client carries **two** health signals that never override each other, and the "critical" panels consider red in either one (`isCritical` `:78`).

1. **Operational health — automatic.** Derived from the client's overdue tasks, nobody edits it: 0 overdue → green, 1 → yellow, 2 → orange, 3+ → red (`levelFromOverdue` `:31`, `computeOpsHealth` `:39`).
2. **Client health — manual.** Fed by CS from the relationship and what the client owes, stored on the client doc as `clientHealth = { level, note, by, at }` (`resolveClientHealth` `:69`; written by `useClients.js:532`).

Use the **4-level** API — `HEALTH_LEVELS_4` `:21`, `HEALTH_ORDER_4` `:28`, `computeOpsHealth`, `resolveClientHealth`, `isCritical`. It is what `CSOperacionalDashboard.js`, `useTVData.js`, `SMMural.js` and `SMClientModal.js` all use.

The file also exports an older **3-level** API (`HEALTH_LEVELS` `:89`, `HEALTH_ORDER` `:95`, `computeAutoHealth` `:97`, `resolveHealth` `:103`) that folds rework into a single light. Its only consumer is `components/commercial/CSHealth.js`, **which nothing imports** — the component is orphaned, so the 3-level API is effectively dead code. Do not build on it.

> A CONFIRMAR: `CSHealth.js` é para ser religado em algum painel ou apagado junto com a API de 3 níveis?

### TV wall panel

`/tv` is a second product inside the app, not a screen: a public panel for the office wall.

- **`app_config/general` is its live remote control**, not just an agenda URL (`useAppConfig.js:10-30`): `tvPaused` + `tvPauseMessage` (standby screen), `tvLockScene` (freeze one scene instead of rotating), `tvCelebrations` (confetti on delivery), `tvReloadToken` (bump it and every TV reloads), `tvRadioUrl`/`tvRadioPlaying`/`tvRadioVolume`, `tvVisitMode` (locked to the visitor-safe scene), and `tvHonorMetrics` (per-squad metric on the Highlights scene — each squad compared only against itself). Driven by `AdminTVControl.js`; the panel reacts in real time.
- **Data comes from `useTVData.js`**, which signs in anonymously (`:203`) and only reads. Its two `tasks` listeners are deliberately narrow and carry **no `orderBy`** — open statuses (`:216`) and completions since the start of the month (`:232`) — so the panel never needs a composite index.
- **It styles itself.** `TVPanel.js` ships its own CSS in a single `<style>{CSS}</style>` (`:749`) using container units (`cqw`/`cqh`) so the layout scales to any screen. Every `.tv-*` class, plus `.sub`, `.nm`, `.v`, is defined there and nowhere else — this is the one component in the codebase that is class-based rather than inline-styled.

### Lince Docs

`src/lib/docs/` is a catalog-driven document generator for Social Media deliverables, split across four files:

- `catalogo.js` — one object per document: its fields (`secoes`) and slide `render` (`DOCS` `:14`, `docPorId` `:695`, `docsAtivos` `:699`)
- `motor.js` — generic helpers that know no specific document; `montarDeck(doc, dados, opcionais, extras, LAYOUTS)` (`:55`) assembles the deck
- `layouts.js` — the slide layouts (`LAYOUTS` `:12`, `LAYOUT_PADRAO` `:122`), passed *into* `montarDeck` from outside
- `marca.js` — brand tokens (`MARCA` `:21`, `varsDaMarca` `:42`)

Adding a document is one object in `catalogo.js` **provided it reuses an existing layout**; a new layout means editing `layouts.js` as well.

Persistence is `useDocuments.js`: the whole document (field data, extra slides, optional sections, pendências) lives in a single record in `documents`, moving through `DOC_STATUS` — `rascunho → revisao → aprovado → entregue` (`:23-28`). Each generated PDF appends a snapshot to the `versions` subcollection (`:99`). `src/styles/lince-docs.css` styles the print route (`/documentos/:docId/imprimir`).

## Styling

Dark neon theme driven by CSS custom properties in `src/index.css` (`--neon`, `--bg`, `--surface`, `--border`, `--muted`, `--f`/`--fm` fonts). Components style with **inline `style={{}}` objects**, usually collected in a local `const S = {...}` at the bottom of the file; `className` is used only for animations, the spinner, and `TVPanel`. `src/components/commercial/ui.js` is the shared kit for the funnel panels, and it is more than style tokens — check it before writing a modal or a field by hand:

- style constants — `CARD`, `GRID`, `MODAL`, `LBL`, `INP`, `BTN_PRIMARY`, `BTN_GREEN`, `BTN_CANCEL`, `ICON_BTN`
- components — `Overlay`, `ModalHeader`, `ConfirmModal`, `ScheduleModal`, `Field`, `Stat`, `Tag`, `Empty`, `Spinner`, `Section`, `RO`
- formatters — `money` (BRL), `fmtDate`, `fmtDateTime`, `toLocalInput`

Modals render through `ReactDOM.createPortal` into `document.body` — `position: fixed` breaks under the `.fade-up` animation's lingering transform otherwise.

> A CONFIRMAR: o cabeçalho de `ui.js:7` diz que o kit serve a "SDR, Closer, CS Comercial e CS Operacional", mas não existe rota nem página de SDR/Closer. Comentário morto ou funcionalidade planejada?

Sector color should come from `SECTORS[sectorId].color`, and theme colors from the CSS vars. Be aware the brand neon `#EE3363` is hardcoded in 29 places outside `firebase.js` (`AdminCharts.js:5`, `AdminPortalClients.js:8`, `ProductFormModal.js:5`, `TaskModal.js:408,543,564,576`, `useDocuments.js:27`, …) — a literal you find there is the existing style, not necessarily a bug. Use the constant in new code.

## Conventions

- After a user-visible change, bump `PATCH_VERSION` and edit `PATCH_NOTES` in `src/components/shared/PatchNotesPopup.js` — collaborators see the popup once on next login (tracked per user in `collaborators.lastPatchSeen`). Write the notes in user language, no jargon.

  > A CONFIRMAR: se essa convenção segue viva. `PATCH_VERSION` está em `'2026-06-1'`, com notas de "Junho de 2026".
- Desktop notifications are Notification API only (no service worker / FCM): they work only while a tab is open. `NotificationCenter` is mounted once in `App.js` and is the only thing that fires them; `useDesktopNotifications` elsewhere (e.g. `Sidebar`) is used purely as the on/off switch.
- The `/tv` panel shows **operational data only** — no revenue, sales targets, or commercial numbers; it is visible to clients and visitors in the office.
- The Design/Video production-time SLA (`SLA_DAYS`) is deliberately visible in the admin panel only, never to the collaborator.
