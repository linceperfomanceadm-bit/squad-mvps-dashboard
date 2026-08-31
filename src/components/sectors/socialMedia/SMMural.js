import React, { useState } from 'react';
import { Users, FileText, Kanban, AlertTriangle } from 'lucide-react';
import { resolveClientHealth, HEALTH_LEVELS_4 } from '../../../hooks/useClientHealth';
import SMClientModal from './SMClientModal';

// ─────────────────────────────────────────────────────────────
// Mural do Social Media
//
// Um card por cliente sob responsabilidade da pessoa. Substitui o
// Kanban de posts: a unidade de trabalho do social media passou a ser
// o cliente, não a peça avulsa.
// ─────────────────────────────────────────────────────────────

export default function SMMural({
  clients, documents, tasks, onAbrirDocumento, onNovoDocumento,
}) {
  const [aberto, setAberto] = useState(null);

  const docsDo = (id) => documents.filter((d) => d.clientId === id);
  const tasksDo = (id) => tasks.filter((t) => t.clientId === id);

  const cliente = aberto ? clients.find((c) => c.id === aberto) : null;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 26 }}>
        <h1 style={S.titulo}>Mural</h1>
        <p style={S.sub}>
          {clients.length === 0
            ? 'Nenhum cliente sob sua responsabilidade.'
            : `${clients.length} ${clients.length === 1 ? 'cliente' : 'clientes'} sob sua responsabilidade.`}
        </p>
      </div>

      {clients.length === 0 ? (
        <div style={S.vazio}>
          <Users size={24} color="var(--muted)" />
          <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 12 }}>Sem clientes atribuídos.</p>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
            Quem define os responsáveis por setor é o admin, no cadastro de clientes.
          </p>
        </div>
      ) : (
        <div style={S.grade}>
          {clients.map((c) => {
            const docs = docsDo(c.id);
            const abertas = tasksDo(c.id).filter((t) => t.status !== 'done');
            const atrasadas = abertas.filter((t) => t.deadline && new Date(t.deadline) < new Date()).length;
            const saude = resolveClientHealth(c);
            const nivel = saude && HEALTH_LEVELS_4[saude.level];
            const semBase = !c.sm?.baseCalculo;

            return (
              <button key={c.id} type="button" style={S.card} onClick={() => setAberto(c.id)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                  <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <span style={S.nome}>{c.name}</span>
                    {nivel && (
                      <span style={S.farol}>
                        <span style={{ ...S.ponto, background: nivel.color }} />
                        {nivel.label}
                      </span>
                    )}
                  </span>
                </div>

                <div style={S.numeros}>
                  <span style={S.num}>
                    <FileText size={12} color="var(--muted)" />
                    {docs.length} {docs.length === 1 ? 'documento' : 'documentos'}
                  </span>
                  <span style={S.num}>
                    <Kanban size={12} color="var(--muted)" />
                    {abertas.length} {abertas.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>

                {(atrasadas > 0 || semBase) && (
                  <div style={S.avisos}>
                    {atrasadas > 0 && (
                      <span style={{ ...S.aviso, color: 'var(--neon)', borderColor: 'var(--neon-border)' }}>
                        <AlertTriangle size={10} />
                        {atrasadas} {atrasadas === 1 ? 'task atrasada' : 'tasks atrasadas'}
                      </span>
                    )}
                    {semBase && (
                      <span style={{ ...S.aviso, color: 'var(--amber)', borderColor: 'var(--amber-b)' }}>
                        sem base de cálculo
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {cliente && (
        <SMClientModal
          cliente={cliente}
          documentos={docsDo(cliente.id)}
          tasks={tasksDo(cliente.id)}
          onClose={() => setAberto(null)}
          onAbrirDocumento={onAbrirDocumento}
          onNovoDocumento={onNovoDocumento}
        />
      )}
    </div>
  );
}

const S = {
  titulo: { fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--muted)' },
  vazio: {
    background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14,
    padding: '46px 30px', textAlign: 'center', maxWidth: 460,
  },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 12 },
  card: {
    background: 'rgba(12,12,24,.88)', border: '1px solid var(--border)', borderRadius: 14,
    padding: 16, display: 'flex', flexDirection: 'column', gap: 11, textAlign: 'left',
  },
  nome: {
    display: 'block', fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-.2px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  farol: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)', marginTop: 4 },
  ponto: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  numeros: { display: 'flex', gap: 14 },
  num: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--fm)' },
  avisos: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  aviso: {
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
    border: '1px solid', borderRadius: 100, padding: '3px 8px',
  },
};
