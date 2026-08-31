import React from 'react';
import { Lock, Info } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Lince Docs — FORMULÁRIO
//
// Gerado a partir do esquema do documento. Não conhece nenhum
// documento específico: lê `secao.campos` e desenha. Documento novo
// no catálogo aparece aqui sozinho.
//
// Tipos: 'texto', 'area' e 'lista' (linhas fixas com colunas).
// Uma coluna pode ser 'opcao', que vira select.
// ─────────────────────────────────────────────────────────────

function Dica({ children }) {
  if (!children) return null;
  return (
    <p style={S.dica}>
      <Info size={12} color="var(--muted)" style={{ flexShrink: 0, marginTop: 2 }} />
      <span>{children}</span>
    </p>
  );
}

// REGRA 3.2 — a base de cálculo trava no cliente.
// Depois de definida, mudar exige intenção explícita: dividir por
// seguidores, por alcance ou por views dá números muito diferentes,
// e trocar no meio invalida a comparação com todos os relatórios
// anteriores.
function CampoBase({ campo, valor, travada, desde, onChange, onDestravar }) {
  if (!travada) {
    return (
      <div style={S.campo}>
        <label style={S.label}>{campo.rot}</label>
        <input
          style={S.input}
          value={valor || ''}
          placeholder={campo.ph || ''}
          onChange={(e) => onChange(e.target.value)}
        />
        <Dica>{campo.dica}</Dica>
      </div>
    );
  }
  return (
    <div style={S.campo}>
      <label style={S.label}>{campo.rot}</label>
      <div style={S.travado}>
        <Lock size={14} color="var(--neon)" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, color: 'var(--text)', fontFamily: 'var(--fm)' }}>{valor}</p>
          {desde && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>em uso desde {desde}</p>}
        </div>
        <button type="button" style={S.btnGhost} onClick={onDestravar}>Alterar</button>
      </div>
      <Dica>Vale para todos os documentos deste cliente. Trocar quebra a comparação com os relatórios anteriores.</Dica>
    </div>
  );
}

function Lista({ campo, valor, onChange }) {
  const linhas = Array.from({ length: campo.linhas }, (_, i) => (valor && valor[i]) || {});
  // A grade acompanha o número de colunas declarado no esquema.
  const grade = { gridTemplateColumns: `18px repeat(${campo.cols.length}, 1fr)` };
  const set = (i, col, v) => {
    const novo = linhas.map((l) => ({ ...l }));
    novo[i] = { ...novo[i], [col]: v };
    onChange(novo);
  };

  return (
    <div style={S.campo}>
      <label style={S.label}>{campo.rot}</label>
      <Dica>{campo.dica}</Dica>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <div style={{ ...S.linha, ...grade, paddingBottom: 2 }}>
          <span style={S.numLinha} />
          {campo.cols.map((c) => (
            <span key={c.id} style={S.colRot}>{c.rot}</span>
          ))}
        </div>
        {linhas.map((linha, i) => (
          <div key={i} style={{ ...S.linha, ...grade }}>
            <span style={S.numLinha}>{i + 1}</span>
            {campo.cols.map((c) => (
              c.tipo === 'opcao' ? (
                <select
                  key={c.id}
                  style={{ ...S.input, padding: '7px 10px', fontSize: 12 }}
                  value={linha[c.id] || ''}
                  onChange={(e) => set(i, c.id, e.target.value)}
                >
                  <option value="">—</option>
                  {c.opcoes.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  key={c.id}
                  style={{ ...S.input, padding: '7px 10px', fontSize: 12 }}
                  value={linha[c.id] || ''}
                  placeholder={c.ph || ''}
                  onChange={(e) => set(i, c.id, e.target.value)}
                />
              )
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DocForm({
  secao, dados, onChange, campoBase, baseTravada, baseDesde, onDestravarBase,
  opcionalLigada, onToggleOpcional,
}) {
  if (!secao) return null;

  return (
    <div className="fade-in" key={secao.t}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={S.titulo}>{secao.t}</h2>
        {secao.opcional && (
          <label style={S.toggle}>
            <input
              type="checkbox"
              checked={opcionalLigada !== false}
              onChange={(e) => onToggleOpcional(secao.t, e.target.checked)}
              style={{ accentColor: '#EE3363', width: 15, height: 15 }}
            />
            <span>Incluir esta seção no documento</span>
          </label>
        )}
      </div>

      {(secao.opcional && opcionalLigada === false) ? (
        <p style={S.desligada}>
          Seção desligada. Os slides dela saem do documento e do PDF.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {secao.campos.map((c) => {
            if (c.id === campoBase) {
              return (
                <CampoBase
                  key={c.id}
                  campo={c}
                  valor={dados[c.id]}
                  travada={baseTravada}
                  desde={baseDesde}
                  onChange={(v) => onChange(c.id, v)}
                  onDestravar={onDestravarBase}
                />
              );
            }
            if (c.tipo === 'lista') {
              return <Lista key={c.id} campo={c} valor={dados[c.id]} onChange={(v) => onChange(c.id, v)} />;
            }
            return (
              <div key={c.id} style={S.campo}>
                <label style={S.label}>{c.rot}</label>
                <Dica>{c.dica}</Dica>
                {c.tipo === 'area' ? (
                  <textarea
                    style={{ ...S.input, minHeight: 92, resize: 'vertical', lineHeight: 1.5 }}
                    value={dados[c.id] || ''}
                    placeholder={c.ph || ''}
                    onChange={(e) => onChange(c.id, e.target.value)}
                  />
                ) : (
                  <input
                    style={S.input}
                    value={dados[c.id] || ''}
                    placeholder={c.ph || ''}
                    onChange={(e) => onChange(c.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  titulo: { fontSize: 19, fontWeight: 700, color: '#fff', letterSpacing: '-.3px' },
  campo: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontSize: 11, fontWeight: 600, color: 'var(--muted)',
    letterSpacing: '.1em', textTransform: 'uppercase',
  },
  input: {
    background: '#12121f', border: '1px solid var(--border)', borderRadius: 9,
    padding: '10px 13px', fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%',
  },
  dica: {
    display: 'flex', gap: 6, fontSize: 11.5, color: 'var(--muted)',
    lineHeight: 1.5, maxWidth: '68ch',
  },
  linha: { display: 'grid', gap: 6, alignItems: 'center' },
  numLinha: { fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--fm)', textAlign: 'right' },
  colRot: { fontSize: 10, color: 'var(--muted)', letterSpacing: '.06em', paddingLeft: 2 },
  travado: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--neon-dim)', border: '1px solid var(--neon-border)',
    borderRadius: 9, padding: '10px 13px',
  },
  btnGhost: {
    background: 'transparent', border: '1px solid var(--border-h)', borderRadius: 7,
    padding: '5px 11px', fontSize: 11.5, color: 'var(--muted)',
  },
  toggle: {
    display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8,
    fontSize: 12.5, color: 'var(--muted)', cursor: 'pointer',
  },
  desligada: {
    fontSize: 13, color: 'var(--muted)', background: 'var(--surface)',
    border: '1px dashed var(--border)', borderRadius: 10, padding: '18px 20px', lineHeight: 1.6,
  },
};
