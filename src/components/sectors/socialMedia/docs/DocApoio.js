import React, { useState } from 'react';
import { AlertTriangle, Check, ClipboardList, BarChart3 } from 'lucide-react';
import { balancoFunil, checarGargalo, checarPeriodos, pendenciasDoTexto } from '../../../../lib/docs/motor';

// ─────────────────────────────────────────────────────────────
// Lince Docs — APOIO INTERNO
//
// REGRA 3.10 — nada daqui entra no PDF. Balanço do funil, painel de
// pendências e as checagens das regras 3.4 e 3.7 existem para a
// pessoa que está montando o documento, não para o cliente.
// ─────────────────────────────────────────────────────────────

function Caixa({ icone: Icone, titulo, cor, children }) {
  return (
    <div style={{ ...S.caixa, borderColor: cor ? `${cor}35` : 'var(--border)' }}>
      <div style={S.cab}>
        <Icone size={14} color={cor || 'var(--muted)'} />
        <span style={S.cabTxt}>{titulo}</span>
      </div>
      {children}
    </div>
  );
}

// Conta peças e pesos por etapa e avisa quando alguma está zerada.
// Um mês inteiro de topo explica alcance alto com conversa parada.
function Balanco({ dados }) {
  const b = balancoFunil(dados);
  return (
    <Caixa icone={BarChart3} titulo="Balanço do funil" cor="#38bdf8">
      {b.semDados ? (
        <p style={S.vazio}>Marque a etapa nos pilares e no mockup para ver o equilíbrio.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            {b.etapas.map((e) => (
              <div key={e.nome} style={{ ...S.etapa, opacity: (e.pecas || e.peso) ? 1 : 0.45 }}>
                <span style={S.etapaNome}>{e.nome}</span>
                <span style={S.etapaNum}>{e.peso}%</span>
                <span style={S.etapaPecas}>{e.pecas} {e.pecas === 1 ? 'peça' : 'peças'}</span>
              </div>
            ))}
          </div>
          {b.vazias.length > 0 && (
            <p style={S.alerta}>
              Sem nada em {b.vazias.join(' e ')}. O documento planeja um mês que não fecha o ciclo.
            </p>
          )}
        </>
      )}
    </Caixa>
  );
}

// As marcações que o agente de IA gera — Checagem e A confirmar —
// são coladas aqui e riscadas conforme se resolvem.
function Pendencias({ pendencias, onChange }) {
  const [colando, setColando] = useState(false);
  const [texto, setTexto] = useState('');
  const abertas = pendencias.filter((p) => !p.ok).length;

  const colar = () => {
    onChange(pendenciasDoTexto(texto, pendencias));
    setTexto('');
    setColando(false);
  };

  const alternar = (i) => onChange(pendencias.map((p, k) => (k === i ? { ...p, ok: !p.ok } : p)));

  return (
    <Caixa icone={ClipboardList} titulo={`Pendências${abertas ? ` · ${abertas} em aberto` : ''}`} cor={abertas ? '#f59e0b' : null}>
      {colando ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            style={S.area}
            autoFocus
            value={texto}
            placeholder={'Cole as marcações do agente, uma por linha.\nEx: [Checagem] Confirmar o número de seguidores do @perfil'}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={S.btn} onClick={colar}>Adicionar</button>
            <button type="button" style={S.btnGhost} onClick={() => setColando(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          {pendencias.length === 0 ? (
            <p style={S.vazio}>Nenhuma pendência registrada.</p>
          ) : (
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {pendencias.map((p, i) => (
                <li key={`${p.t}-${i}`} style={S.pend} onClick={() => alternar(i)}>
                  <span style={{ ...S.marca, ...(p.ok ? S.marcaOk : {}) }}>
                    {p.ok && <Check size={10} color="#07070e" strokeWidth={3} />}
                  </span>
                  <span style={{
                    fontSize: 12, lineHeight: 1.45,
                    color: p.ok ? 'var(--muted)' : 'var(--text)',
                    textDecoration: p.ok ? 'line-through' : 'none',
                  }}>{p.t}</span>
                </li>
              ))}
            </ul>
          )}
          <button type="button" style={{ ...S.btnGhost, marginTop: 10 }} onClick={() => setColando(true)}>
            Colar marcações
          </button>
        </>
      )}
    </Caixa>
  );
}

// Regras 3.4 e 3.7: o documento fecha o círculo, e os períodos
// comparados têm duração equivalente. As duas avisam, nunca bloqueiam.
function Checagens({ doc, dados, documento }) {
  const avisos = [];

  const g = checarGargalo(dados);
  if (g.aplicavel && !g.ok) {
    avisos.push('O fluxo de produção da seção 07 não parece resolver o gargalo que você nomeou na seção 01. Confira se o documento fecha o círculo.');
  }

  if (doc.exigePeriodos) {
    const p = checarPeriodos(documento);
    if (p.aplicavel && !p.ok) {
      avisos.push(`Os períodos comparados têm durações diferentes: ${p.atual} dias contra ${p.anterior}. Uma diferença de ${p.diff} dias distorce a variação.`);
    }
  }

  if (!avisos.length) return null;

  return (
    <Caixa icone={AlertTriangle} titulo="Vale conferir" cor="#f59e0b">
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {avisos.map((a) => <li key={a} style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>{a}</li>)}
      </ul>
    </Caixa>
  );
}

export default function DocApoio({ doc, dados, documento, pendencias, onPendencias }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Checagens doc={doc} dados={dados} documento={documento} />
      {doc.balancoFunil && <Balanco dados={dados} />}
      <Pendencias pendencias={pendencias || []} onChange={onPendencias} />
      <p style={S.rodape}>
        Este painel é apoio interno. Nada daqui aparece no PDF.
      </p>
    </div>
  );
}

const S = {
  caixa: {
    background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 14,
  },
  cab: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 },
  cabTxt: { fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.09em', textTransform: 'uppercase' },
  vazio: { fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 },
  etapa: {
    flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 9, padding: '9px 10px', display: 'flex', flexDirection: 'column', gap: 1,
  },
  etapaNome: { fontSize: 10, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' },
  etapaNum: { fontSize: 17, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--fm)' },
  etapaPecas: { fontSize: 10.5, color: 'var(--muted)' },
  alerta: { fontSize: 12, color: 'var(--amber)', lineHeight: 1.5, marginTop: 10 },
  pend: { display: 'flex', gap: 9, alignItems: 'flex-start', cursor: 'pointer' },
  marca: {
    width: 15, height: 15, borderRadius: 4, border: '1px solid var(--border-h)',
    flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  marcaOk: { background: 'var(--neon)', borderColor: 'var(--neon)' },
  area: {
    background: '#12121f', border: '1px solid var(--border)', borderRadius: 9,
    padding: '10px 12px', fontSize: 12, color: 'var(--text)', outline: 'none',
    minHeight: 96, resize: 'vertical', lineHeight: 1.5, width: '100%',
  },
  btn: {
    background: 'var(--neon)', border: 'none', borderRadius: 8,
    padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#fff',
  },
  btnGhost: {
    background: 'transparent', border: '1px solid var(--border-h)', borderRadius: 8,
    padding: '7px 14px', fontSize: 12, color: 'var(--muted)',
  },
  rodape: { fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, paddingLeft: 2 },
};
