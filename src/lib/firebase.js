import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // fotos dos produtos do portal
export const functions = getFunctions(app); // Cloud Functions (reset de senha)

// ─── Auth: synthetic email domain ─────────────────────────────
// Firebase Auth autentica por email. O usuário continua digitando
// apenas o loginId; o app converte loginId -> email sintético com
// este domínio interno (nunca enviado a lugar nenhum).
export const AUTH_EMAIL_DOMAIN = 'squadmvps.interno';
export const loginIdToEmail = (loginId) =>
  `${String(loginId).trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

// ─── Sectors ──────────────────────────────────────────────────
// FONTE ÚNICA da identidade de cada setor (cor do emblema, emoji,
// logo). Tanto a tela de login quanto os painéis leem daqui — então
// alterar uma cor aqui atualiza o app inteiro. As cores são extraídas
// do emblema de cada time.
// Para trocar a logo: coloque o PNG em /public/logos/ e ajuste `logo`.
export const SECTORS = {
  webdesign:   { id: 'webdesign',   label: 'WebDesign',     color: '#FD2534', emoji: '🌐', logo: '/logos/webdesign.png' },
  design:      { id: 'design',      label: 'Design',        color: '#8F97A0', emoji: '🎨', logo: '/logos/design.png' },
  socialmedia: { id: 'socialmedia', label: 'Social Media',  color: '#E91E63', emoji: '📱', logo: '/logos/socialmedia.png' },
  videomaker:  { id: 'videomaker',  label: 'VideoMaker',    color: '#3636D1', emoji: '🎬', logo: '/logos/videomaker.png' },
  cs:          { id: 'cs',          label: 'CS',            color: '#3EFFFF', emoji: '🎧', logo: '/logos/cs.png' },
  trafego:     { id: 'trafego',     label: 'Tráfego Pago',  color: '#FFC107', emoji: '📊', logo: '/logos/trafego.png' },
};

// Entrada do Admin (não é um "setor" comum, mas a tela de login usa).
export const ADMIN_CONFIG = { id: 'admin', label: 'Admin', color: '#EE3363', emoji: '👑', logo: '/logos/admin.png' };

// ─── Subpapéis (funções dentro do setor) ──────────────────────
// O login é o mesmo do setor; o que decide para qual painel a pessoa
// vai é a FUNÇÃO cadastrada no colaborador.
export const CS_ROLES = [
  { id: 'comercial',   label: 'CS Comercial',   desc: 'Cadastro de clientes e acompanhamento do staffing' },
  { id: 'operacional', label: 'CS Operacional', desc: 'Onboarding, saúde operacional e saúde do cliente' },
];

// ─── Ciclo de vida do cliente ─────────────────────────────────
// O cliente nasce no cadastro da CS Comercial e passa por dois
// estágios antes de virar rotina:
//
//   staffing → cadastrado, aguardando os líderes indicarem os
//              responsáveis de cada setor contratado. Fica invisível
//              para os setores porque grava `active: false`, o que já
//              o esconde de todos os filtros existentes do app.
//   live     → quadro de responsáveis completo. Vira `active: true` e
//              entra na base para valer, com `kickoff.pending: true`
//              até a call de onboarding ser realizada.
//
// Cliente antigo, sem o campo `stage`, conta como 'live'.
export const CLIENT_STAGES = {
  staffing: { id: 'staffing', label: 'Aguardando responsáveis', color: '#f59e0b' },
  live:     { id: 'live',     label: 'Ativo',                   color: '#22c55e' },
};

export const isStaffing = (c) => c?.stage === 'staffing';

// ─── Serviço contratado → setor responsável ───────────────────
// Usado só para SUGERIR os setores no cadastro do cliente. A CS
// confirma na mão, porque nem todo serviço mapeia para um setor
// (SEO, Consultoria e Outro não têm dono fixo).
export const SERVICE_SECTOR_MAP = {
  gestao_trafego: 'trafego',
  social_media:   'socialmedia',
  webdesign:      'webdesign',
  video:          'videomaker',
  design:         'design',
};

// Formas de pagamento do cadastro de cliente (CS Comercial).
export const PAYMENT_METHODS = [
  'PIX', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Outro',
];

// ─── WebDesign service config ─────────────────────────────────
export const WD_SERVICE_CONFIG = {
  ecommerce: {
    label: 'E-commerce', days: 30,
    checklist: ['Criar Loja','Logo','Banner','Páginas','Checkout','Gateway de Pagamento','Produtos','Frete','Card','Domínio'],
    hasNotes: true,
  },
  landing_page: {
    label: 'Landing Page', days: 15,
    checklist: ['MVP','Domínio','Publicação'],
    hasNotes: false,
  },
  lp_catalogo: {
    label: 'LP Catálogo', days: 20,
    checklist: ['MVP','Domínio','Produtos','Publicação'],
    hasNotes: false,
  },
  id_visual: {
    label: 'ID Visual', days: 20,
    checklist: ['Envio de Namings','Aprovação Paleta de Cor e Tipografia','Apresentação da ID Visual','Entrega do Manual de Marca'],
    hasNotes: false,
  },
};

// Serviços de SITE oferecidos no cadastro novo. ID Visual saiu daqui:
// virou um bloco próprio (`idv`) que vive no painel do Design, não no
// do WebDesign. WD_SERVICE_CONFIG continua completo por causa dos
// clientes antigos, que seguem funcionando como sempre.
export const WD_WEB_SERVICES = ['ecommerce', 'landing_page', 'lp_catalogo'];

// ─── ID Visual (bloco `idv` do cliente) ───────────────────────
// Mesmas fases do WebDesign (onboarding → produção → finalizado),
// mas com dono próprio: só o designer responsável enxerga.
export const ID_VISUAL_CONFIG = {
  label: 'ID Visual',
  days: 20,
  onboardingDays: 7,
  checklist: [
    'Envio de Namings',
    'Aprovação Paleta de Cor e Tipografia',
    'Apresentação da ID Visual',
    'Entrega do Manual de Marca',
  ],
};

// ─── Reporte da CS (coleção `requests`) ───────────────────────
// Solicitação pontual que a CS abre para um colaborador específico.
// Não é task de produção e por isso não encosta no Kanban.
//   open     → aberta, aguardando o colaborador
//   answered → colaborador respondeu (com ou sem \"resolvido\")
//   closed   → CS encerrou; some da lista do colaborador
export const REQUEST_STATUS = {
  open:     { id: 'open',     label: 'Aguardando',  color: '#f59e0b' },
  answered: { id: 'answered', label: 'Respondida',  color: '#38bdf8' },
  closed:   { id: 'closed',   label: 'Encerrada',   color: '#22c55e' },
};

// Setores de produção que recebem Reporte da CS.
export const REQUEST_SECTORS = ['socialmedia', 'webdesign', 'design', 'videomaker', 'trafego'];

// ─── Social Media Kanban columns ─────────────────────────────
export const SM_COLUMNS = [
  { id: 'production', label: 'Em Produção',      color: '#EE3363' },
  { id: 'client',     label: 'Com o Cliente',     color: '#f59e0b' },
  { id: 'scheduled',  label: 'Agendado / Pronto', color: '#a78bfa' },
  { id: 'published',  label: 'Publicado',         color: '#22c55e' },
];

// ─── Task Kanban columns ──────────────────────────────────────
export const TASK_COLUMNS = [
  { id: 'todo',     label: 'Não Iniciada', color: '#52526e' },
  { id: 'doing',    label: 'Em Produção',  color: '#38bdf8' },
  { id: 'approval', label: 'Em Aprovação', color: '#f59e0b' },
  { id: 'done',     label: 'Concluída',    color: '#22c55e' },
];

// ─── Task priority — "low" changed to cyan for better visibility ──
export const TASK_PRIORITIES = [
  { id: 'low',    label: 'Baixa',   color: '#67e8f9' }, // was #52526e (too close to bg)
  { id: 'medium', label: 'Média',   color: '#38bdf8' },
  { id: 'high',   label: 'Alta',    color: '#f59e0b' },
  { id: 'urgent', label: 'Urgente', color: '#EE3363' },
];

// ─── Design/Video approval ────────────────────────────────────
export const APPROVAL_STATUS = [
  { id: 'first',  label: 'De Primeira',    color: '#22c55e' },
  { id: 'simple', label: 'Ajuste Simples', color: '#f59e0b' },
  { id: 'redo',   label: 'Refação',        color: '#EE3363' },
];

export const REQUESTING_SECTORS = ['Social Media','WebDesign','Tráfego Pago','Outro'];

export const RECURRENCE_SERVICES = [
  'Gestão de Tráfego','Social Media','SEO','Manutenção de Site',
  'E-mail Marketing','Consultoria Mensal','Suporte Técnico','Outro',
];

export const SLA_DAYS = 3;

// Serviços que podem ser contratados (cadastro de cliente do CS).
// Cada serviço marcado exige uma descrição >= 350 chars do que foi vendido.
export const SALE_SERVICES = [
  { id: 'gestao_trafego', label: 'Gestão de Tráfego' },
  { id: 'social_media',   label: 'Social Media' },
  { id: 'webdesign',      label: 'Site / WebDesign' },
  { id: 'video',          label: 'Vídeo / Audiovisual' },
  { id: 'design',         label: 'Design / Criativos' },
  { id: 'seo',            label: 'SEO' },
  { id: 'consultoria',    label: 'Consultoria' },
  { id: 'outro',          label: 'Outro' },
];

// ─── Portal de Coleta de Produtos (clientes externos) ─────────
// Plataformas de e-commerce que o cliente pode ter. "Outro" abre
// campo de texto livre na criação do acesso.
export const ECOMMERCE_PLATFORMS = [
  { id: 'shopify',   label: 'Shopify',   color: '#95BF47' },
  { id: 'tray',      label: 'Tray',      color: '#00A8E0' },
  { id: 'nuvemshop', label: 'Nuvemshop', color: '#2C6EF2' },
  { id: 'outro',     label: 'Outro',     color: '#8F97A0' },
];

// Categorias sugeridas para produtos (livre — o cliente pode digitar).
export const PRODUCT_CATEGORIES = [
  'Roupas', 'Calçados', 'Acessórios', 'Beleza', 'Casa', 'Eletrônicos',
  'Alimentos', 'Pet', 'Infantil', 'Esporte', 'Outro',
];

// Status da coleta de um cliente do portal.
export const PORTAL_STATUS = {
  collecting: { label: 'Coletando',  color: '#f59e0b' },
  complete:   { label: 'Completo',   color: '#22c55e' },
  paused:     { label: 'Pausado',    color: '#8F97A0' },
};
