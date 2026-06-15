import React, { useState, useEffect } from 'react';
import { Calendar, Save, ExternalLink } from 'lucide-react';
import { useAppConfig } from '../../hooks/useAppConfig';

/*
 * Aba Agenda no painel Admin. O admin cola aqui a URL de incorporação
 * do Google Calendar (uma vez), e todos os painéis passam a exibir a
 * agenda. Guardado em app_config/general.
 */
export default function AdminAgenda({ toast }) {
  const { config, loading, saveConfig } = useAppConfig();
  const [url, setUrl] = useState('');

  useEffect(() => { setUrl(config.agendaEmbedUrl || ''); }, [config.agendaEmbedUrl]);

  const save = async () => {
    const clean = url.trim();
    if (clean && !clean.includes('calendar.google.com')) {
      toast('A URL não parece ser do Google Calendar. Verifique e tente de novo.', 'e');
      return;
    }
    const r = await saveConfig({ agendaEmbedUrl: clean });
    if (r.success) toast('Agenda salva! Já aparece em todos os painéis.');
    else toast(r.error, 'e');
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Agenda</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Integre o Google Calendar da agência. Aparece para todos os setores.</p>
      </div>

      {/* Passo a passo */}
      <div style={{ background: 'rgba(56,189,248,.06)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--fm)', letterSpacing: '.06em', marginBottom: 10 }}>COMO OBTER A URL</p>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text)', lineHeight: 1.7 }}>
          <li>Abra o <strong>Google Calendar</strong> no computador.</li>
          <li>Ao lado do calendário da agência → menu (⋮) → <strong>Configurações e compartilhamento</strong>.</li>
          <li>Em <strong>Permissões de acesso</strong>, marque <strong>"Tornar disponível publicamente"</strong> (necessário para todos verem).</li>
          <li>Role até <strong>"Integrar agenda"</strong> e copie o endereço dentro de <span style={{ fontFamily: 'var(--fm)', color: '#38bdf8' }}>src="..."</span> do código de incorporação.</li>
          <li>Cole abaixo e salve.</li>
        </ol>
        <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#38bdf8', textDecoration: 'none', marginTop: 10, fontWeight: 600 }}>
          <ExternalLink size={13} /> Abrir Google Calendar
        </a>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 30, height: 30 }} /></div>
      ) : (
        <>
          <div style={CARD}>
            <label style={LBL}>URL DE INCORPORAÇÃO</label>
            <textarea
              value={url}
              onChange={e => setUrl(e.target.value)}
              rows={3}
              placeholder="https://calendar.google.com/calendar/embed?src=..."
              style={{ ...INP, fontFamily: 'var(--fm)', fontSize: 12, resize: 'vertical', marginTop: 8 }}
            />
            <button onClick={save} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,var(--neon),#c41f4a)', border: 'none', borderRadius: 10, padding: '11px 20px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 14, boxShadow: '0 4px 14px rgba(238,51,99,.3)' }}>
              <Save size={15} /> Salvar agenda
            </button>
          </div>

          {/* Prévia */}
          {config.agendaEmbedUrl && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={13} /> Prévia (o que todos verão):</p>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', background: '#121826' }}>
                <iframe title="Prévia da Agenda" src={config.agendaEmbedUrl} style={{ width: '100%', height: 480, border: 'none', display: 'block', filter: 'invert(0.92) hue-rotate(180deg) contrast(0.9) brightness(1.05)' }} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const LBL = { fontSize: 10, letterSpacing: '.14em', color: 'var(--muted)', fontWeight: 600, fontFamily: 'var(--fm)' };
const INP = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 13px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%', fontFamily: 'var(--f)' };
const CARD = { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 };
