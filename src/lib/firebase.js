import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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

// ─── Sectors ──────────────────────────────────────────────────
export const SECTORS = {
  webdesign:   { id: 'webdesign',   label: 'WebDesign',     color: '#EE3363', emoji: '🌐', logo: null },
  design:      { id: 'design',      label: 'Design',        color: '#a78bfa', emoji: '🎨', logo: null },
  socialmedia: { id: 'socialmedia', label: 'Social Media',  color: '#38bdf8', emoji: '📱', logo: null },
  videomaker:  { id: 'videomaker',  label: 'VideoMaker',    color: '#fb923c', emoji: '🎬', logo: null },
  cs:          { id: 'cs',          label: 'CS',            color: '#22c55e', emoji: '🎧', logo: null },
  trafego:     { id: 'trafego',     label: 'Tráfego Pago',  color: '#f59e0b', emoji: '📊', logo: null },
  comercial:   { id: 'comercial',   label: 'Comercial',     color: '#e879f9', emoji: '💼', logo: null },
};

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

// ─── Social Media Kanban columns ─────────────────────────────
export const SM_COLUMNS = [
  { id: 'production', label: 'Em Produção',      color: '#EE3363' },
  { id: 'client',     label: 'Com o Cliente',     color: '#f59e0b' },
  { id: 'scheduled',  label: 'Agendado / Pronto', color: '#a78bfa' },
  { id: 'published',  label: 'Publicado',         color: '#22c55e' },
];

// ─── Task Kanban columns ──────────────────────────────────────
export const TASK_COLUMNS = [
  { id: 'todo',       label: 'Não Iniciada',  color: '#52526e' },
  { id: 'doing',      label: 'Em Produção',   color: '#38bdf8' },
  { id: 'approval',   label: 'Em Aprovação',  color: '#f59e0b' },
  { id: 'done',       label: 'Concluída',     color: '#22c55e' },
];

// ─── Task priority ────────────────────────────────────────────
export const TASK_PRIORITIES = [
  { id: 'low',    label: 'Baixa',   color: '#52526e' },
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
