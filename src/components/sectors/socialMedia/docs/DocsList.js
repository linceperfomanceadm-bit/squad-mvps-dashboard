import React, { useMemo, useState } from 'react';
import { Plus, FileText, Trash2, Clock, Play, Folder, ArrowLeft, Search } from 'lucide-react';
import { docPorId } from '../../../../lib/docs/catalogo';
import { DOC_STATUS } from '../../../../hooks/useDocuments';
import NovoDocumentoModal from './NovoDocumentoModal';
import DocPresenter from './DocPresenter';

// ─────────────────────────────────────────────────────────────
// Lince Docs — LISTA
//
// Porta de entrada dos documentos, organizada em pastas por cliente:
// a pasta nasce sozinha com o primeiro documento do cliente e reúne
// todos os que vierem depois (pré-estratégia, relatórios), para achar
// o histórico de um cliente sem garimpar uma grade única.
//
// As pastas são só agrupamento na tela — o documento já guarda o
// `clientId`, então não há dado novo nem migração. Documento de
// cliente que saiu da carteira continua agrupado pelo `clientName`.
// ─────────────────────────────────────────────────────────────

const SEM_CLIENTE = '__sem_cliente__';

const asArray = (v) => (Array.isArray(v) ? v : (v ? [v] : []));

const quando = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const ms = (ts) => {
  if (!ts) return 0;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const EM_ABERTO = ['rascunho', 'revisao'];

export default function DocsList({
  documents, clients, currentUser, isAdmin, onOpen, onCreate, onDelete, onSalvarPDF,
}) {
  const [criando, setCriando] = useState(false);
  const [pastaId, setPastaId] = useState(null);
  const [busca, setBusca] = useState('');
  // Apresenta direto da lista, sem abrir o editor — é o caminho da
  // reunião com o cliente. Guarda só o id: o documento vem do array
  // ao vivo, então uma correção feita no editor aparece na hora.
  const [apresentandoId, setApresentandoId] = useState(null);
  const apresentando = apresentandoId ? documents.find((d) => d.id === apresentandoId) || null : null;
  const docApresentando = apresentando ? docPorId(apresentando.tipo) : null;

  // Só admin e o social media responsável pelo cliente podem apagar.
  const podeApagar = (d) => {
    if (isAdmin) return true;
    const cliente = clients.find((c) => c.id === d.clientId);
    return asArray(cliente?.responsibles?.socialmedia).includes(currentUser);
  };

  // Uma pasta por cliente com documento. A lista já chega ordenada por
  // `updatedAt` desc (useDocuments), então o primeiro de cada pasta é o
  // mais recente e as pastas saem na ordem da última movimentação.
  const pastas = useMemo(() => {
    const mapa = new Map();
    documents.forEach((d) => {
      const id = d.clientId || SEM_CLIENTE;
      if (!mapa.has(id)) {
        const cliente = clients.find((c) => c.id === d.clientId);
        mapa.set(id, { id, nome: cliente?.name || d.clientName || 'Sem cliente', docs: [] });
      }
      mapa.get(id).docs.push(d);
    });
    return [...mapa.values()]
      .map((p) => ({
        ...p,
        ultimo: p.docs[0],
        abertos: p.docs.filter((d) => EM_ABERTO.includes(d.status || 'rascunho')).length,
      }))
      .sort((a, b) => ms(b.ultimo?.updatedAt) - ms(a.ultimo?.updatedAt));
  }, [documents, clients]);

  // Pasta aberta some quando o último documento dela é apagado.
  const pasta = pastaId ? pastas.find((p) => p.id === pastaId) || null : null;

  const q = busca.trim().toLowerCase();
  const pastasVisiveis = q ? pastas.filter((p) => p.nome.toLowerCase().includes(q)) : pastas;

  const apagar = (d) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Apagar o documento de ${d.clientName}? As versões salvas vão junto.`)) return;
    onDelete(d.id);
  };

  const cardDoc = (d) => {
    const doc = docPorId(d.tipo);
    const status = DOC_STATUS[d.status] || DOC_STATUS.rascunho;
    return (
      <div key={d.id} style={S.card}>
        <button type="button" style={S.cardBtn} onClick={() => onOpen(d.id)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
            <span style={S.cliente}>{doc ? doc.nome.split('—')[0].trim() : d.tipo}</span>
            <span style={{ ...S.chip, color: status.color, borderColor: `color-mix(in srgb, ${status.color} 27%, transparent)` }}>
              {status.label}
            </span>
          </div>
          {d.titulo && <p style={S.tipo}>{d.titulo}</p>}
          <p style={S.rodape}>
            <Clock size={11} color="var(--muted)" />
            {quando(d.updatedAt)}
            {d.updatedByName && ` · ${d.updatedByName}`}
            {d.versionCount > 0 && ` · ${d.versionCount} ${d.versionCount === 1 ? 'versão' : 'versões'}`}
          </p>
        </button>
        {doc && (
          <button type="button" style={S.apresentar} onClick={() => setApresentandoId(d.id)} title="Apresentar em tela cheia">
            <Play size={12} /> Apresentar
          </button>
        )}
        {podeApagar(d) && (
          <button type="button" style={S.lixo} onClick={() => apagar(d)} title="Apagar documento">
            <Trash2 size={13} color="var(--muted)" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="fade-up">
      {pasta ? (
        <>
          <button type="button" style={S.voltar} onClick={() => setPastaId(null)}>
            <ArrowLeft size={14} /> Todos os clientes
          </button>
          <div style={S.cab}>
            <div style={{ minWidth: 0 }}>
              <h1 style={S.titulo}>{pasta.nome}</h1>
              <p style={S.sub}>
                {pasta.docs.length} {pasta.docs.length === 1 ? 'documento' : 'documentos'}
                {pasta.abertos > 0 && ` · ${pasta.abertos} em aberto`}
              </p>
            </div>
            {pasta.id !== SEM_CLIENTE && clients.some((c) => c.id === pasta.id) && (
              <button type="button" style={S.btn} onClick={() => setCriando(true)}>
                <Plus size={15} /> Novo documento
              </button>
            )}
          </div>
          <div style={S.grade}>{pasta.docs.map(cardDoc)}</div>
        </>
      ) : (
        <>
          <div style={S.cab}>
            <div>
              <h1 style={S.titulo}>Documentos</h1>
              <p style={S.sub}>Pré-estratégias e relatórios, organizados por cliente.</p>
            </div>
            <button type="button" style={S.btn} onClick={() => setCriando(true)}>
              <Plus size={15} /> Novo documento
            </button>
          </div>

          {pastas.length === 0 ? (
            <div style={S.vazio}>
              <FileText size={24} color="var(--muted)" />
              <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 12 }}>Nenhum documento ainda.</p>
              <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                Comece pela pré-estratégia: ela define a base de cálculo que todos os relatórios seguintes usam.
                A pasta do cliente aparece aqui com o primeiro documento.
              </p>
            </div>
          ) : (
            <>
              {pastas.length > 6 && (
                <div style={{ position: 'relative', maxWidth: 260, marginBottom: 14 }}>
                  <Search size={14} color="var(--dim)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
                  <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" style={S.busca} />
                </div>
              )}
              {pastasVisiveis.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>Nenhum cliente com esse nome.</p>
              ) : (
                <div style={S.grade}>
                  {pastasVisiveis.map((p) => {
                    const docUltimo = p.ultimo ? docPorId(p.ultimo.tipo) : null;
                    return (
                      <button key={p.id} type="button" style={S.pasta} onClick={() => setPastaId(p.id)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={S.pastaIcone}><Folder size={16} color="var(--c)" /></span>
                          <span style={{ ...S.cliente, flex: 1, minWidth: 0 }}>{p.nome}</span>
                          {p.abertos > 0 && (
                            <span style={S.abertos} title="Documentos em rascunho ou em revisão">
                              {p.abertos} em aberto
                            </span>
                          )}
                        </div>
                        <p style={S.tipo}>
                          {p.docs.length} {p.docs.length === 1 ? 'documento' : 'documentos'}
                          {docUltimo && ` · último: ${docUltimo.nome.split('—')[0].trim()}`}
                        </p>
                        <p style={S.rodape}>
                          <Clock size={11} color="var(--muted)" />
                          {quando(p.ultimo?.updatedAt)}
                          {p.ultimo?.updatedByName && ` · ${p.ultimo.updatedByName}`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {apresentando && docApresentando && (
        <DocPresenter
          doc={docApresentando}
          dados={apresentando.dados || {}}
          opcionais={apresentando.opcionais || {}}
          extras={apresentando.extras || []}
          titulo={`${apresentando.clientName || 'Sem cliente'} · ${docApresentando.nome.split('—')[0].trim()}`}
          onClose={() => setApresentandoId(null)}
          onSalvarPDF={onSalvarPDF ? () => onSalvarPDF(apresentando) : undefined}
        />
      )}

      {criando && (
        <NovoDocumentoModal
          clients={clients}
          clienteInicial={pasta && pasta.id !== SEM_CLIENTE ? pasta.id : ''}
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
  voltar: {
    display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
    padding: 0, marginBottom: 14, fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer',
  },
  busca: {
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 99, padding: '8px 12px 8px 32px',
    color: 'var(--text)', fontSize: 12.5, outline: 'none', width: '100%', fontFamily: 'var(--f)',
  },
  pasta: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: 16,
    display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', cursor: 'pointer',
  },
  pastaIcone: {
    width: 30, height: 30, borderRadius: 9, background: 'var(--c-dim)', border: '1px solid var(--c-border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  abertos: {
    fontSize: 10.5, color: 'var(--amber)', border: '1px solid var(--amber-b)', borderRadius: 100,
    padding: '2px 8px', flexShrink: 0, fontFamily: 'var(--fm)',
  },
  cab: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 26 },
  titulo: { fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--muted)' },
  btn: {
    display: 'flex', alignItems: 'center', gap: 7, background: 'var(--neon)',
    border: 'none', borderRadius: 9, padding: '10px 17px',
    fontSize: 13, fontWeight: 600, color: 'var(--text)', flexShrink: 0,
  },
  vazio: {
    background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14,
    padding: '46px 30px', textAlign: 'center', maxWidth: 460,
  },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 },
  card: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
    padding: 16, position: 'relative', display: 'flex',
  },
  cardBtn: {
    background: 'transparent', border: 'none', padding: 0, textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 0, paddingBottom: 28,
  },
  cliente: {
    fontSize: 14.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.2px',
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
  apresentar: {
    position: 'absolute', bottom: 12, right: 44, height: 26, background: 'var(--neon-dim)',
    border: '1px solid var(--neon-border)', borderRadius: 7, padding: '0 9px',
    display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--neon)',
  },
  lixo: {
    position: 'absolute', bottom: 12, right: 12, background: 'transparent',
    border: '1px solid var(--border)', borderRadius: 7,
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};
