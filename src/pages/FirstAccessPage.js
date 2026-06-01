import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function FirstAccessPage() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true);
    const res = await changePassword(password);
    setLoading(false);
    if (!res.success) { setError(res.error); return; }
    navigate(user?.isAdmin ? '/admin' : `/${user?.sector}`);
  };

  return (
    <div style={S.page}>
      <div style={S.card} className="fade-up">
        <div style={S.icon}><Lock size={28} color="var(--neon)" /></div>
        <h2 style={S.title}>Primeiro Acesso</h2>
        <p style={S.sub}>Crie sua senha pessoal para continuar. Ela não poderá ser recuperada, guarde-a bem.</p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }}>
          <div style={S.field}>
            <label style={S.label}>NOVA SENHA</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...S.input, paddingRight: 44 }} type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" autoFocus />
              <button type="button" style={S.eye} onClick={() => setShow(!show)}>
                {show ? <EyeOff size={14} color="var(--muted)" /> : <Eye size={14} color="var(--muted)" />}
              </button>
            </div>
          </div>
          <div style={S.field}>
            <label style={S.label}>CONFIRMAR SENHA</label>
            <input style={S.input} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repita a senha" />
          </div>
          {error && <p style={{ fontSize: 12, color: 'var(--neon)', textAlign: 'center' }}>{error}</p>}
          <button type="submit" style={S.btn} disabled={loading}>
            {loading ? <span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.3)' }} /> : 'DEFINIR SENHA E ENTRAR'}
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { background: 'rgba(14,14,28,.95)', border: '1px solid var(--neon-border)', borderRadius: 18, padding: '40px 36px', width: '100%', maxWidth: 380, boxShadow: '0 24px 64px rgba(0,0,0,.6)', textAlign: 'center' },
  icon: { width: 60, height: 60, borderRadius: 16, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 24px rgba(238,51,99,.25)' },
  title: { fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 },
  sub: { fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 },
  field: { display: 'flex', flexDirection: 'column', gap: 7, textAlign: 'left' },
  label: { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' },
  input: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '11px 14px', color: 'var(--text)', fontSize: 14, outline: 'none', width: '100%' },
  eye: { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', display: 'flex', alignItems: 'center', cursor: 'pointer' },
  btn: { background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: 14, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '.08em', boxShadow: '0 4px 20px rgba(238,51,99,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
};
