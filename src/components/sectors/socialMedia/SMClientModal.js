import React from 'react';
import ReactDOM from 'react-dom';
import { X, FileText, Kanban, Palette, Calculator, Plus, ExternalLink } from 'lucide-react';
import { docPorId } from '../../../lib/docs/catalogo';
import { DOC_STATUS } from '../../../hooks/useDocuments';
import { resolveClientHealth, HEALTH_LEVELS_4 } from '../../../hooks/useClientHealth';

// ─────────────────────────────────────────────────────────────
// Mural do Social Media — FICHA DO CLIENTE
//
// Reúne, num lugar só, o que a social media precisa saber sobre um
// cliente: a base de cálculo travada, os documentos já produzidos, as
// tasks abertas e o material de marca. Tudo já existe no app — o que
// faltava era estar junto.
// ─────────────────────────────────────────────────────────────

const STATUS_TASK = {
  todo: { label: 'Não iniciada', color: 'var(--muted)' },
  doing: { label: 'Em produção', color: 'var(--blue)' },
  approval: { label: 'Em aprovação', color: 'var(--amber)' },
  done: { label: 'Concluída', color: 'var(--green)' },
};

const data = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

function Bloco({ icone: Icone, titulo, acao, children }) {
  return (
    <section style={S.bloco}>
      <div style={S.blocoCab}>
        <Icone size={13} color="var(--muted)" />
        <span style={S.blocoTit}>{titulo}</span>
        <div style={{ flex: 1 }} />
        {acao}
      </div>
      {children}
    </section>
  );
}

export default function SMClientModal({
  cliente, documentos, tasks, onClose, onAbrirDocumento, onNovoDocumento,
}) {
  if (!cliente) return null;

  const saude = resolveClientHealth(cliente);
  const nivel = saude && HEALTH_LEVELS_4[saude.level];
  const base = cliente.sm?.baseCalculo;
  const marca = cliente.brandbook || {};
  const materiais = marca.materials || [];

  const abertas = tasks.filter((t) => t.status !== 'done');
  const concluidas = tasks.filter((t) => t.status === 'done').length;

  return ReactDOM.createPortal(
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} className="fade-up" onClick={(e) => e.stopPropagation()}>
        <header style={S.cab}>
          <div style={{ minWidth: 0 }}>
            <h2 style={S.nome}>{cliente.name}</h2>
            <p style={S.sub}>
              {nivel ? nivel.label : 'Sem farol'}
              {` · ${documentos.length} ${documentos.length === 1 ? 'documento' : 'documentos'}`}
              {` · ${abertas.length} ${abertas.length === 1 ? 'task aberta' : 'tasks abertas'}`}
            </p>
          </div>
          <button type="button" style={S.fechar} onClick={onClose}>
            <X size={16} color="var(--muted)" />
          </button>
        </header>

        <div style={S.corpo}>
          {/* Base de cálculo — a decisão que atravessa todos os relatórios */}
          <Bloco icone={Calculator} titulo="Base de cálculo do engajamento">
            {base ? (
              <div style={S.baseCaixa}>
                <p style={S.baseValor}>{base}</p>
                {cliente.sm?.baseCalculoDesde && (
                  <p style={S.baseDesde}>em uso desde {cliente.sm.baseCalculoDesde}</p>
                )}
              </div>
            ) : (
              <p style={S.vazio}>
                Ainda não definida. Ela é travada na pré-estratégia e todos os relatórios seguintes usam a mesma.
              </p>
            )}
          </Bloco>

          {/* Documentos */}
          <Bloco
            icone={FileText}
            titulo="Documentos"
            acao={(
              <button type="button" style={S.btnPeq} onClick={() => onNovoDocumento(cliente)}>
                <Plus size={12} /> Novo
              </button>
            )}
          >
            {documentos.length === 0 ? (
              <p style={S.vazio}>Nenhum documento. Comece pela pré-estratégia.</p>
            ) : (
              <ul style={S.lista}>
                {documentos.map((d) => {
                  const tipo = docPorId(d.tipo);
                  const st = DOC_STATUS[d.status] || DOC_STATUS.rascunho;
                  return (
                    <li key={d.id}>
                      <button type="button" style={S.item} onClick={() => onAbrirDocumento(d.id)}>
                        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <span style={S.itemTit}>{tipo ? tipo.nome.split('—')[0].trim() : d.tipo}</span>
                          <span style={S.itemSub}>
                            {data(d.updatedAt)}
                            {d.updatedByName && ` · ${d.updatedByName}`}
                            {d.versionCount > 0 && ` · ${d.versionCount} ${d.versionCount === 1 ? 'versão' : 'versões'}`}
                          </span>
                        </span>
                        <span style={{ ...S.chip, color: st.color, borderColor: `${st.color}45` }}>{st.label}</span>
                        <ExternalLink size={12} color="var(--muted)" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Bloco>

          {/* Tasks */}
          <Bloco icone={Kanban} titulo={`Tasks${concluidas ? ` · ${concluidas} concluídas` : ''}`}>
            {abertas.length === 0 ? (
              <p style={S.vazio}>Nenhuma task aberta para este cliente.</p>
            ) : (
              <ul style={S.lista}>
                {abertas.slice(0, 8).map((t) => {
                  const st = STATUS_TASK[t.status] || STATUS_TASK.todo;
                  return (
                    <li key={t.id} style={S.itemEstatico}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={S.itemTit}>{t.name}</span>
                        <span style={S.itemSub}>
                          {t.responsibleName || '—'}
                          {t.deadline && ` · entrega ${new Date(t.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                        </span>
                      </span>
                      <span style={{ ...S.chip, color: st.color, borderColor: 'var(--border)' }}>{st.label}</span>
                    </li>
                  );
                })}
                {abertas.length > 8 && (
                  <li style={S.mais}>e mais {abertas.length - 8}. Veja todas na aba Tasks.</li>
                )}
              </ul>
            )}
          </Bloco>

          {/* Marca */}
          <Bloco icone={Palette} titulo="Marca">
            {(marca.colors?.length || marca.typography || marca.driveLink || materiais.length) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {marca.colors?.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {marca.colors.map((c) => (
                      <span key={c} style={{ ...S.cor, background: c }} title={c} />
                    ))}
                  </div>
                )}
                {marca.typography && <p style={S.texto}>{marca.typography}</p>}
                <p style={S.itemSub}>
                  {materiais.length
                    ? `${materiais.length} ${materiais.length === 1 ? 'material' : 'materiais'} no Brand Hub`
                    : 'Sem materiais no Brand Hub'}
                </p>
              </div>
            ) : (
              <p style={S.vazio}>Marca ainda não preenchida. O Brand Hub é onde isso vive.</p>
            )}
          </Bloco>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(3,3,8,.78)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998, padding: 20,
  },
  modal: {
    background: 'var(--bg2)', border: '1px solid var(--neon-border)', borderRadius: 16,
    width: '100%', maxWidth: 560, maxHeight: '86vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 70px rgba(0,0,0,.6)',
  },
  cab: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
    padding: '18px 20px', borderBottom: '1px solid var(--border)',
  },
  nome: { fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-.3px' },
  sub: { fontSize: 12, color: 'var(--muted)', marginTop: 3 },
  fechar: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  corpo: { padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 },
  bloco: {},
  blocoCab: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 },
  blocoTit: { fontSize: 10.5, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' },
  vazio: { fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 },
  texto: { fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 },
  baseCaixa: {
    background: 'var(--neon-dim)', border: '1px solid var(--neon-border)',
    borderRadius: 10, padding: '11px 14px',
  },
  baseValor: { fontSize: 13.5, color: 'var(--text)', fontFamily: 'var(--fm)' },
  baseDesde: { fontSize: 11, color: 'var(--muted)', marginTop: 3 },
  lista: { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 },
  item: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
  },
  itemEstatico: {
    display: 'flex', alignItems: 'center', gap: 9,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
  },
  itemTit: { display: 'block', fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemSub: { display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  chip: {
    fontSize: 9.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase',
    border: '1px solid', borderRadius: 100, padding: '3px 8px', flexShrink: 0,
  },
  mais: { fontSize: 11.5, color: 'var(--muted)', paddingLeft: 2 },
  cor: { width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border-h)' },
  btnPeq: {
    display: 'flex', alignItems: 'center', gap: 4, background: 'transparent',
    border: '1px solid var(--neon-border)', borderRadius: 7, padding: '4px 9px',
    fontSize: 11, fontWeight: 600, color: 'var(--neon)',
  },
};
