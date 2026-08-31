import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileDown, Check, Layers, Rows, Square } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useDocuments, DOC_STATUS } from '../../hooks/useDocuments';
import { useToast } from '../../components/shared/Toast';
import { docPorId } from '../../lib/docs/catalogo';
import { marcaPendente } from '../../lib/docs/marca';
import DocForm from '../../components/sectors/socialMedia/docs/DocForm';
import DocPreview, { blocosDoDeck } from '../../components/sectors/socialMedia/docs/DocPreview';
import DocApoio from '../../components/sectors/socialMedia/docs/DocApoio';
import DocExtras from '../../components/sectors/socialMedia/docs/DocExtras';
import '../../styles/lince-docs.css';

// ─────────────────────────────────────────────────────────────
// Lince Docs — EDITOR
//
// Três colunas: seções à esquerda, campos no meio, deck à direita.
// Uma seção por vez, porque 35 campos numa rolagem só viram
// formulário de imposto de renda — e porque assim o deck acompanha a
// seção sem depender de adivinhar posição de rolagem.
//
// O documento vem do array ao vivo do hook, como o Kanban faz com as
// tasks: edição de outra pessoa aparece na hora, sem segundo listener.
// ─────────────────────────────────────────────────────────────

const ATRASO_SALVAR = 800;

// Conta os campos que ainda vão sair marcados no slide.
// Uma linha de lista conta cada coluna em branco: é o que aparece
// como [rótulo] em itálico no documento impresso.
const vazio = (v) => !v || !String(v).trim();

function vaziosDoCampo(campo, valor) {
  if (campo.tipo !== 'lista') return vazio(valor) ? 1 : 0;
  const linhas = Array.isArray(valor) ? valor : [];
  return Array.from({ length: campo.linhas }).reduce((acc, _, i) => {
    const linha = linhas[i] || {};
    return acc + campo.cols.filter((col) => vazio(linha[col.id])).length;
  }, 0);
}

function vaziosDaSecao(secao, dados) {
  return secao.campos.reduce((acc, c) => acc + vaziosDoCampo(c, dados[c.id]), 0);
}

function contarVazios(doc, dados, opcionais) {
  if (!doc || !doc.secoes) return 0;
  return doc.secoes
    .filter((s) => !(s.opcional && opcionais[s.t] === false))
    .reduce((acc, s) => acc + vaziosDaSecao(s, dados), 0);
}

export default function DocEditorPage() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, updateClient } = useClients();
  const { documents, loading, updateDocument, saveVersion } = useDocuments();

  const [aba, setAba] = useState(0); // índice da seção; -1 = slides extras
  const [transbordo, setTransbordo] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [rascunho, setRascunho] = useState(null);
  const [deckCompleto, setDeckCompleto] = useState(false);

  const colMeio = useRef(null);
  const colDeck = useRef(null);

  const timer = useRef(null);
  const pendenteRef = useRef(null);

  const documento = documents.find((d) => d.id === docId) || null;
  const doc = documento ? docPorId(documento.tipo) : null;
  const cliente = documento ? clients.find((c) => c.id === documento.clientId) : null;

  // O rascunho local absorve a digitação; o Firestore recebe depois
  // do intervalo. Sem isso, cada tecla vira uma escrita.
  useEffect(() => {
    if (!documento) return;
    setRascunho((r) => (r && r.id === documento.id ? r : {
      id: documento.id,
      dados: documento.dados || {},
      extras: documento.extras || [],
      opcionais: documento.opcionais || {},
      pendencias: documento.pendencias || [],
    }));
  }, [documento]);

  const gravar = useCallback((patch) => {
    if (!docId) return;
    pendenteRef.current = { ...(pendenteRef.current || {}), ...patch };
    setSalvando(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const carga = pendenteRef.current;
      pendenteRef.current = null;
      const res = await updateDocument(docId, carga, user?.name);
      setSalvando(false);
      if (!res.success) toast(`Não foi possível salvar: ${res.error}`, 'e');
    }, ATRASO_SALVAR);
  }, [docId, updateDocument, user, toast]);

  // Grava o que estiver pendente ao sair da página.
  useEffect(() => () => {
    if (pendenteRef.current && docId) {
      updateDocument(docId, pendenteRef.current, user?.name);
    }
    clearTimeout(timer.current);
  }, [docId, updateDocument, user]);

  // Trocar de seção recomeça do topo nas duas colunas. Sem isso, a
  // seção nova abre no meio, na altura em que a anterior estava.
  useEffect(() => {
    if (colMeio.current) colMeio.current.scrollTop = 0;
    if (colDeck.current) colDeck.current.scrollTop = 0;
  }, [aba]);

  const alterar = (campoId, valor) => {
    setRascunho((r) => {
      const dados = { ...r.dados, [campoId]: valor };
      gravar({ dados });
      return { ...r, dados };
    });
  };

  const alterarExtras = (extras) => {
    setRascunho((r) => { gravar({ extras }); return { ...r, extras }; });
  };

  const alterarPendencias = (pendencias) => {
    setRascunho((r) => { gravar({ pendencias }); return { ...r, pendencias }; });
  };

  const alterarOpcional = (titulo, ligada) => {
    setRascunho((r) => {
      const opcionais = { ...r.opcionais, [titulo]: ligada };
      gravar({ opcionais });
      return { ...r, opcionais };
    });
  };

  // REGRA 3.2 — a base fica no cliente, não no documento.
  const baseSalva = cliente?.sm?.baseCalculo || '';
  const baseDesde = cliente?.sm?.baseCalculoDesde || '';

  const destravarBase = () => {
    const aviso = 'A base de cálculo vale para todos os documentos deste cliente.\n\n'
      + `Base atual: ${baseSalva}\n\n`
      + 'Trocar agora quebra a comparação com os relatórios anteriores — o engajamento '
      + 'de meses passados foi calculado com a base antiga. Alterar mesmo assim?';
    // eslint-disable-next-line no-alert
    if (!window.confirm(aviso)) return;
    updateClient(cliente.id, { 'sm.baseCalculo': '', 'sm.baseCalculoDesde': '' });
  };

  const secoes = doc?.secoes || [];
  const secaoAtual = aba >= 0 ? secoes[aba] : null;
  // Memorizado porque três hooks abaixo dependem dele: sem isso,
  // um objeto novo a cada render refaz o deck inteiro por tecla.
  const dados = useMemo(() => rascunho?.dados || {}, [rascunho]);

  const vazios = useMemo(
    () => contarVazios(doc, dados, rascunho?.opcionais || {}),
    [doc, dados, rascunho],
  );

  const totalSlides = useMemo(
    () => blocosDoDeck(doc, dados, rascunho?.opcionais || {}, rascunho?.extras || []).length,
    [doc, dados, rascunho],
  );

  // Quando a base ainda não existe no cliente, o que a pessoa digitar
  // no campo passa a valer para o cliente inteiro.
  useEffect(() => {
    if (!doc?.campoBase || !cliente || baseSalva) return;
    const digitada = dados[doc.campoBase];
    if (digitada && String(digitada).trim()) {
      const t = setTimeout(() => {
        updateClient(cliente.id, {
          'sm.baseCalculo': String(digitada).trim(),
          'sm.baseCalculoDesde': new Date().toLocaleDateString('pt-BR'),
        });
      }, 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [doc, cliente, baseSalva, dados, updateClient]);

  // A base travada do cliente entra no documento sozinha.
  useEffect(() => {
    if (!doc?.campoBase || !baseSalva || !rascunho) return;
    if (dados[doc.campoBase] !== baseSalva) alterar(doc.campoBase, baseSalva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseSalva, doc, rascunho?.id]);

  // REGRA 3.6 — o aviso soma o que está incompleto, mas não impede.
  // Documento pela metade às vezes é exatamente o que se quer mostrar
  // numa reunião de alinhamento.
  const gerarPDF = async () => {
    const abertas = (rascunho?.pendencias || []).filter((p) => !p.ok).length;
    const partes = [];
    if (vazios) partes.push(`${vazios} campo${vazios > 1 ? 's' : ''} em branco`);
    if (transbordo) partes.push(`${transbordo} slide${transbordo > 1 ? 's' : ''} com texto maior que a página`);
    if (abertas) partes.push(`${abertas} pendência${abertas > 1 ? 's' : ''} em aberto`);

    if (partes.length) {
      // eslint-disable-next-line no-alert
      const seguir = window.confirm(`Antes de gerar:\n\n· ${partes.join('\n· ')}\n\nGerar o PDF mesmo assim?`);
      if (!seguir) return;
    }

    if (pendenteRef.current) {
      clearTimeout(timer.current);
      await updateDocument(docId, pendenteRef.current, user?.name);
      pendenteRef.current = null;
      setSalvando(false);
    }
    await saveVersion({ ...documento, ...rascunho }, user?.name);
    window.open(`/documentos/${docId}/imprimir`, '_blank', 'noopener');
  };

  if (loading || !rascunho) {
    return (
      <div style={S.centro}><div className="spinner" style={{ width: 36, height: 36 }} /></div>
    );
  }

  if (!documento || !doc) {
    return (
      <div style={S.centro}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>Documento não encontrado.</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
            Ele pode ter sido apagado por quem o criou.
          </p>
          <button type="button" style={S.btn} onClick={() => navigate('/socialmedia')}>Voltar ao painel</button>
        </div>
      </div>
    );
  }

  const status = DOC_STATUS[documento.status] || DOC_STATUS.rascunho;

  return (
    <div style={S.tela}>
      {/* ── Topo ─────────────────────────────────────────── */}
      <header style={S.topo}>
        <button type="button" style={S.voltar} onClick={() => navigate('/socialmedia')}>
          <ArrowLeft size={16} color="var(--muted)" />
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={S.tituloTopo}>
            {documento.clientName || 'Sem cliente'}
            <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {doc.nome.split('—')[0].trim()}</span>
          </h1>
          <p style={S.subTopo}>
            {salvando ? 'Salvando…' : `Salvo${documento.updatedByName ? ` · por ${documento.updatedByName}` : ''}`}
            {' · '}{totalSlides} slides
            {vazios > 0 && ` · ${vazios} campo${vazios > 1 ? 's' : ''} em branco`}
            {transbordo > 0 && ` · ${transbordo} com texto sobrando`}
          </p>
        </div>

        <span style={{ ...S.chip, color: status.color, borderColor: `${status.color}45` }}>{status.label}</span>

        <select
          style={{ ...S.input, width: 150, fontSize: 12 }}
          value={documento.status}
          onChange={(e) => updateDocument(docId, { status: e.target.value }, user?.name)}
        >
          {Object.values(DOC_STATUS).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <button
          type="button"
          style={S.btnGhost}
          onClick={() => setDeckCompleto((v) => !v)}
          title={deckCompleto ? 'Ver só os slides desta seção' : 'Ver o documento inteiro'}
        >
          {deckCompleto ? <Square size={14} /> : <Rows size={14} />}
          {deckCompleto ? 'Só esta seção' : 'Documento inteiro'}
        </button>

        <button type="button" style={S.btn} onClick={gerarPDF}>
          <FileDown size={15} /> Gerar PDF
        </button>
      </header>

      {marcaPendente() && (
        <p style={S.avisoMarca}>
          Os arquivos de marca não estão configurados em <code>src/lib/docs/marca.js</code>.
          Os slides vão renderizar sem capa, logo e marca d&apos;água.
        </p>
      )}

      {/* ── Corpo ────────────────────────────────────────── */}
      <div style={S.corpo}>
        <nav style={S.nav}>
          {secoes.map((s, i) => {
            const faltam = vaziosDaSecao(s, dados);
            const desligada = s.opcional && rascunho.opcionais[s.t] === false;
            const ativa = aba === i;
            return (
              <button
                key={s.t}
                type="button"
                style={{ ...S.navItem, ...(ativa ? S.navAtivo : {}) }}
                onClick={() => setAba(i)}
              >
                <span style={{ ...S.navNum, ...(ativa ? { color: 'var(--neon)' } : {}) }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>{s.t}</span>
                {desligada ? (
                  <span style={S.navOff}>fora</span>
                ) : faltam === 0 ? (
                  <Check size={13} color="var(--green)" />
                ) : (
                  <span style={S.navFalta}>{faltam}</span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            style={{ ...S.navItem, ...S.navExtras, ...(aba === -1 ? S.navAtivo : {}) }}
            onClick={() => setAba(-1)}
          >
            <Layers size={13} color={aba === -1 ? 'var(--neon)' : 'var(--muted)'} />
            <span style={{ flex: 1, textAlign: 'left' }}>Slides extras</span>
            {rascunho.extras.length > 0 && <span style={S.navFalta}>{rascunho.extras.length}</span>}
          </button>
        </nav>

        <section style={S.meio} ref={colMeio}>
          {aba === -1 ? (
            <DocExtras doc={doc} extras={rascunho.extras} onChange={alterarExtras} />
          ) : (
            <DocForm
              secao={secaoAtual}
              dados={dados}
              onChange={alterar}
              campoBase={doc.campoBase}
              baseTravada={!!baseSalva}
              baseDesde={baseDesde}
              onDestravarBase={destravarBase}
              opcionalLigada={secaoAtual && rascunho.opcionais[secaoAtual.t]}
              onToggleOpcional={alterarOpcional}
            />
          )}

          <div style={{ marginTop: 28, paddingTop: 22, borderTop: '1px solid var(--border)' }}>
            <DocApoio
              doc={doc}
              dados={dados}
              documento={documento}
              pendencias={rascunho.pendencias}
              onPendencias={alterarPendencias}
            />
          </div>
        </section>

        <section style={S.direita} ref={colDeck}>
          <DocPreview
            doc={doc}
            dados={dados}
            opcionais={rascunho.opcionais}
            extras={rascunho.extras}
            secaoAtiva={secaoAtual ? secaoAtual.t : null}
            apenasSecao={!deckCompleto && aba >= 0}
            onTransbordo={setTransbordo}
          />
        </section>
      </div>
    </div>
  );
}

const S = {
  // Altura de tela travada: as três colunas rolam por conta própria.
  // Antes a lateral era `sticky` (supondo rolagem de página) e as
  // colunas tinham rolagem interna — os dois modelos ao mesmo tempo
  // faziam o formulário passar por baixo do cabeçalho.
  tela: { height: '100vh', overflow: 'hidden', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  centro: {
    minHeight: '100vh', background: 'var(--bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  topo: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 22px',
    borderBottom: '1px solid var(--border)', background: 'rgba(12,12,24,.88)',
    flexShrink: 0, zIndex: 10,
  },
  voltar: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 9,
    width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tituloTopo: {
    fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-.2px',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  subTopo: { fontSize: 11.5, color: 'var(--muted)', marginTop: 2 },
  chip: {
    fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase',
    border: '1px solid', borderRadius: 100, padding: '4px 10px', flexShrink: 0,
  },
  btnGhost: {
    display: 'flex', alignItems: 'center', gap: 7, background: 'transparent',
    border: '1px solid var(--border-h)', borderRadius: 9, padding: '9px 14px',
    fontSize: 12.5, color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap',
  },
  btn: {
    display: 'flex', alignItems: 'center', gap: 7, background: 'var(--neon)',
    border: 'none', borderRadius: 9, padding: '9px 16px',
    fontSize: 12.5, fontWeight: 600, color: '#fff', flexShrink: 0,
  },
  input: {
    background: '#12121f', border: '1px solid var(--border)', borderRadius: 9,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
  },
  avisoMarca: {
    fontSize: 12, color: 'var(--amber)', background: 'var(--amber-dim)',
    borderBottom: '1px solid var(--amber-b)', padding: '9px 22px', lineHeight: 1.5,
  },
  corpo: { flex: 1, display: 'grid', gridTemplateColumns: '236px minmax(360px,1fr) minmax(420px,1.15fr)', minHeight: 0 },
  nav: {
    borderRight: '1px solid var(--border)', padding: 14,
    display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 9, width: '100%',
    background: 'transparent', border: '1px solid transparent', borderRadius: 9,
    padding: '9px 11px', fontSize: 12.5, color: 'var(--muted)', textAlign: 'left',
  },
  navAtivo: {
    background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', color: 'var(--text)', fontWeight: 600,
  },
  navNum: { fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--muted)', flexShrink: 0 },
  navFalta: {
    fontFamily: 'var(--fm)', fontSize: 10, color: 'var(--muted)',
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 100, padding: '1px 7px', flexShrink: 0,
  },
  navOff: { fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', flexShrink: 0 },
  navExtras: { marginTop: 10, borderTop: '1px solid var(--border)', borderRadius: 0, paddingTop: 14 },
  meio: { padding: '26px 26px 60px', overflowY: 'auto', borderRight: '1px solid var(--border)' },
  direita: { padding: 22, overflowY: 'auto', background: '#050509' },
};
