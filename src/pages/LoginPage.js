import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SECTORS } from '../lib/firebase';

export default function LoginPage() {
  const { sectorId } = useParams();
  const { loginCollaborator, loginAdmin } = useAuth();
  const navigate = useNavigate();
  const isAdmin = sectorId === 'admin';
  const sector = SECTORS[sectorId];
  const color = sector?.color || 'var(--neon)';

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
    <div style={{ ...S.page, '--c': color }}>
      <div style={S.grid} />
      <div style={{ ...S.glow, background: `radial-gradient(circle,${color}15 0%,transparent 65%)` }} />

      <div style={S.wrap} className="fade-up">
        <button style={S.backBtn} onClick={() => navigate('/')}>
          <ArrowLeft size={14} /> Voltar
        </button>

        <div style={{ ...S.card, border: `1px solid ${color}30` }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ ...S.icon, background: `${color}18`, border: `1px solid ${color}35`, boxShadow: `0 0 24px ${color}30` }}>
              <span style={{ fontSize: 28 }}>{isAdmin ? '👑' : sector?.emoji}</span>
            </div>
            <h1 style={S.title}>{isAdmin ? 'Admin' : sector?.label}<span style={{ color: 'var(--neon)' }}>.</span></h1>
            <p style={S.sub}>Acesso Restrito</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
            <button type="submit" style={{ ...S.btn, background: `linear-gradient(135deg,${color},${color}99)`, boxShadow: `0 4px 20px ${color}40` }} disabled={loading}>
              {loading ? <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> : 'ENTRAR'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  grid: { position: 'fixed', inset: 0, backgroundImage: 'linear-gradient(rgba(238,51,99,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(238,51,99,.025) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' },
  glow: { position: 'fixed', width: 600, height: 600, borderRadius: '50%', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' },
  wrap: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, padding: 20 },
  backBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, marginBottom: 16, cursor: 'pointer', padding: '4px 0' },
  card: { background: 'rgba(14,14,28,.95)', borderRadius: 18, padding: '40px 36px', backdropFilter: 'blur(20px)', boxShadow: '0 24px 64px rgba(0,0,0,.6)' },
  icon: { width: 64, height: 64, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 4 },
  sub: { fontSize: 11, color: 'var(--muted)', letterSpacing: '.1em', fontFamily: 'var(--fm)' },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', width: '100%', transition: 'border-color .2s' },
  eye: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  btn: { border: 'none', borderRadius: 10, padding: 14, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
};
