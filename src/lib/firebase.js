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
  webdesign:   { id: 'webdesign',   label: 'WebDesign',   color: '#EE3363', emoji: '🌐' },
  design:      { id: 'design',      label: 'Design',      color: '#a78bfa', emoji: '🎨' },
  socialmedia: { id: 'socialmedia', label: 'Social Media', color: '#38bdf8', emoji: '📱' },
  videomaker:  { id: 'videomaker',  label: 'VideoMaker',  color: '#fb923c', emoji: '🎬' },
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
  { id: 'production', label: 'Em Produção',         color: '#EE3363' },
  { id: 'client',     label: 'Com o Cliente',        color: '#f59e0b' },
  { id: 'scheduled',  label: 'Agendado / Pronto',    color: '#a78bfa' },
  { id: 'published',  label: 'Publicado',            color: '#22c55e' },
];

// ─── Design / Videomaker approval statuses ───────────────────
export const APPROVAL_STATUS = [
  { id: 'first',    label: 'De Primeira',    color: '#22c55e' },
  { id: 'simple',   label: 'Ajuste Simples', color: '#f59e0b' },
  { id: 'redo',     label: 'Refação',        color: '#EE3363' },
];

export const REQUESTING_SECTORS = [
  'Social Media', 'WebDesign', 'Tráfego Pago', 'Outro',
];

// ─── Recurrence services ──────────────────────────────────────
export const RECURRENCE_SERVICES = [
  'Gestão de Tráfego','Social Media','SEO','Manutenção de Site',
  'E-mail Marketing','Consultoria Mensal','Suporte Técnico','Outro',
];

// ─── SLA threshold (days) ─────────────────────────────────────
export const SLA_DAYS = 3;
