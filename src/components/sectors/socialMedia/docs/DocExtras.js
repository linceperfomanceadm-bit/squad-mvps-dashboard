import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { LAYOUTS, LAYOUT_PADRAO } from '../../../../lib/docs/layouts';
import { pontosDeInsercao } from '../../../../lib/docs/motor';

// ─────────────────────────────────────────────────────────────
// Lince Docs — SLIDES EXTRAS
//
// REGRA 3.9 — layout, não liberdade. Cinco modelos prontos; o extra
// escolhe um deles e o ponto do documento onde entra. Não existe
// campo de texto solto nem escolha de fonte ou cor.
// ─────────────────────────────────────────────────────────────

const novoId = () => `ex_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

function CamposDoExtra({ extra, onChange }) {
  const layout = LAYOUTS[extra.layout];
  if (!layout) return null;
  const set = (k, v) => onChange({ ...extra, d: { ...(extra.d || {}), [k]: v } });
  const d = extra.d || {};

  const setLinha = (campo, i, col, v) => {
    const linhas = Array.from({ length: campo.linhas }, (_, k) => (d[campo.id] && d[campo.id][k]) || {});
    linhas[i] = { ...linhas[i], [col]: v };
    set(campo.id, linhas);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      {layout.campos.map((c) => {
        if (c.tipo === 'lista') {
          const linhas = Array.from({ length: c.linhas }, (_, k) => (d[c.id] && d[c.id][k]) || {});
          return (
            <div key={c.id} style={S.campo}>
              <label style={S.label}>{c.rot}</label>
              {linhas.map((linha, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${c.cols.length},1fr)`, gap: 6 }}>
                  {c.cols.map((col) => (
                    <input
                      key={col.id}
                      style={{ ...S.input, fontSize: 12, padding: '7px 10px' }}
                      value={linha[col.id] || ''}
                      placeholder={col.rot}
                      onChange={(e) => setLinha(c, i, col.id, e.target.value)}
                    />
                  ))}
                </div>
              ))}
            </div>
          );
        }
        return (
          <div key={c.id} style={S.campo}>
            <label style={S.label}>{c.rot}</label>
            {c.tipo === 'area' ? (
              <textarea
                style={{ ...S.input, minHeight: 70, resize: 'vertical', lineHeight: 1.5 }}
                value={d[c.id] || ''}
                placeholder={c.ph || ''}
                onChange={(e) => set(c.id, e.target.value)}
              />
            ) : (
              <input
                style={S.input}
                value={d[c.id] || ''}
                placeholder={c.ph || ''}
                onChange={(e) => set(c.id, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DocExtras({ doc, extras, onChange }) {
  const [aberto, setAberto] = useState(null);
  const pontos = pontosDeInsercao(doc);
  const lista = extras || [];

  const adicionar = () => {
    const novo = {
      id: novoId(),
      layout: LAYOUT_PADRAO,
      depois: pontos.length ? pontos[0].id : '',
      d: {},
    };
    onChange([...lista, novo]);
    setAberto(novo.id);
  };

  const atualizar = (id, patch) => onChange(lista.map((e) => (e.id === id ? patch : e)));
  const remover = (id) => onChange(lista.filter((e) => e.id !== id));
  const mover = (i, passo) => {
    const novo = [...lista];
    const alvo = i + passo;
    if (alvo < 0 || alvo >= novo.length) return;
    [novo[i], novo[alvo]] = [novo[alvo], novo[i]];
    onChange(novo);
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={S.titulo}>Slides extras</h2>
        <p style={S.sub}>
          Cinco modelos prontos, inseridos entre os slides fixos. Nada entra depois do encerramento.
        </p>
      </div>

      {lista.length === 0 ? (
        <p style={S.vazio}>Nenhum slide extra. O documento sai com a estrutura padrão.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map((e, i) => {
            const ponto = pontos.find((p) => p.id === e.depois);
            return (
              <div key={e.id} style={S.card}>
                <div style={S.cardCab}>
                  <button
                    type="button"
                    style={S.cardBtn}
                    onClick={() => setAberto(aberto === e.id ? null : e.id)}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {LAYOUTS[e.layout] ? LAYOUTS[e.layout].nome : 'Layout removido'}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      depois de {ponto ? ponto.nome : '—'}
                    </span>
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" style={S.icone} onClick={() => mover(i, -1)} title="Subir">
                      <ChevronUp size={14} color="var(--muted)" />
                    </button>
                    <button type="button" style={S.icone} onClick={() => mover(i, 1)} title="Descer">
                      <ChevronDown size={14} color="var(--muted)" />
                    </button>
                    <button type="button" style={S.icone} onClick={() => remover(e.id)} title="Remover">
                      <Trash2 size={14} color="var(--neon)" />
                    </button>
                  </div>
                </div>

                {aberto === e.id && (
                  <div className="fade-in" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={S.campo}>
                        <label style={S.label}>Modelo</label>
                        <select
                          style={S.input}
                          value={e.layout}
                          onChange={(ev) => atualizar(e.id, { ...e, layout: ev.target.value, d: {} })}
                        >
                          {Object.keys(LAYOUTS).map((k) => (
                            <option key={k} value={k}>{LAYOUTS[k].nome}</option>
                          ))}
                        </select>
                      </div>
                      <div style={S.campo}>
                        <label style={S.label}>Entra depois de</label>
                        <select
                          style={S.input}
                          value={e.depois}
                          onChange={(ev) => atualizar(e.id, { ...e, depois: ev.target.value })}
                        >
                          {pontos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                      </div>
                    </div>
                    <CamposDoExtra extra={e} onChange={(novo) => atualizar(e.id, novo)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <button type="button" style={S.btnAdd} onClick={adicionar}>
        <Plus size={14} /> Adicionar slide extra
      </button>
    </div>
  );
}

const S = {
  titulo: { fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '-.3px' },
  sub: { fontSize: 12.5, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5, maxWidth: '62ch' },
  vazio: {
    fontSize: 13, color: 'var(--muted)', background: 'var(--surface)',
    border: '1px dashed var(--border)', borderRadius: 10, padding: '18px 20px',
  },
  card: { background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 12, padding: 13 },
  cardCab: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardBtn: {
    background: 'transparent', border: 'none', padding: 0, textAlign: 'left',
    display: 'flex', flexDirection: 'column', gap: 2, flex: 1,
  },
  icone: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 7,
    width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  campo: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase' },
  input: {
    background: '#12121f', border: '1px solid var(--border)', borderRadius: 9,
    padding: '9px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%',
  },
  btnAdd: {
    marginTop: 12, display: 'flex', alignItems: 'center', gap: 7,
    background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', borderRadius: 9,
    padding: '9px 15px', fontSize: 12.5, fontWeight: 600, color: 'var(--neon)',
  },
};
