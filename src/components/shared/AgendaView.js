import React from 'react';
import { Calendar } from 'lucide-react';
import { useAppConfig } from '../../hooks/useAppConfig';

/*
 * Agenda (exibição). Mostra o Google Calendar configurado pelo admin
 * em app_config/general.
 *
 * FUNDO ESCURO: o Google ignora o parâmetro bgcolor no embed, então
 * forçamos o tema escuro por CSS, com um filtro de inversão aplicado
 * ao iframe:
 *   invert(1)        -> branco vira escuro (fundo)
 *   hue-rotate(180)  -> gira as cores de volta para perto do original
 *   contrast(.9)     -> suaviza para não ficar "lavado"
 * Efeito colateral conhecido: as cores dos eventos ficam aproximadas,
 * não 100% fiéis (limite da técnica sem usar a API do Google).
 *
 * Ajuste fino: mexa em INVERT_FILTER abaixo.
 */
const INVERT_FILTER = 'invert(0.92) hue-rotate(180deg) contrast(0.9) brightness(1.05)';

export default function AgendaView() {
  const { config, loading } = useAppConfig();
  const embedUrl = config.agendaEmbedUrl;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 }}>Agenda</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Calendário da agência, em tempo real.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" style={{ width: 30, height: 30 }} /></div>
      ) : embedUrl ? (
        <div style={{
          borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)',
          background: '#121826',
          boxShadow: '0 8px 32px rgba(0,0,0,.4)',
        }}>
          <iframe
            title="Agenda da Agência"
            src={embedUrl}
            style={{
              width: '100%', height: 'calc(100vh - 200px)', minHeight: 520,
              border: 'none', display: 'block',
              filter: INVERT_FILTER,
            }}
          />
        </div>
      ) : (
        <div style={{ background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 16, textAlign: 'center', padding: '48px 24px' }}>
          <Calendar size={36} color="var(--muted)" style={{ marginBottom: 12 }} />
          <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginBottom: 6 }}>Agenda ainda não configurada</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
            O administrador pode configurá-la no painel Admin, na aba Agenda.
          </p>
        </div>
      )}
    </div>
  );
}
