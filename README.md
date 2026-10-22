# Squad MVPs — Dashboard v3.0 🚀

Sistema de gestão do time de criação com dashboards individuais por setor.

> ✅ Deploy 100% pelo navegador. Sem necessidade de instalar nada localmente.

---

## Setores

| Setor | Rota | Cor |
|-------|------|-----|
| WebDesign | `/webdesign` | Rosa `#EE3363` |
| Design | `/design` | Roxo `#a78bfa` |
| Social Media | `/socialmedia` | Azul `#38bdf8` |
| VideoMaker | `/videomaker` | Laranja `#fb923c` |
| Admin | `/admin` | Neon (acesso via rodapé da home) |

---

## PASSO 1 — GitHub

1. Acesse [github.com/new](https://github.com/new)
2. Nome: `squad-mvps-dashboard` · **Privado** · sem inicialização
3. Crie o repositório
4. Na página do repositório: **uploading an existing file**
5. Extraia o ZIP e faça upload de **todos os arquivos e pastas**
6. Commit: `feat: initial commit`

---

## PASSO 2 — Firebase

### 2.1 Criar projeto
1. [console.firebase.google.com](https://console.firebase.google.com) → **Adicionar projeto**
2. Nome: `squad-mvps-dashboard` · sem Analytics
3. **Criar projeto**

### 2.2 Firestore
1. Menu lateral → **Firestore Database** → **Criar banco de dados**
2. **Iniciar no modo de produção** → região `southamerica-east1` → **Ativar**

### 2.3 Regras do Firestore
As regras separam a equipe (token com acesso conferido pela Cloud Function `sincronizarAcesso`), o Painel de TV (login anônimo, só leitura) e o link de aprovação do cliente. **Nunca publique regra aberta** (`allow read, write: if true`): o banco inteiro fica exposto para qualquer pessoa com a URL do app.

### 2.4 Registrar app Web
1. Página inicial do projeto → ícone **`</>`**
2. Apelido: `dashboard-web` · **sem** Firebase Hosting
3. **Registrar app**
4. Copie os valores do bloco `firebaseConfig` (apiKey, authDomain, etc.)
5. **Continuar no Console**

---

## PASSO 3 — Vercel

1. [vercel.com](https://vercel.com) → **Continue with GitHub**
2. **Add New Project** → selecione o repositório → **Import**
3. Antes de Deploy, expanda **Environment Variables** e adicione:

| Name | Value |
|------|-------|
| `REACT_APP_FIREBASE_API_KEY` | valor do Firebase |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | valor do Firebase |
| `REACT_APP_FIREBASE_PROJECT_ID` | valor do Firebase |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | valor do Firebase |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | valor do Firebase |
| `REACT_APP_FIREBASE_APP_ID` | valor do Firebase |

4. **Deploy** → aguarde 1-3 minutos

---

## PASSO 4 — Primeiro acesso

1. Publique as Cloud Functions: `npx firebase deploy --only functions` (sem elas ninguém entra — o acesso é decidido nelas)
2. No console do Firebase → **Authentication** → **Adicionar usuário**: e-mail `admin@squadmvps.interno` e uma senha forte. Essa é a conta do admin master; nunca a apague
3. Abra a URL do Vercel → **"acesso administrativo"** (rodapé) → entre com o ID `admin` e essa senha
4. Vá em **Colaboradores** e cadastre os membros do time
5. Vá em **Clientes** e comece a cadastrar os clientes

> Nenhuma senha vai em variável de ambiente ou no código. Todo `REACT_APP_*` é compilado para o navegador e fica visível para qualquer visitante.

---

## Como funciona o login dos colaboradores

O admin define, no cadastro de cada colaborador:
- **ID de acesso** (ex: `henrique.wd`) — nunca muda
- **Senha provisória** — o colaborador redefine no primeiro acesso

O colaborador acessa pela tela inicial:
1. Clica no card do seu setor
2. Digita o ID e a senha provisória
3. Na primeira vez, é redirecionado para criar sua senha pessoal
4. A partir daí, acessa normalmente

---

## Estrutura de pastas

```
src/
├── components/
│   ├── admin/               # Componentes do painel admin
│   ├── sectors/
│   │   ├── webdesign/       # Cards, lista, modal WD
│   │   ├── socialMedia/     # Overview, Kanban, BulkInput
│   │   └── creative/        # Design + VideoMaker compartilhado
│   └── shared/              # Sidebar, Countdown, Toast
├── contexts/
│   └── AuthContext.js       # Login por ID via Firestore
├── hooks/
│   ├── useClients.js        # CRUD clientes (todos os setores)
│   └── useCollaborators.js  # CRUD colaboradores
├── lib/
│   └── firebase.js          # Config + constantes
└── pages/
    ├── admin/               # AdminDashboard
    ├── sectors/             # WebDesign, SocialMedia, Creative
    ├── HomePage.js          # Seleção de setor
    ├── LoginPage.js         # Login unificado
    └── FirstAccessPage.js   # Redefinição de senha
```

---

## Fluxo WebDesign
```
Cadastro → Onboarding (7d) → Produção → Finalizado / Recorrência
                                      ↓
                                   Inativo
```

## Fluxo Social Media
```
Planejamento em lote → Kanban
[Em Produção → Com o Cliente → Agendado/Pronto → Publicado]
```

## Fluxo Design / VideoMaker
```
Cadastrar Entrega → registro de KPI
Cofre = brandbook compartilhado dos clientes
Hall da Fama = entregas aprovadas de primeira
```

---

## Admin — SLA oculto Design/Vídeo

No **Extrato Diário**, a coluna "Tempo de Produção" calcula:
- `Data Entrega − Data Solicitação`
- 🟢 ≤ 3 dias
- 🔴 > 3 dias

Esse cálculo é **invisível para o colaborador**, visível apenas no painel admin.

---

## Problemas comuns

**Tela em branco** → verifique as 6 variáveis de ambiente no Vercel

**"permission-denied"** → publique as regras do Firestore (Passo 2.3)

**Login não funciona** → confirme o ID e senha exatos definidos no cadastro. O sistema é case-sensitive.

**Upload de pasta no GitHub** → se uma subpasta não subir, entre na pasta do repositório e use **Add file → Upload files** para ela separadamente.

---

*Squad MVPs Dashboard v3.0 — Sistema interno de gestão do time de criação*
