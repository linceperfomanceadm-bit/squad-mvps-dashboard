# CLAUDE.md

Mapa do projeto para quem vai mexer no código (Claude no chat, Claude Code no terminal ou outro dev). Descreve **como o app é por dentro**. Se algo aqui contradisser o código, o código vence — corrija este arquivo no mesmo commit.

Referências são por nome de arquivo e função, não por número de linha, para o documento não envelhecer a cada edição.

## Comandos

```bash
npm install
npm start          # servidor de dev do CRA em :3000 (lê .env.local)
npm run build      # build de produção em build/ (não versionado)
npx firebase deploy --only functions   # publica functions/ (Node 20)
```

Não há testes nem script de lint. O lint é só o `eslintConfig: ["react-app"]` que roda no `start`/`build`.

**Deploy:** a Vercel publica automaticamente a partir da `main` (`vercel.json`: rewrite de tudo para `/`, saída `build/`). O build roda com `CI=true`, então **qualquer warning de ESLint derruba o deploy** — import ou variável sem uso, dependência de hook faltando, `no-loop-func`. `functions/` é publicado à parte pelo Firebase CLI e não entra no build da Vercel.

Variáveis obrigatórias: as seis `REACT_APP_FIREBASE_*` — sem elas o `initializeApp` recebe config indefinida e o app abre em branco.

> A CONFIRMAR: o comando de deploy das functions foi inferido de `firebase.json`; não há `.firebaserc` nem project id versionado.

## Fluxo de trabalho

- As alterações sobem pela interface web do GitHub: lápis para editar arquivo existente, "Create new file" para arquivo novo. Não usar "Add files via upload" (gera arquivo fantasma).
- Entrega de código é sempre o arquivo completo, nunca diff ou trecho.
- Antes de subir: checagem de sintaxe por arquivo com esbuild (`--loader=jsx`), bundle completo de `src/index.js` procurando `Could not resolve "./...`, e ESLint com a config `react-app`.

## Idioma

Código, comentários, textos de UI e semântica dos campos do Firestore são em **pt-BR**. Os comentários existentes são longos e explicam o *porquê* de cada regra (normalmente uma decisão da agência ou um formato legado de dado). Siga o mesmo tom.

## Arquitetura

Create React App (JavaScript, sem TypeScript, sem biblioteca de estado, sem framework de CSS). O Firebase é todo o backend: Firestore para dados, Auth para o login da equipe, Storage para uploads e uma Cloud Function.

### Constantes do domínio vivem num arquivo só

`src/lib/firebase.js` é a fonte única do domínio, não só a inicialização do SDK. Grupos de exports:

- **SDK** — `db`, `auth`, `storage`, `functions`
- **Login** — `AUTH_EMAIL_DOMAIN`, `loginIdToEmail`
- **Identidade** — `SECTORS`, `ADMIN_CONFIG`, `sectorTheme`, `CS_ROLES`
- **Ciclo de vida do cliente** — `CLIENT_STAGES`, `stageOf`, `isStaffing`, `onboardingAgendado`, `naCarteira`, `STAFFING_ALERT_DAYS`
- **Contrato** — `CONTRACT_ALERT_DAYS`, `CONTRACT_STATUS`, `addMonths`, `contractState`, `contractNeedsAttention`
- **Cadastro / venda** — `SERVICE_SECTOR_MAP`, `SALE_SERVICES`, `PAYMENT_METHODS`, `RECURRENCE_SERVICES`, `REQUESTING_SECTORS`
- **WebDesign e ID Visual** — `WD_SERVICE_CONFIG`, `WD_WEB_SERVICES`, `ID_VISUAL_CONFIG`
- **Reporte da CS** — `REQUEST_STATUS`, `REQUEST_SECTORS`, `REQUEST_SLA_HOURS`
- **Quadros** — `SM_COLUMNS`, `TASK_COLUMNS`, `TASK_PRIORITIES`, `APPROVAL_STATUS`, `SLA_DAYS`
- **Portal** — `ECOMMERCE_PLATFORMS`, `PRODUCT_CATEGORIES`, `PORTAL_STATUS`
- **Entregas do contrato** — `ENTREGAVEIS`, `ENTREGA_SECTORS`, `ENTREGA_STATUS`, `CADASTRO_PENDENCIAS`, `HEALTH_STALE_DAYS`, `FLUXO_PARADO_DIAS`
- **Comercial** — `COMERCIAL_TEAM` (time Hunters, logo `/logos/hunters.png`)

**Mude a cor de um setor ou adicione um status aqui e o app inteiro acompanha.** Sempre consulte este arquivo antes de escrever um rótulo, cor ou status em outro lugar. Constante nova entra dentro do bloco correspondente — os outros arquivos importam por nome e o bundle quebra se o export não resolver.

Armadilha: **ID Visual saiu do WebDesign e foi para o Design.** É um bloco próprio do cliente, `idv`, do designer responsável (`ID_VISUAL_CONFIG`, renderizado por `IdVisualBoard.js`). A lista atual de serviços de Web é `WD_WEB_SERVICES`; `WD_SERVICE_CONFIG.id_visual` sobrevive só para clientes do fluxo antigo. Adicionar ID Visual a cliente que já está na casa é exclusivo do admin.

### Serviços de WebDesign por cliente

`src/lib/wdJobs.js`. O bloco `wd` do cliente é o serviço principal (legado, id `'main'`); serviços contratados depois ficam em `wdJobs[]` no mesmo documento — nunca cliente duplicado. Use `wdJobsOf(client)` para a lista normalizada e `WD_ACTIVE_STATUSES` para saber o que está em andamento. O mesmo arquivo exporta `asArray`, o normalizador de campos que podem ser string ou array.

### Camada de dados = hooks com listeners ao vivo

`src/hooks/use*.js` são a camada de dados de tudo que uma tela renderiza. Cada hook abre um `onSnapshot`, mapeia `{ id, ...data }` para o estado e expõe funções de CRUD. Sem cache, sem normalização, sem store global — o componente assina chamando o hook e toda aba aberta atualiza em tempo real.

Coleções do Firestore: `clients`, `collaborators`, `tasks`, `requests`, `dayTasks` (agenda pessoal, filtrada por `ownerId`), `documents` (+ subcoleção `versions`), `portal_clients`, `portal_products`, `userIndex` e o `app_config` (`general` para a TV operacional e a agenda; `comercial` e `comercial_AAAA-MM` para o comercial).

Quatro arquivos acessam o Firestore direto, cada um por um motivo:

- `contexts/AuthContext.js` — lê `collaborators` durante o login, antes de qualquer hook montar; também grava `userIndex` e `collaborators`
- `contexts/PortalAuthContext.js` — login do portal e `lastLoginAt`
- `components/shared/PatchNotesPopup.js` — lê e grava `collaborators.lastPatchSeen`
- `pages/sectors/DocPrintPage.js` — um `getDoc` sem listener, para o documento não mudar no meio da geração do PDF

Tela nova deve consumir hook. Acesso direto só com motivo forte e comentado.

### Storage

Três áreas independentes no mesmo bucket:

- `brand-hub/{clientId}/{id}_{arquivo}` — materiais do Brand Hub/Cofre, indexados no cliente em `brandbook.materials`
- `contratos/` e `briefings/` — anexos do cadastro. Pastas separadas de propósito: o contrato tem CPF, CNPJ e valores e **nunca aparece em nenhuma tela** do app
- `portal-products/{portalClientId}/{productId}/{arquivo}` — fotos de produto do portal

Downloads do Storage dependem de uma política de CORS no bucket (GET com `Content-Type` e `Content-Disposition`).

### Dois sistemas de login independentes

- **Equipe** — `src/contexts/AuthContext.js`. O usuário digita um `loginId`, convertido em e-mail sintético (`loginIdToEmail`) para o Firebase Auth. O perfil (setor, isAdmin, csRole, leaderOf) fica no documento de `collaborators`, ligado por `authUid`. Existe **migração preguiçosa**: contas anteriores ao Auth ainda guardam `password` em texto no Firestore; no primeiro login valida contra ele, cria a conta no Auth e apaga o campo. Toda chamada ao Firestore no login passa por `withTimeout` e é best-effort — nada na gravação de perfil/índice pode travar o login.
- **Clientes do portal** — `src/contexts/PortalAuthContext.js`. Totalmente separado: usuário + hash SHA-256 conferido em `portal_clients`, sessão em `sessionStorage`. Nunca toca o Firebase Auth.

Criar colaborador usa uma **instância secundária e descartável do Firebase** (`useCollaborators.js`), porque `createUserWithEmailAndPassword` na instância padrão deslogaria o admin. Redefinir a senha de outra pessoa exige o Admin SDK, por isso a única Cloud Function, `resetCollaboratorPassword`, que confere se quem chamou é admin via `userIndex` e depois `collaborators.authUid`.

**Falha de segurança conhecida:** `AuthContext.js` ainda tem um par de credenciais de admin de fallback quando `REACT_APP_ADMIN_ID`/`REACT_APP_ADMIN_PASSWORD` não estão definidas. Esse fallback dá admin de verdade: passa pela migração preguiçosa, cria conta real no Auth e grava `userIndex/{uid}.isAdmin = true` — o mesmo registro em que a Cloud Function confia. Além disso, todo `REACT_APP_*` vai compilado para o navegador, então qualquer senha de admin configurada fica exposta. Trocar o valor não resolve; a correção é validar o admin **fora do cliente** (custom claims ou função callable) e ajustar as regras do Firestore. Nunca escreva essas credenciais em documento ou código.

### Rotas e controle de acesso

`src/App.js` concentra todas as rotas e o `ProtectedRoute`, cujas flags são o modelo de acesso: `requireSector`, `requireAdmin`, `requireCsRole` e `allowAdmin` (rota compartilhada entre um setor e o admin). Admin é redirecionado para `/admin` a menos que a rota permita.

| Rota | Guarda |
|---|---|
| `/` · `/login/:sectorId` · `/first-access` | pública |
| `/webdesign` `/socialmedia` `/design` `/videomaker` `/trafego` | `requireSector` |
| `/cs` · `/cs-comercial` | só redirecionam para `/cs-operacional` (`CSRedirect`) |
| `/cs-operacional` | `requireCsRole="operacional"` |
| `/documentos/:docId` · `/documentos/:docId/imprimir` | `requireSector="socialmedia"` + `allowAdmin` |
| `/admin` | `requireAdmin` |
| `/tv` | nenhuma — painel público, login anônimo, só leitura, carregado sob demanda |
| `/tv/comercial` | nenhuma — TV da sala comercial, mesma lógica da `/tv` |
| `/portal/login` · `/portal` | `PortalProtectedRoute` (login do portal, não da equipe) |

**A CS é um time só.** Não existe mais CS Comercial: toda a CS faz o fluxo inteiro, do cadastro à entrada do cliente na base. `CS_ROLES` tem só `operacional`; colaboradores antigos com `csRole: 'comercial'` caem no mesmo painel, e `/cs-comercial` ficou como redirecionamento. O setor Comercial (SDR/Closer) foi removido — o cadastro manual pela CS é a única porta de entrada de cliente.

**Líder da CS = líder do comercial.** Não é setor nem rota própria: é quem tem `'cs'` em `leaderOf`. Entra pelo acesso da CS e ganha as abas "Gestão do Time" e "Comercial" no `CSOperacionalDashboard` (o admin também vê).

As guardas do front são só UX — a barreira real são as regras do Firestore. Toda coleção nova precisa de regra separando equipe (`isStaff()`) de acesso anônimo (`isAnon()`); o anônimo (Painel de TV) só lê `tasks`, `clients` e `app_config`.

> A CONFIRMAR: as regras publicadas não estão versionadas (não há `firestore.rules` no repo nem chave `firestore` no `firebase.json`). O README ainda sugere regra aberta e pode estar desatualizado.

### Motor de horário comercial

`src/lib/taskTime.js` calcula tudo em **tempo útil** (seg–sex, 09:00–18:48, `BUSINESS_DAY`): tempo de cada pessoa na tarefa, execução × refação × aprovação, e um relógio de prazo que *congela* enquanto a tarefa está em aprovação e devolve `pausedMs` se ela voltar. Nunca calcule duração com subtração crua de datas — use `taskTimeStats` / `deadlineState` / `businessMsBetween`.

O mesmo relógio mede o SLA do Reporte da CS (`REQUEST_SLA_HOURS`, de 4h urgente a 72h baixa). Ele ordena a fila e sinaliza estouro; não bloqueia nada. O SLA de produção de Design/Vídeo (`SLA_DAYS`) é visível só no admin, nunca para o colaborador.

### Ciclo de vida do cliente

A CS conduz tudo; os líderes de setor só indicam os responsáveis.

- `kickoff` — cadastrado. A CS agenda e realiza a call de Kick Off.
- `staffing` — Kick Off realizado, falta responsável em algum setor. Os líderes indicam o time e, **em paralelo**, a CS já pode agendar a call de onboarding.
- `onboarding` — quadro completo (com ou sem call agendada).
- `live` — call de onboarding realizada. Só é possível marcar a call como realizada com o quadro completo.

Até a call de onboarding ser **agendada**, o cliente grava `active: false` — é isso que o esconde das visões gerais (métricas, TV, listas), porque o app filtra por `active !== false` em vez de checar estágio em dezenas de lugares. O agendamento (`scheduleOnboarding` em `useClients.js`) vira `active: true`. Quem já foi indicado responsável vê o cliente antes disso, pela regra de `naCarteira`. `onboardingAgendado(c)` diz se há call marcada e não realizada, valendo para `staffing` e `onboarding`. O prazo de onboarding do WebDesign segue a data dessa call.

Leia o estágio sempre por `stageOf(client)`: ele deriva o estágio efetivo e encaixa clientes do fluxo antigo de uma call só (`stage: 'live'` + `kickoff.pending: true`) em `onboarding`. Cliente sem `stage` conta como `live`. Ainda há comparações diretas `c.stage === 'staffing'` em `AdminClients.js`, `AdminDashboard.js`, `GenericSectorDashboard.js` e `useClients.js` (e `it.stage === 'live'` em `CSCarteira.js`) — funcionam porque `staffing` nunca é derivado, mas código novo deve usar `stageOf()`.

**Duas calls, dois campos, nomes confusos:**

- `kickoffCall{}` — call 1, o **Kick Off**
- `kickoff{}` — call 2, o **Onboarding**

Ou seja, `kickoff.pending` se refere à call de *onboarding*. O nome é legado e foi mantido de propósito — renomear exigiria migrar a base inteira sem ganho. As duas calls geram link do Google Agenda por `src/lib/calendarLink.js` (`googleCalendarUrl`, `clientCallCalendarUrl`).

O código tolera formatos legados em vez de migrar: nunca use `c.active` (use `c.active !== false`), `responsibles` pode ser string ou array (use `asArray`), e `useTasks.js` repara sozinho tarefas presas em aprovação. Campo novo precisa funcionar com documentos antigos que não o têm.

### Saúde do cliente — duas luzes independentes

`src/hooks/useClientHealth.js`. O cliente tem **dois** sinais que nunca se sobrepõem; os painéis de "críticos" consideram vermelho em qualquer um (`isCritical`).

1. **Saúde operacional — automática.** Derivada das tarefas atrasadas: 0 → verde, 1 → amarelo, 2 → laranja, 3+ → vermelho (`computeOpsHealth`).
2. **Saúde do cliente — manual.** Alimentada pela CS a partir do relacionamento, gravada como `clientHealth = { level, note, by, at }` (`resolveClientHealth`).

Use a API de **4 níveis** — `HEALTH_LEVELS_4`, `HEALTH_ORDER_4`, `computeOpsHealth`, `resolveClientHealth`, `isCritical`. A API antiga de 3 níveis (`HEALTH_LEVELS`, `computeAutoHealth`, `resolveHealth`) só é usada por `components/commercial/CSHealth.js`, **que nada importa** — é código morto; não construa em cima dele.

> A CONFIRMAR: `CSHealth.js` volta para algum painel ou é apagado junto com a API de 3 níveis?

### Painel de TV

`/tv` é um segundo produto dentro do app: painel público para a parede do escritório, visível para clientes e visitantes. **Mostra só dado operacional** — nunca faturamento, metas comerciais ou valores.

- **`app_config/general` é o controle remoto ao vivo** (`useAppConfig.js`): `tvPaused` + `tvPauseMessage` (tela de standby), `tvLockScene` (trava uma cena), `tvCelebrations` (confete em entrega), `tvReloadToken` (incrementar recarrega todas as TVs), `tvRadioUrl`/`tvRadioPlaying`/`tvRadioVolume`, `tvVisitMode` (trava na cena segura para visitas) e `tvHonorMetrics` (métrica por squad na cena de destaques — cada squad comparado só consigo mesmo). Controlado por `AdminTVControl.js`.
- **Dados vêm de `useTVData.js`**, que entra anonimamente e só lê. Os dois listeners de `tasks` são estreitos de propósito e **não têm `orderBy`** — status abertos e concluídas desde o início do mês — para nunca exigir índice composto.
- O rádio usa um `<audio>` HTML para sobreviver à suspensão de aba das Smart TVs.
- No modo visita, métricas em porcentagem ficam de fora: qualquer valor abaixo de 100% expõe um complemento negativo.
- **Estiliza a si mesmo.** `TVPanel.js` traz o próprio CSS num único `<style>{CSS}</style>` com unidades de container (`cqw`/`cqh`) para escalar em qualquer tela, e usa Unbounded/Lexend. É o único componente baseado em classes (`.tv-*`, `.sub`, `.nm`, `.v`), e esse estilo não vaza para o resto do app.

### Lince Docs

`src/lib/docs/` é um gerador de documentos por catálogo para as entregas do Social Media:

- `catalogo.js` — um objeto por documento: campos (`secoes`) e `render` dos slides (`DOCS`, `docPorId`, `docsAtivos`)
- `motor.js` — funções genéricas; `montarDeck(doc, dados, opcionais, extras, LAYOUTS)` monta o deck
- `layouts.js` — layouts de slide (`LAYOUTS`, `LAYOUT_PADRAO`), passados de fora para `montarDeck`
- `marca.js` — tokens de marca (`MARCA`, `varsDaMarca`)

Adicionar documento é um objeto em `catalogo.js` **se reutilizar um layout existente**; layout novo exige editar `layouts.js` também.

Persistência em `useDocuments.js`: o documento inteiro (dados, slides extras, seções opcionais, pendências) fica num registro de `documents`, passando por `DOC_STATUS` — `rascunho → revisao → aprovado → entregue`. Cada PDF gerado adiciona um snapshot à subcoleção `versions`. Há modo apresentação dentro do app, mantendo a opção de salvar PDF. `src/styles/lince-docs.css` estiliza a rota de impressão e usa Unbounded/Saira Extra Condensed — identidade própria do módulo.

### Entregas do contrato

`src/lib/entregas.js` (funções puras) + `src/components/entregas/` (telas). Responde "o cliente está recebendo o que contratou?".

- **Escopo mensal** no cliente: `escopo.versoes[{ desde: 'AAAA-MM', itens: [{ id, sector, label, qtd }] }]` e `escopo.semRecorrencia`. Versões, e não um escopo só, para reconstruir qualquer mês passado — inclusive os meses em que ninguém marcou nada. O primeiro escopo vale no mês atual; mudança vale no próximo dia 1 (`inicioNovaVersao`). O id do item se mantém entre versões.
- **Marcações** em `entregas['AAAA-MM'] = { feito: {itemId: n}, qtd: {itemId: n}, log: [...] }`. `qtd` é ajuste só daquele mês (cliente que entrou no meio do mês). O que falta não acumula para o mês seguinte.
- Regras da agência: o mês vira no dia 1 para todos; o mês anterior aceita marcação até o dia 5 (`mesesEditaveis`); o ritmo esperado usa tempo útil (`fracaoDoMes` → `businessMsBetween`).
- Entregas únicas (site, ID Visual) **não** têm checklist novo: `entregasUnicas` lê `wdJobsOf` e o bloco `idv`.
- `cadastroPendencias` aponta o que falta no cadastro (clientes antigos) — é o selo "cadastro incompleto". Completar é o `ClienteCadastroModal` (CS, líder e admin).
- Escrita no `useClients`: `saveCadastro`, `saveEscopo`, `ajustarMesEntregas`, `marcarEntrega` (transação), `transferirCS`. As telas recebem essas funções já embrulhadas por `acoesDeEntregas` (`components/entregas/acoes.js`); ação ausente esconde o botão.
- Telas: `EntregasSetor` (aba "Entregas do Mês" de quem produz), `EntregasPainel` (lista "Entregas × Contrato" do admin e da CS), `ClienteFicha` (card de contrato e entregas + formulário de cadastro), `EntregasKit` (barra, situação, linha com − / +).

### Comercial (Hunters)

Tudo lançado à mão pelo líder do comercial (o CRM é externo). Fica em `app_config` porque é a coleção que a TV anônima já lê:

- `app_config/comercial` — controles da TV comercial (mesmos campos `tv*` da TV operacional) + `closers[]` e `sdrs[]`.
- `app_config/comercial_AAAA-MM` — `meta`, `leads`, `vendas[]`, `sdr{ [chaveSdr(nome)]: { agendados, realizados, noShow } }`, `churn[]`.

`src/hooks/useComercial.js` escreve (painel), `src/hooks/useComercialTVData.js` lê anônimo (TV), `src/lib/comercial.js` calcula meta, ritmo, rankings, funil, carteira e alertas para os dois. A TV (`pages/TVComercial.js`) segue o padrão da `/tv` — CSS próprio, palco 1920×1080, cinco cenas — com identidade Hunters (grafite, prata e o dourado do emblema só em conquista). **Diferente da `/tv`, mostra R$**: fica na sala do comercial. O modo visita esconde todo valor e a cena de alerta. Churn do mês soma o lançado à mão com os contratos encerrados pela CS no mês.

## Visual

### Tokens

Os tokens vivem em `src/index.css` (bloco "Layout 01"). Não há `DESIGN.md`; o `index.css` e o kit compartilhado são a referência.

- **Superfícies neutras:** `--bg` (fundo), `--bg2` (card), `--bg3` (card interno/campo), `--bg4` (hover), `--panel` (sidebar), `--surface`, `--soft`, `--border`, `--border-h`, `--border-s`, `--shadow`.
- **Texto:** `--text` principal, `--muted` secundário, `--dim` só para ícone, divisória e placeholder.
- **Identidade do painel ativo:** `--c`, `--c2`, `--on`, e os derivados `--grad`, `--c-dim`, `--c-border`. São pintadas em runtime por `useSectorTheme(sectorId)` (`contexts/ThemeContext.js`) a partir de `sectorTheme()` em `firebase.js`, que escolhe a variante `light` do setor quando o tema é claro (ciano do CS e amarelo do Tráfego não existem sobre branco). Chame uma vez por dashboard — o `AppShell` já faz isso.
- **Semântica — cor só onde é informação:** `--green` concluído/ok, `--amber` aguardando/atenção, `--red` atraso/erro, `--purple` refação/ajuste, `--blue` informativo, `--orange` intermediário de saúde. Cada uma tem variantes `-dim` e `-b` (borda).
- **Fontes:** `--f` (Outfit) para tudo e `--fm` (JetBrains Mono) para números, códigos e datas técnicas. Unbounded, Lexend e Saira são exclusivas da TV e do Lince Docs.
- **Raio:** `--r`.
- `--neon*` existe só por compatibilidade com telas antigas.

**Tema claro/escuro:** vive em `<html data-theme>`, trocado pelo `ThemeContext` e salvo em `localStorage` por navegador. Todo componente precisa funcionar nos dois — use só variáveis, nunca hex de superfície ou texto. A logo da agência muda com o tema (`useBrandLogo`).

A cor `#EE3363` ainda aparece fixa em cerca de 29 pontos fora do `firebase.js` (`AdminCharts.js`, `AdminPortalClients.js`, `ProductFormModal.js`, `TaskModal.js`, `useDocuments.js`...). É estilo anterior, não necessariamente bug; em código novo use `var(--c)` ou a constante.

### Estilo nos componentes

Estilo com **objetos inline**, reunidos num `const S = {...}` no fim do arquivo. `className` só para animações, spinner, TV e as classes utilitárias do `index.css`: `ui-card`, `ui-btn` (`.primary`, `.small`, `.on`), `sb-item`, `top-btn`, `fade-up`, `fade-in`, `spinner`, `toast`.

Modais sempre via `ReactDOM.createPortal` no `document.body` — o `transform` residual da animação `.fade-up` quebra `position: fixed` nos descendentes.

Ícones: `lucide-react`. Sem emoji na interface (os `emoji` em `SECTORS` são legado). SVG que precisa herdar cor usa CSS mask — `currentColor` não atravessa `<img src>`.

### Kits compartilhados

Antes de criar card, KPI, modal, campo, tag ou estado vazio à mão, use os kits:

- **`src/components/shared/AppShell.js`** — casca única de todos os painéis: sidebar de 224px (`SIDEBAR_WIDTH`) com o item ativo no gradiente do setor e barra superior com Agenda, tema, notificações e perfil. Exporta `AppShell` e `Aside`.
- **`src/components/shared/ui.js`** — kit do Layout 01, usado pelas visões gerais (admin, Social Media, WebDesign, Criativos, CS): `PageHeader`, `Card`, `Grid`, `Kpi`, `Breakdown`, `MiniBars`, `Goal`, `HBars`, `Pills`, `Trio`, `Tag`, `Row`, `Empty`. Tudo neutro; cor do painel por `var(--c)`/`var(--grad)`, semântica por `--green`/`--red`. **É o padrão para tela nova.**
- **`src/components/commercial/ui.js`** — kit mais antigo, usado pelas telas da CS e por modais: constantes de estilo (`CARD`, `GRID`, `MODAL`, `LBL`, `INP`, `BTN_PRIMARY`, `BTN_GREEN`, `BTN_CANCEL`, `ICON_BTN`), componentes (`Overlay`, `ModalHeader`, `ConfirmModal`, `ScheduleModal`, `Field`, `Stat`, `Tag`, `Empty`, `Spinner`, `Section`, `RO`) e formatadores (`money`, `fmtDate`, `fmtDateTime`, `toLocalInput`). Para modal e formulário ainda é a peça certa. O comentário do topo cita SDR/Closer, que já não existem.

Se faltar uma peça que vai se repetir, crie no kit, não na tela. Tela nova deve parecer irmã das já migradas — mesma hierarquia de título, espaçamento e componentes.

## Convenções

- Depois de mudança visível ao usuário, incremente `PATCH_VERSION` e edite `PATCH_NOTES` em `src/components/shared/PatchNotesPopup.js` — cada colaborador vê o popup uma vez no próximo login (controle em `collaborators.lastPatchSeen`). Notas em linguagem de usuário, sem jargão.

  > A CONFIRMAR: se a convenção segue viva. `PATCH_VERSION` está em `'2026-06-1'`.
- Notificações de desktop são só Notification API (sem service worker/FCM): funcionam apenas com uma aba aberta. `NotificationCenter` é montado uma vez em `App.js` e é o único que dispara; `useDesktopNotifications` em outros lugares serve só como chave liga/desliga.
- Credenciais e dados sensíveis (contratos, CPF/CNPJ, valores) nunca aparecem em tela, em código do cliente ou em documentação.
