import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc as fsDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { docPorId } from '../../lib/docs/catalogo';
import DocPreview from '../../components/sectors/socialMedia/docs/DocPreview';
import '../../styles/lince-docs.css';

// ─────────────────────────────────────────────────────────────
// Lince Docs — ROTA DE IMPRESSÃO
//
// Renderiza só o deck: sem barra, sem formulário, sem balanço, sem
// pendências. O PDF que sai daqui vai para a mão do cliente, então
// precisa sair 16:9 cheio, sem tarja branca e sem cabeçalho do
// navegador.
//
// TAMANHO DA PÁGINA — em polegadas, de propósito.
// A versão anterior pedia `size: 1280px 720px`. O Chrome aceita, mas
// quando o destino é um driver do Windows (o "Microsoft Print to
// PDF", que é o padrão em muita máquina) o driver não tem esse papel
// na lista: ignora o pedido e cai em carta retrato com margem. Daí as
// tarjas brancas, o cabeçalho com data e URL, e o erro na hora de
// gerar o arquivo. 13.333in x 7.5in é exatamente o mesmo 16:9, numa
// unidade que os drivers entendem.
//
// O `@page` é injetado aqui e não na folha de estilo porque ele não
// tem escopo: no CSS global valeria para qualquer impressão do app.
//
// Leitura única com getDoc, sem listener: um documento que muda no
// meio da impressão só geraria um PDF inconsistente.
// ─────────────────────────────────────────────────────────────

const REGRA_PAGINA = `
@page { size: 13.333in 7.5in; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; background: #fff; }
  #lince-print-ui { display: none !important; }
}
`;

// Espera tudo que muda o desenho da página: fontes da marca e todas
// as imagens (capa, logo, mockups). Imprimir antes disso sai com capa
// em branco e a tipografia trocada pela de fallback. O timeout fixo
// de 1,2s que existia aqui antes era chute — em conexão lenta saía
// cedo demais.
const esperarRender = async () => {
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  } catch { /* navegador sem a Font Loading API */ }

  const pendentes = Array.from(document.images).filter(img => !img.complete);
  if (pendentes.length) {
    await Promise.all(pendentes.map(img => new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 5000); // rede ruim não trava a impressão
    })));
  }

  // Um quadro extra para o layout assentar depois do último decode.
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 120)));
};

export default function DocPrintPage() {
  const { docId } = useParams();
  const [documento, setDocumento] = useState(null);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState(false);

  // A regra de página entra só enquanto esta rota está montada.
  useEffect(() => {
    const tag = document.createElement('style');
    tag.setAttribute('data-lince-print', 'true');
    tag.textContent = REGRA_PAGINA;
    document.head.appendChild(tag);
    const fundo = document.body.style.background;
    document.body.style.background = '#050509';
    return () => {
      document.head.removeChild(tag);
      document.body.style.background = fundo;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const snap = await getDoc(fsDoc(db, 'documents', docId));
        if (!vivo) return;
        if (!snap.exists()) { setErro('Documento não encontrado.'); return; }
        setDocumento({ id: snap.id, ...snap.data() });
      } catch (e) {
        if (vivo) setErro(e.message);
      }
    })();
    return () => { vivo = false; };
  }, [docId]);

  const imprimir = useCallback(() => { window.print(); }, []);

  // Abre o diálogo sozinho quando o deck terminou de desenhar.
  useEffect(() => {
    if (!documento) return undefined;
    let vivo = true;
    (async () => {
      await esperarRender();
      if (!vivo) return;
      setPronto(true);
      window.print();
    })();
    return () => { vivo = false; };
  }, [documento]);

  if (erro) {
    return <p style={{ padding: 40, color: '#eaeaf5', fontFamily: "'Outfit', sans-serif" }}>{erro}</p>;
  }
  if (!documento) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const doc = docPorId(documento.tipo);
  if (!doc) {
    return <p style={{ padding: 40, color: '#eaeaf5' }}>Tipo de documento desconhecido: {documento.tipo}</p>;
  }

  return (
    <div style={{ background: '#050509', minHeight: '100vh' }}>
      {/* Só existe na tela. O @media print acima esconde na hora de
          imprimir, senão isto viraria a primeira folha do PDF. */}
      <div id="lince-print-ui" style={S.painel}>
        <p style={S.titulo}>{pronto ? 'Deck pronto para exportar' : 'Preparando o deck...'}</p>

        <p style={S.texto}>
          No diálogo, confira estes quatro pontos — é o que separa um PDF apresentável
          de um com tarja branca e data no topo:
        </p>

        <ol style={S.lista}>
          <li>
            <strong>Destino:</strong> "Salvar como PDF" — não "Microsoft Print to PDF".
            O driver do Windows não aceita a folha 16:9, e é ele que estava causando o erro.
          </li>
          <li><strong>Margens:</strong> Nenhuma.</li>
          <li><strong>Cabeçalhos e rodapés:</strong> desmarcado. É o que tira a data e a URL.</li>
          <li><strong>Gráficos de segundo plano:</strong> marcado, senão o fundo escuro sai branco.</li>
        </ol>

        <p style={S.texto}>
          Os três últimos ficam em "Mais definições". O Chrome guarda a escolha, então é
          uma vez só por máquina.
        </p>

        <button type="button" style={S.botao} onClick={imprimir}>
          Abrir diálogo de impressão
        </button>
        <p style={S.rodape}>Ou use Ctrl+P.</p>
      </div>

      <DocPreview
        doc={doc}
        dados={documento.dados || {}}
        opcionais={documento.opcionais || {}}
        extras={documento.extras || []}
        imprimindo
      />
    </div>
  );
}

const S = {
  painel: {
    maxWidth: 720, margin: '0 auto', padding: '26px 24px 22px',
    fontFamily: "'Outfit', sans-serif", color: '#b6b6c8',
  },
  titulo: { fontSize: 15, fontWeight: 600, color: '#eaeaf5', marginBottom: 10 },
  texto: { fontSize: 13, lineHeight: 1.6, marginBottom: 10 },
  lista: {
    fontSize: 13, lineHeight: 1.7, margin: '0 0 12px', paddingLeft: 20,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  botao: {
    background: '#EE3363', border: 'none', borderRadius: 10, padding: '11px 18px',
    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Outfit', sans-serif",
  },
  rodape: { fontSize: 11.5, color: '#52526e', marginTop: 8 },
};
