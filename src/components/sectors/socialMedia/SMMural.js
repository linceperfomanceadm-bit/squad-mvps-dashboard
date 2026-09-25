import React, { useState } from 'react';
import { Users, FileText, Kanban, AlertTriangle, CheckCircle2, Circle } from 'lucide-react';
import { resolveClientHealth, isTaskOverdue, HEALTH_LEVELS_4 } from '../../../hooks/useClientHealth';
import SMClientModal from './SMClientModal';
import { SM_MARCOS_MENSAIS } from '../../../lib/firebase';
import { entregasDoSetor, resumoMes, mesChave, acompanhaEntregas, marcosDoMes, rotuloMes } from '../../../lib/entregas';
import { BarraEntrega } from '../../entregas/EntregasKit';

// ─────────────────────────────────────────────────────────────
// Mural do Social Media
//
// Um card por cliente sob responsabilidade da pessoa. Substitui o
// Kanban de posts: a unidade de trabalho do social media passou a ser
// o cliente, não a peça avulsa.
//
// O card traz o checklist mensal (planejamento aprovado, relatório
// criado — `SM_MARCOS_MENSAIS`), marcado ali mesmo sem abrir a ficha.
// Por isso o card é um <div role="button">: um <button> não pode ter
// os botões do checklist dentro.
// ─────────────────────────────────────────────────────────────

const quando = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
};

export default function SMMural({
  clients, documents, tasks, onAbrirDocumento, onNovoDocumento, acoesEntregas, onMarcarMarco,
}) {
  const [aberto, setAberto] = useState(null);
  const [salvando, setSalvando] = useState(null);
  const mes = mesChave();

  const alternar = async (e, clientId, marcoId, feito) => {
    e.stopPropagation();
    if (!onMarcarMarco || salvando) return;
    const chave = `${clientId}_${marcoId}`;
    setSalvando(chave);
    await onMarcarMarco(clientId, mes, marcoId, !feito);
    setSalvando(null);
  };

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
            // Mesma régua do kanban e da saúde do cliente: prazo efetivo em
            // tempo útil, e task em aprovação não conta como atraso.
            const atrasadas = abertas.filter((t) => isTaskOverdue(t)).length;
            const saude = resolveClientHealth(c);
            const nivel = saude && HEALTH_LEVELS_4[saude.level];
            const semBase = !c.sm?.baseCalculo;
            const marcos = marcosDoMes(c, mes);
            // Entregas do mês do Social Media (escopo do contrato).
            const entregas = acompanhaEntregas(c, mes) ? entregasDoSetor(c, 'socialmedia', mes) : [];
            const resumo = resumoMes(entregas);

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                style={S.card}
                onClick={() => setAberto(c.id)}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setAberto(c.id); } }}
              >
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

                {entregas.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
                      <span>Entregas do mês</span>
                      <span style={{ fontFamily: 'var(--fm)', color: 'var(--text)' }}>{resumo.entregue}/{resumo.combinado}</span>
                    </div>
                    <BarraEntrega feito={resumo.entregue} qtd={resumo.combinado} />
                  </div>
                )}

                <div style={S.checklist}>
                  <span style={S.checkTit}>Checklist de {rotuloMes(mes)}</span>
                  {SM_MARCOS_MENSAIS.map((m) => {
                    const reg = marcos[m.id];
                    const feito = !!reg;
                    const ocupado = salvando === `${c.id}_${m.id}`;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        style={{ ...S.check, opacity: ocupado ? 0.5 : 1, cursor: onMarcarMarco ? 'pointer' : 'default' }}
                        disabled={!onMarcarMarco || ocupado}
                        onClick={(e) => alternar(e, c.id, m.id, feito)}
                        title={feito ? `Marcado${reg.by ? ` por ${reg.by}` : ''}${reg.at ? ` em ${quando(reg.at)}` : ''}` : 'Marcar como feito'}
                        aria-pressed={feito}
                      >
                        {feito
                          ? <CheckCircle2 size={15} color="var(--green)" style={{ flexShrink: 0 }} />
                          : <Circle size={15} color="var(--dim)" style={{ flexShrink: 0 }} />}
                        <span style={{ flex: 1, minWidth: 0, color: feito ? 'var(--text)' : 'var(--muted)' }}>{m.label}</span>
                        {feito && reg.at && <span style={S.checkData}>{quando(reg.at)}</span>}
                      </button>
                    );
                  })}
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
              </div>
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
          acoesEntregas={acoesEntregas}
        />
      )}
    </div>
  );
}

const S = {
  titulo: { fontSize: 21, fontWeight: 500, color: 'var(--text)', letterSpacing: '-.01em', marginBottom: 4 },
  sub: { fontSize: 13, color: 'var(--muted)' },
  vazio: {
    background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14,
    padding: '46px 30px', textAlign: 'center', maxWidth: 460,
  },
  grade: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 12 },
  card: {
    background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
    padding: 16, display: 'flex', flexDirection: 'column', gap: 11, textAlign: 'left', cursor: 'pointer',
  },
  nome: {
    display: 'block', fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.2px',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  farol: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)', marginTop: 4 },
  ponto: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  numeros: { display: 'flex', gap: 14 },
  num: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--fm)' },
  avisos: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  checklist: { display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 10, borderTop: '1px solid var(--border)' },
  checkTit: { fontSize: 11, color: 'var(--muted)', marginBottom: 4 },
  check: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none',
    padding: '5px 0', fontSize: 12.5, textAlign: 'left', fontFamily: 'var(--f)',
  },
  checkData: { fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--fm)', flexShrink: 0 },
  aviso: {
    display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
    border: '1px solid', borderRadius: 100, padding: '3px 8px',
  },
};
