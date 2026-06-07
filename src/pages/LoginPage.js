import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// ─── Sector config ─────────────────────────────────────────────
// Para trocar a logo de cada setor:
// 1. Coloque o arquivo PNG em /public/logos/ (ex: /public/logos/webdesign.png)
// 2. Atualize o campo `logo` abaixo (ex: logo: '/logos/webdesign.png')
const SECTOR_CONFIG = {
  webdesign:   { label: 'WebDesign',    color: '#EE3363', emoji: '🌐', logo: '/logos/webdesign.png' },
  design:      { label: 'Design',       color: '#a78bfa', emoji: '🎨', logo: '/logos/design.png' },
  socialmedia: { label: 'Social Media', color: '#38bdf8', emoji: '📱', logo: '/logos/socialmedia.png' },
  videomaker:  { label: 'VideoMaker',   color: '#fb923c', emoji: '🎬', logo: '/logos/videomaker.png' },
  cs:          { label: 'CS',           color: '#22c55e', emoji: '🎧', logo: '/logos/cs.png' },
  trafego:     { label: 'Tráfego Pago', color: '#f59e0b', emoji: '📊', logo: '/logos/trafego.png' },
  comercial:   { label: 'Comercial',    color: '#e879f9', emoji: '💼', logo: '/logos/comercial.png' },
  admin:       { label: 'Admin',        color: '#EE3363', emoji: '👑', logo: '/logos/admin.png' },
};

export default function LoginPage() {
  const { sectorId } = useParams();
  const { loginCollaborator, loginAdmin } = useAuth();
  const navigate = useNavigate();

  const isAdmin = sectorId === 'admin';
  const sector = SECTOR_CONFIG[sectorId] || SECTOR_CONFIG.admin;

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loginId.trim() || !password) { setError('Preencha todos os campos.'); return; }
    setLoading(true); setError('');
    const res = isAdmin
      ? await loginAdmin(loginId, password)
      : await loginCollaborator(sectorId, loginId, password);
    setLoading(false);
    if (!res.success) { setError(res.error || 'Credenciais inválidas.'); return; }
    if (res.firstAccess) { navigate('/first-access'); return; }
    navigate(isAdmin ? '/admin' : `/${sectorId}`);
  };

  return (
    <div style={S.page}>
      <div style={S.grid} />
      <div style={{ ...S.glow, background: `radial-gradient(circle,${sector.color}12 0%,transparent 65%)` }} />

      <div style={S.wrap}>
        <button style={S.backBtn} onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Voltar
        </button>

        <div style={{ ...S.card, border: `1px solid ${sector.color}28`, boxShadow: `0 0 60px ${sector.color}10,0 24px 64px rgba(0,0,0,0.6)` }}>
          {/* Logo / placeholder */}
          <div style={S.logoArea}>
            {sector.logo ? (
              <img
                src={sector.logo}
                alt={sector.label}
                style={{ width: 130, height: 130, objectFit: 'contain', filter: `drop-shadow(0 0 20px ${sector.color}60)` }}
              />
            ) : (
              <div style={{
                width: 130, height: 130, borderRadius: 20,
                background: `radial-gradient(circle at 40% 35%,${sector.color}25,${sector.color}08)`,
                border: `2px solid ${sector.color}30`,
                boxShadow: `0 0 28px ${sector.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
              }}>
                {sector.emoji}
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={S.title}>{sector.label}<span style={{ color: 'var(--neon)' }}>.</span></h1>
            <p style={S.sub}>Acesso Restrito</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
            <div style={S.field}>
              <label style={S.label}>ID DE ACESSO</label>
              <input style={S.input} type="text" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="Seu ID" autoFocus />
            </div>
            <div style={S.field}>
              <label style={S.label}>SENHA</label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...S.input, paddingRight: 44 }} type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" style={S.eye} onClick={() => setShow(!show)}>
                  {show ? <EyeOff size={15} color="var(--muted)" /> : <Eye size={15} color="var(--muted)" />}
                </button>
              </div>
            </div>
            {error && <p style={{ fontSize: 12, color: 'var(--neon)', textAlign: 'center' }}>{error}</p>}
            <button type="submit"
              style={{ ...S.btn, background: `linear-gradient(135deg,${sector.color},${sector.color}99)`, boxShadow: `0 4px 20px ${sector.color}40` }}
              disabled={loading}
            >
              {loading
                ? <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} />
                : 'ENTRAR'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#07070e', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  grid: { position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(238,51,99,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(238,51,99,.025) 1px,transparent 1px)', backgroundSize: '32px 32px' },
  glow: { position: 'fixed', width: 700, height: 700, borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' },
  wrap: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, padding: '0 20px' },
  backBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, marginBottom: 16, cursor: 'pointer', padding: '4px 0', fontFamily: 'var(--f)' },
  card: { background: 'rgba(14,14,28,.97)', borderRadius: 20, padding: '36px 36px 32px', backdropFilter: 'blur(20px)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoArea: { marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 4 },
  sub: { fontSize: 11, color: 'var(--muted)', letterSpacing: '.1em', fontFamily: 'var(--fm)' },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, outline: 'none', width: '100%', fontFamily: 'var(--f)' },
  eye: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  btn: { border: 'none', borderRadius: 10, padding: '13px', color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
};
