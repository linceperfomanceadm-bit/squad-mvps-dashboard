import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileDown, Check, Layers, Rows, Square, Play, GripVertical, Trash2, RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useClients } from '../../hooks/useClients';
import { useDocuments, DOC_STATUS } from '../../hooks/useDocuments';
import { useToast } from '../../components/shared/Toast';
import { docPorId } from '../../lib/docs/catalogo';
import { marcaPendente } from '../../lib/docs/marca';
import {
  semearPadroes, colunasVisiveis, linhasVisiveis, campoVisivel,
  ordemEfetiva, slideTravado, SLIDE_INICIO, SLIDE_FIM,
} from '../../lib/docs/motor';
import DocForm from '../../components/sectors/socialMedia/docs/DocForm';
import DocPreview, { blocosDoDeck } from '../../components/sectors/socialMedia/docs/DocPreview';
import DocApoio from '../../components/sectors/socialMedia/docs/DocApoio';
import DocExtras from '../../components/sectors/socialMedia/docs/DocExtras';
import DocPresenter from '../../components/sectors/socialMedia/docs/DocPresenter';
import '../../styles/lince-docs.css';

// ─────────────────────────────────────────────────────────────
// Lince Docs — EDITOR
//
// Três colunas: seções à esquerda, campos no meio, deck à direita.
// Uma seção por vez, porque 35 campos numa rolagem só viram
// formulário de imposto de renda — e porque assim o deck acompanha a
// seção sem depender de adivinhar posição de rolagem.
//
// A coluna da esquerda também é a estrutura do deck: cada seção é um
// slide, e arrastar uma seção muda a ordem dos slides daquele
// documento. A lixeira tira o slide do documento sem apagar o que foi
// escrito nele — ele vai para "Removidos" e volta com um clique.
// Capa e encerramento não andam nem saem.
//
// O documento vem do array ao vivo do hook, como o Kanban faz com as
// tasks: edição de outra pessoa aparece na hora, sem segundo listener.
// ─────────────────────────────────────────────────────────────

const ATRASO_SALVAR = 800;

// Conta os campos que ainda vão sair marcados no slide do rascunho.
// Uma linha de lista conta cada coluna em branco: é o que aparece
// como [rótulo] em itálico enquanto o documento está sendo montado.
//
// É só o indicador de progresso de cada seção na coluna da esquerda.
// Nenhum campo é obrigatório: na apresentação e no PDF, o que não foi
// preenchido simplesmente não aparece.
const vazio = (v) => !v || !String(v).trim();

function vaziosDoCampo(campo, valor, essencial) {
  if (campo.tipo === 'nota' || !campoVisivel(campo, essencial)) return 0;
  if (campo.tipo !== 'lista') return vazio(valor) ? 1 : 0;
  const linhas = Array.isArray(valor) ? valor : [];
  const cols = colunasVisiveis(campo, essencial);
  return Array.from({ length: linhasVisiveis(campo, essencial) }).reduce((acc, _, i) => {
    const linha = linhas[i] || {};
    return acc + cols.filter((col) => vazio(linha[col.id])).length;
  }, 0);
}

function vaziosDaSecao(secao, dados, essencial) {
  return secao.campos.reduce((acc, c) => acc + vaziosDoCampo(c, dados[c.id], essencial), 0);
}

export default function DocEditorPage() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { clients, updateClient } = useClients();
  const { documents, loading, updateDocument, saveVersion } = useDocuments();

  const [aba, setAba] = useState(0); // índice da seção no catálogo; -1 = slides extras
  const [transbordo, setTransbordo] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [rascunho, setRascunho] = useState(null);
  const [deckCompleto, setDeckCompleto] = useState(false);
  // O formulário mostra TODOS os campos, sempre. O modo essencial
  // escondia os complementares e fazia campo aparecer e sumir no meio
  // do preenchimento — quem está montando o documento perdia a
  // referência do que já tinha visto. O que era "essencial" virou
  // etiqueta: marca o campo como complementar e deixa ele lá.
  const essencial = false;
  // Modo apresentação — usa o rascunho local, então o que a pessoa
  // acabou de digitar já aparece, mesmo antes de ir para o Firestore.
  const [apresentando, setApresentando] = useState(false);

  // Arrastar seções na coluna da esquerda: qual slide está sendo
  // arrastado, onde ele vai cair (antes ou depois de qual) e sobre
  // qual seção o mouse está (para mostrar a lixeira).
  const [arrastando, setArrastando] = useState(null);
  const [alvo, setAlvo] = useState(null);
  const [sobre, setSobre] = useState(null);

  const colMeio = useRef(null);
  const colDeck = useRef(null);

  const timer = useRef(null);
  const pendenteRef = useRef(null);
  const abertoRef = useRef(null);

  const documento = documents.find((d) => d.id === docId) || null;
  const doc = documento ? docPorId(documento.tipo) : null;
  const cliente = documento ? clients.find((c) => c.id === documento.clientId) : null;

  // `updateDocument` nasce de novo a cada render (o hook não memoriza
  // as funções). Se ele entrar nas dependências do efeito de saída lá
  // embaixo, a "limpeza" roda a cada render em vez de só ao sair —
  // e como ela gravava o pendente sem zerá-lo, cada gravação gerava um
  // snapshot, que gerava um render, que gravava de novo. Esse loop
  // queimou as 20 mil gravações diárias do Firebase em 15/out/2026.
  // Por isso a função e o usuário vivem em ref: o efeito depende só
  // do documento aberto.
  const salvarRef = useRef(updateDocument);
  salvarRef.current = updateDocument;
  const nomeRef = useRef(user?.name);
  nomeRef.current = user?.name;

  const gravar = useCallback((patch) => {
    if (!docId) return;
    pendenteRef.current = { ...(pendenteRef.current || {}), ...patch };
    setSalvando(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const carga = pendenteRef.current;
      pendenteRef.current = null;
      if (!carga) { setSalvando(false); return; }
      const res = await salvarRef.current(docId, carga, nomeRef.current);
      setSalvando(false);
      if (!res.success) toast(`Não foi possível salvar: ${res.error}`, 'e');
    }, ATRASO_SALVAR);
  }, [docId, toast]);

  // O rascunho local absorve a digitação; o Firestore recebe depois
  // do intervalo. Sem isso, cada tecla vira uma escrita.
  // REGRA 3.11 — ao abrir, as listas recebem os valores padrão
  // (nome e direção das métricas) nas células nunca tocadas.
  useEffect(() => {
    if (!documento || abertoRef.current === documento.id) return;
    abertoRef.current = documento.id;
    const original = documento.dados || {};
    const dados = semearPadroes(doc, original);
    setRascunho({
      id: documento.id,
      dados,
      extras: documento.extras || [],
      opcionais: documento.opcionais || {},
      pendencias: documento.pendencias || [],
      // Documento antigo não tem os dois campos: ordem do catálogo,
      // nada removido.
      ordem: documento.ordem || [],
      removidos: documento.removidos || [],
    });
    if (dados !== original) gravar({ dados });
  }, [documento, doc, gravar]);

  // Grava o que estiver pendente ao sair da página (ou trocar de
  // documento). O pendente é zerado ANTES de gravar: assim, mesmo que
  // a limpeza rode de novo, nunca grava a mesma carga duas vezes.
  useEffect(() => {
    const timerAtual = timer;
    return () => {
      const carga = pendenteRef.current;
      pendenteRef.current = null;
      clearTimeout(timerAtual.current);
      if (carga && docId) salvarRef.current(docId, carga, nomeRef.current);
    };
  }, [docId]);

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

  // Ordem e slides removidos. Mesmo caminho das outras edições:
  // rascunho na hora, Firestore depois do intervalo.
  const alterarEstrutura = (patch) => {
    setRascunho((r) => { gravar(patch); return { ...r, ...patch }; });
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

  // ── Estrutura do deck ────────────────────────────────────────
  // Os slides do catálogo, sem dado nenhum: só para saber quais
  // existem e qual seção gera qual slide. O casamento é pelo nome — o
  // `nome` do slide é o título da seção, o mesmo casamento que o deck
  // já usa para acompanhar a seção aberta.
  const slidesCatalogo = useMemo(
    () => (doc && typeof doc.render === 'function' ? doc.render({}, {}) : []),
    [doc],
  );
  const slideDaSecao = useMemo(
    () => Object.fromEntries(slidesCatalogo.map((b) => [b.nome, b.id])),
    [slidesCatalogo],
  );
  const ordemSalva = rascunho ? rascunho.ordem : undefined;
  const removidos = useMemo(() => (rascunho && rascunho.removidos) || [], [rascunho]);
  const ordemIds = useMemo(
    () => ordemEfetiva(slidesCatalogo.map((b) => b.id), ordemSalva),
    [slidesCatalogo, ordemSalva],
  );
  const estrutura = useMemo(() => ({ ordem: ordemSalva, removidos }), [ordemSalva, removidos]);

  const totalSlides = useMemo(
    () => blocosDoDeck(doc, dados, rascunho?.opcionais || {}, rascunho?.extras || [], estrutura).length,
    [doc, dados, rascunho, estrutura],
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

  // REGRA 3.6 — o aviso soma o que pode estragar o PDF, mas não
  // impede. Campo em branco não entra no aviso: nenhum campo é
  // obrigatório, e o que não foi preenchido já não vai para o PDF.
  // Ficam o texto maior que a página (seria cortado) e as pendências
  // em aberto (dado que ainda precisa de conferência).
  const gerarPDF = async () => {
    const abertas = (rascunho?.pendencias || []).filter((p) => !p.ok).length;
    const partes = [];
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

  // ── Seções na ordem do deck ──────────────────────────────────
  // `aba` continua sendo o índice no catálogo (é o que o formulário
  // usa); só a exibição segue a ordem escolhida. Capa sempre primeiro.
  // Seção sem slide correspondente (não existe hoje) fica no fim, sem
  // alça, na ordem do catálogo.
  const itens = secoes.map((s, i) => ({ s, i, slide: slideDaSecao[s.t] || null }));
  const foiRemovido = (it) => !!it.slide && !slideTravado(it.slide) && removidos.includes(it.slide);
  const posicao = (it) => {
    if (it.slide === SLIDE_INICIO) return -1;
    const p = it.slide ? ordemIds.indexOf(it.slide) : -1;
    return p < 0 ? Number.MAX_SAFE_INTEGER : p;
  };
  const noDocumento = itens.filter((it) => !foiRemovido(it))
    .sort((a, b) => (posicao(a) - posicao(b)) || (a.i - b.i));
  const foraDoDocumento = itens.filter(foiRemovido);

  const slideAtual = secaoAtual ? slideDaSecao[secaoAtual.t] : null;
  const atualRemovido = secaoAtual ? foiRemovido({ slide: slideAtual }) : false;

  // ── Arrastar ─────────────────────────────────────────────────
  const fimArraste = () => { setArrastando(null); setAlvo(null); };

  const inicioArraste = (e, slideId) => {
    e.dataTransfer.effectAllowed = 'move';
    // O Firefox só começa o arraste se houver algum dado anexado.
    try { e.dataTransfer.setData('text/plain', slideId); } catch { /* navegador recusou, segue */ }
    setArrastando(slideId);
  };

  // Metade de cima da seção = cai antes dela; metade de baixo = depois.
  // Na capa só dá para cair depois: nada vem antes dela.
  const arrastandoSobre = (e, it) => {
    if (!arrastando || !it.slide || it.slide === arrastando || it.slide === SLIDE_FIM) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const caixa = e.currentTarget.getBoundingClientRect();
    const depois = it.slide === SLIDE_INICIO || e.clientY > caixa.top + caixa.height / 2;
    if (!alvo || alvo.id !== it.slide || alvo.depois !== depois) setAlvo({ id: it.slide, depois });
  };

  const soltar = (e) => {
    e.preventDefault();
    if (arrastando && alvo && alvo.id !== arrastando) {
      const nova = ordemIds.filter((id) => id !== arrastando);
      // A capa não está na ordem (indexOf = -1): cair depois dela é
      // ir para a primeira posição.
      const ref = nova.indexOf(alvo.id);
      nova.splice(ref + (alvo.depois ? 1 : 0), 0, arrastando);
      alterarEstrutura({ ordem: nova });
    }
    fimArraste();
  };

  // ── Remover e trazer de volta ────────────────────────────────
  // Remover não apaga nada: os campos continuam guardados e o slide
  // volta para o mesmo lugar da ordem.
  const removerSlide = (it) => {
    alterarEstrutura({ removidos: [...removidos.filter((id) => id !== it.slide), it.slide] });
    toast(`"${it.s.t}" saiu do documento. Dá para trazer de volta em Removidos.`);
  };
  const restaurarSlide = (slideId) => {
    alterarEstrutura({ removidos: removidos.filter((id) => id !== slideId) });
  };

  const itemNav = (it, n, removido) => {
    const { s, i } = it;
    const faltam = vaziosDaSecao(s, dados, essencial);
    const desligada = s.opcional && rascunho.opcionais[s.t] === false;
    const ativa = aba === i;
    const movel = !removido && !!it.slide && !slideTravado(it.slide);
    const linhaDeSoltar = alvo && alvo.id === it.slide && arrastando
      ? (alvo.depois ? S.soltarDepois : S.soltarAntes) : null;
    const mostrarLixeira = movel && (ativa || sobre === s.t) && !arrastando;

    return (
      <div
        key={s.t}
        draggable={movel}
        onDragStart={movel ? (e) => inicioArraste(e, it.slide) : undefined}
        onDragEnd={fimArraste}
        onDragOver={removido ? undefined : (e) => arrastandoSobre(e, it)}
        onDrop={removido ? undefined : soltar}
        onMouseEnter={() => setSobre(s.t)}
        onMouseLeave={() => setSobre((x) => (x === s.t ? null : x))}
        style={{
          ...S.navLinha,
          ...(ativa ? S.navAtivo : {}),
          ...(linhaDeSoltar || {}),
          ...(arrastando === it.slide ? { opacity: 0.4 } : {}),
          cursor: movel ? 'grab' : 'default',
        }}
      >
        <span style={{ ...S.alca, visibility: movel ? 'visible' : 'hidden' }} aria-hidden="true">
          <GripVertical size={12} color="var(--dim)" />
        </span>

        <button type="button" style={S.navBtn} onClick={() => setAba(i)} title={movel ? 'Arraste para mudar a ordem' : undefined}>
          <span style={{ ...S.navNum, ...(ativa ? { color: 'var(--c)' } : {}) }}>
            {removido ? '—' : String(n).padStart(2, '0')}
          </span>
          <span style={{ flex: 1, minWidth: 0, textAlign: 'left', ...(removido ? S.navRemovido : {}) }}>{s.t}</span>
          {removido ? null : desligada ? (
            <span style={S.navOff}>fora</span>
          ) : faltam === 0 ? (
            <Check size={13} color="var(--green)" />
          ) : (
            <span style={S.navFalta}>{faltam}</span>
          )}
        </button>

        {/* Lugar fixo para o botão, para a linha não pular quando ele aparece. */}
        <span style={S.navAcao}>
          {removido ? (
            <button type="button" style={S.icone} onClick={() => restaurarSlide(it.slide)} title="Trazer de volta para o documento">
              <RotateCcw size={12} color="var(--muted)" />
            </button>
          ) : mostrarLixeira ? (
            <button type="button" style={S.icone} onClick={() => removerSlide(it)} title="Remover este slide do documento">
              <Trash2 size={12} color="var(--muted)" />
            </button>
          ) : null}
        </span>
      </div>
    );
  };

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
            {transbordo > 0 && ` · ${transbordo} com texto sobrando`}
          </p>
        </div>

        <span style={{ ...S.chip, color: status.color, borderColor: `color-mix(in srgb, ${status.color} 27%, transparent)` }}>{status.label}</span>

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

        <button type="button" style={S.btnGhost} onClick={() => setApresentando(true)} title="Apresentar para o cliente em tela cheia">
          <Play size={14} /> Apresentar
        </button>

        <button type="button" style={S.btn} onClick={gerarPDF}>
          <FileDown size={15} /> Gerar PDF
        </button>
      </header>

      {apresentando && (
        <DocPresenter
          doc={doc}
          dados={dados}
          opcionais={rascunho.opcionais}
          extras={rascunho.extras}
          estrutura={estrutura}
          titulo={`${documento.clientName || 'Sem cliente'} · ${doc.nome.split('—')[0].trim()}`}
          onClose={() => setApresentando(false)}
          onSalvarPDF={gerarPDF}
        />
      )}

      {marcaPendente() && (
        <p style={S.avisoMarca}>
          Os arquivos de marca não estão configurados em <code>src/lib/docs/marca.js</code>.
          Os slides vão renderizar sem capa, logo e marca d&apos;água.
        </p>
      )}

      {/* ── Corpo ────────────────────────────────────────── */}
      <div style={S.corpo}>
        <nav style={S.nav} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setAlvo(null); }}>
          <p style={S.navDica}>Arraste para mudar a ordem dos slides.</p>

          {noDocumento.map((it, n) => itemNav(it, n + 1, false))}

          {foraDoDocumento.length > 0 && (
            <>
              <p style={S.navGrupo}>Removidos</p>
              {foraDoDocumento.map((it) => itemNav(it, 0, true))}
            </>
          )}

          <button
            type="button"
            style={{ ...S.navItem, ...S.navExtras, ...(aba === -1 ? S.navAtivo : {}) }}
            onClick={() => setAba(-1)}
          >
            <Layers size={13} color={aba === -1 ? 'var(--c)' : 'var(--muted)'} />
            <span style={{ flex: 1, textAlign: 'left' }}>Slides extras</span>
            {rascunho.extras.length > 0 && <span style={S.navFalta}>{rascunho.extras.length}</span>}
          </button>
        </nav>

        <section style={S.meio} ref={colMeio}>
          {aba === -1 ? (
            <DocExtras doc={doc} extras={rascunho.extras} estrutura={estrutura} onChange={alterarExtras} />
          ) : (
            <>
              {atualRemovido && (
                <div style={S.avisoRemovido}>
                  <span style={{ flex: 1 }}>
                    Este slide foi removido: não entra na apresentação nem no PDF.
                    O que você escreveu continua guardado.
                  </span>
                  <button type="button" style={S.btnGhost} onClick={() => restaurarSlide(slideAtual)}>
                    <RotateCcw size={13} /> Trazer de volta
                  </button>
                </div>
              )}
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
                essencial={essencial}
              />
            </>
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
            estrutura={estrutura}
            secaoAtiva={secaoAtual ? secaoAtual.t : null}
            apenasSecao={!deckCompleto && aba >= 0 && !atualRemovido}
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
    borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
    flexShrink: 0, zIndex: 10,
  },
  voltar: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 9,
    width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tituloTopo: {
    fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.2px',
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
    fontSize: 12.5, fontWeight: 600, color: 'var(--text)', flexShrink: 0,
  },
  input: {
    background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9,
    padding: '8px 12px', fontSize: 13, color: 'var(--text)', outline: 'none',
  },
  avisoMarca: {
    fontSize: 12, color: 'var(--amber)', background: 'var(--amber-dim)',
    borderBottom: '1px solid var(--amber-b)', padding: '9px 22px', lineHeight: 1.5,
  },
  avisoRemovido: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
    fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5,
    background: 'var(--surface)', border: '1px dashed var(--border-h)',
    borderRadius: 10, padding: '12px 14px',
  },
  corpo: { flex: 1, display: 'grid', gridTemplateColumns: '236px minmax(360px,1fr) minmax(420px,1.15fr)', minHeight: 0 },
  nav: {
    borderRight: '1px solid var(--border)', padding: 14,
    display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto',
  },
  navDica: { fontSize: 10.5, color: 'var(--muted)', padding: '0 6px 8px', lineHeight: 1.4 },
  navGrupo: {
    fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.1em', textTransform: 'uppercase',
    margin: '12px 0 4px', padding: '12px 6px 0', borderTop: '1px solid var(--border)',
  },
  // Linha de seção: alça, botão que abre a seção e lugar da ação
  // (lixeira ou trazer de volta). Div, não botão, porque leva botões
  // dentro e é ela quem arrasta.
  navLinha: {
    display: 'flex', alignItems: 'center', gap: 2, width: '100%',
    border: '1px solid transparent', borderRadius: 9, padding: '0 4px 0 2px',
    fontSize: 12.5, color: 'var(--muted)', userSelect: 'none',
  },
  navBtn: {
    flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9,
    background: 'transparent', border: 'none', padding: '9px 4px',
    fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer',
  },
  alca: { display: 'flex', alignItems: 'center', width: 12, flexShrink: 0 },
  navAcao: { width: 24, display: 'flex', justifyContent: 'center', flexShrink: 0 },
  icone: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
    width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  // Onde a seção arrastada vai cair: uma linha na cor do painel, em
  // cima ou embaixo da seção sob o mouse.
  soltarAntes: { boxShadow: 'inset 0 2px 0 var(--c)' },
  soltarDepois: { boxShadow: 'inset 0 -2px 0 var(--c)' },
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
  navRemovido: { textDecoration: 'line-through', textDecorationColor: 'var(--dim)' },
  navExtras: { marginTop: 10, borderTop: '1px solid var(--border)', borderRadius: 0, paddingTop: 14 },
  meio: { padding: '26px 26px 60px', overflowY: 'auto', borderRight: '1px solid var(--border)' },
  direita: { padding: 22, overflowY: 'auto', background: 'var(--bg)' },
};
