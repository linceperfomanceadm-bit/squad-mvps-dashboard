import React, { useState } from 'react';
import { Plus, FileText, Trash2, Clock } from 'lucide-react';
import { docPorId } from '../../../../lib/docs/catalogo';
import { DOC_STATUS } from '../../../../hooks/useDocuments';
import NovoDocumentoModal from './NovoDocumentoModal';

// ─────────────────────────────────────────────────────────────
// Lince Docs — LISTA
//
// Porta de entrada dos documentos: o que está em aberto e o botão de
// criar. O acesso do dia a dia acontece pelo cliente, no Mural.
// ─────────────────────────────────────────────────────────────

const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

const quando = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

export default function DocsList({
  documents, clients, currentUser, isAdmin, onOpen, onCreate, onDelete,
}) {
  const [criando, setCriando] = useState(false);

  // Só admin e o social media responsável pelo cliente podem apagar.
  const podeApagar = (d) => {
    if (isAdmin) return true;
    const cliente = clients.find((c) => c.id === d.clientId);
    return asArray(cliente?.responsibles?.socialmedia).includes(currentUser);
  };

  const apagar = (d) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Apagar o documento de ${d.clientName}? As versões salvas vão junto.`)) return;
    onDelete(d.id);
  };

  return (
    <div className="fade-up">
      <div style={S.cab}>
        <div>
          <h1 style={S.titulo}>Documentos</h1>
          <p style={S.sub}>Pré-estratégias e relatórios dos seus clientes.</p>
        </div>
        <button type="button" style={S.btn} onClick={() => setCriando(true)}>
          <Plus size={15} /> Novo documento
        </button>
      </div>

      {documents.length === 0 ? (
        <div style={S.vazio}>
          <FileText size={24} color="var(--muted)" />
          <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 12 }}>Nenhum documento ainda.</p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
            Comece pela pré-estratégia: ela define a base de cálculo que todos os relatórios seguintes usam.
          </p>
        </div>
      ) : (
        <div style={S.grade}>
          {documents.map((d) => {
            const doc = docPorId(d.tipo);
            const status = DOC_STATUS[d.status] || DOC_STATUS.rascunho;
            return (
              <div key={d.id} style={S.card}>
                <button type="button" style={S.cardBtn} onClick={() => onOpen(d.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <span style={S.cliente}>{d.clientName || 'Sem cliente'}</span>
                    <span style={{ ...S.chip, color: status.color, borderColor: `${status.color}45` }}>
                      {status.label}
                    </span>
                  </div>
                  <p style={S.tipo}>{doc ? doc.nome.split('—')[0].trim() : d.tipo}</p>
                  <p style={S.rodape}>
                    <Clock size={11} color="var(--muted)" />
                    {quando(d.updatedAt)}
                    {d.updatedByName && ` · ${d.updatedByName}`}
                    {d.versionCount > 0 && ` · ${d.versionCount} ${d.versionCount === 1 ? 'versão' : 'versões'}`}
                  </p>
                </button>
                {podeApagar(d) && (
                  <button type="button" style={S.lixo} onClick={() => apagar(d)} title="Apagar documento">
                    <Trash2 size={13} color="var(--muted)" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {criando && (
        <NovoDocumentoModal
          clients={clients}
          onClose={() => setCriando(false)}
          onCreate={async (dados) => {
            const res = await onCreate(dados);
            if (res?.success) setCriando(false);
            return res;
          }}
        />
      )}
    </div>
  );
}

const S = {
  cab: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 26 },
  titulo: { fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--muted)' },
  btn: {
    display: 'flex', alignItems: 'center', gap: 7, background: 'var(--neon)',
    border: 'none', borderRadius: 9, padding: '10px 17px',
    fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0,
  },
  vazio: {
    background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14,
    padding: '46px 30px', textAlign: 'center', maxWidth: 460,
  },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 },
  card: {
    background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14,
    padding: 16, position: 'relative', display: 'flex',
  },
  cardBtn: {
    background: 'transparent', border: 'none', padding: 0, textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0,
  },
  cliente: {
    fontSize: 14.5, fontWeight: 700, color: '#fff', letterSpacing: '-.2px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  chip: {
    fontSize: 9.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
    border: '1px solid', borderRadius: 100, padding: '3px 8px', flexShrink: 0,
  },
  tipo: { fontSize: 12.5, color: 'var(--muted)' },
  rodape: {
    fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center',
    gap: 5, marginTop: 4, fontFamily: 'var(--fm)',
  },
  lixo: {
    position: 'absolute', bottom: 12, right: 12, background: 'transparent',
    border: '1px solid var(--border)', borderRadius: 7,
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
