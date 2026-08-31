import React from 'react';
import { Users, FileText, Kanban, AlertTriangle } from 'lucide-react';
import { DOC_STATUS } from '../../../hooks/useDocuments';

// ─────────────────────────────────────────────────────────────
// Visão Geral do Social Media
//
// Reescrita depois da saída do Kanban de posts. A unidade de trabalho
// passou a ser o cliente e o documento, então é isso que os números
// medem: carteira, documentos em produção e tasks que precisam de
// atenção hoje.
// ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icone, label, value, color = 'var(--blue)', onClick }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{ ...S.stat, cursor: onClick ? 'pointer' : 'default' }}
    >
      <div style={{ ...S.statBarra, background: `linear-gradient(90deg,${color},transparent)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{label}</p>
          <p style={{ fontSize: 32, fontWeight: 800, color }}>{value}</p>
        </div>
        <div style={{ ...S.statIcone, background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icone size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

export default function SMOverview({ myClients, myDocs, myTasks, onNavigate }) {
  const agora = new Date();

  const emProducao = myDocs.filter((d) => d.status === 'rascunho' || d.status === 'revisao');
  const entregues = myDocs.filter((d) => d.status === 'entregue').length;

  const abertas = myTasks.filter((t) => t.status !== 'done');
  const atrasadas = abertas.filter((t) => t.deadline && new Date(t.deadline) < agora);
  const aguardando = myTasks.filter((t) => t.status === 'approval').length;

  // Cliente sem base de cálculo não consegue ter relatório comparável.
  const semBase = myClients.filter((c) => !c.sm?.baseCalculo);

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 28 }}>
        <h1 style={S.titulo}>Visão Geral</h1>
        <p style={S.sub}>Social Media</p>
      </div>

      <div style={S.grade}>
        <StatCard icon={Users} label="Clientes na carteira" value={myClients.length} color="var(--green)" onClick={() => onNavigate('mural')} />
        <StatCard icon={FileText} label="Documentos em produção" value={emProducao.length} color="var(--blue)" onClick={() => onNavigate('documentos')} />
        <StatCard icon={Kanban} label="Tasks em aprovação" value={aguardando} color={aguardando > 0 ? 'var(--amber)' : 'var(--muted)'} onClick={() => onNavigate('kanban')} />
        <StatCard icon={AlertTriangle} label="Tasks atrasadas" value={atrasadas.length} color={atrasadas.length > 0 ? 'var(--neon)' : 'var(--muted)'} onClick={() => onNavigate('kanban')} />
      </div>

      {emProducao.length > 0 && (
        <section style={S.painel}>
          <h2 style={S.painelTit}>Documentos em aberto</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {emProducao.slice(0, 6).map((d) => {
              const st = DOC_STATUS[d.status] || DOC_STATUS.rascunho;
              return (
                <div key={d.id} style={S.linha}>
                  <div style={{ minWidth: 0 }}>
                    <p style={S.linhaTit}>{d.clientName || 'Sem cliente'}</p>
                    <p style={S.linhaSub}>{d.updatedByName ? `última edição por ${d.updatedByName}` : 'sem edições'}</p>
                  </div>
                  <span style={{ ...S.chip, color: st.color, borderColor: `${st.color}45` }}>{st.label}</span>
                </div>
              );
            })}
          </div>
          {entregues > 0 && (
            <p style={S.rodape}>{entregues} {entregues === 1 ? 'documento entregue' : 'documentos entregues'} no total.</p>
          )}
        </section>
      )}

      {semBase.length > 0 && (
        <section style={{ ...S.painel, borderColor: 'var(--amber-b)', background: 'var(--amber-dim)' }}>
          <h2 style={{ ...S.painelTit, color: 'var(--amber)' }}>Clientes sem base de cálculo</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.55, marginBottom: 10 }}>
            Sem a base travada, o engajamento de um mês não pode ser comparado com o do mês
            anterior. Ela é definida na pré-estratégia e vale para todos os relatórios seguintes.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {semBase.map((c) => <span key={c.id} style={S.tag}>{c.name}</span>)}
          </div>
        </section>
      )}
    </div>
  );
}

const S = {
  titulo: { fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--muted)' },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, marginBottom: 22 },
  stat: {
    background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14,
    padding: '20px 22px', position: 'relative', overflow: 'hidden',
  },
  statBarra: { position: 'absolute', top: 0, left: 0, right: 0, height: 2 },
  statIcone: { width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  painel: {
    background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14,
    padding: '20px 22px', marginBottom: 16,
  },
  painelTit: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14 },
  linha: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 13px',
  },
  linhaTit: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  linhaSub: { fontSize: 11, color: 'var(--muted)', marginTop: 2 },
  chip: {
    fontSize: 9.5, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase',
    border: '1px solid', borderRadius: 100, padding: '3px 8px', flexShrink: 0,
  },
  rodape: { fontSize: 11.5, color: 'var(--muted)', marginTop: 12 },
  tag: {
    fontSize: 11.5, color: 'var(--text)', background: 'rgba(255,255,255,.05)',
    border: '1px solid var(--border)', borderRadius: 100, padding: '4px 11px',
  },
};
