import React, { useEffect, useState } from 'react';
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
// pendências. Abre em aba nova e chama o diálogo de impressão
// sozinha, para que a única decisão que sobre para a pessoa seja
// escolher "Salvar como PDF".
//
// O tamanho da página é injetado aqui, e não na folha de estilo:
// `@page` não tem escopo, então no CSS global ele valeria para
// qualquer impressão do app.
//
// Leitura única com getDoc, sem listener: um documento que muda no
// meio da impressão só geraria um PDF inconsistente.
// ─────────────────────────────────────────────────────────────

const REGRA_PAGINA = `
@page { size: 1280px 720px; margin: 0; }
@media print {
  html, body { margin: 0; padding: 0; background: #fff; }
  #lince-print-aviso { display: none !important; }
}
`;

export default function DocPrintPage() {
  const { docId } = useParams();
  const [documento, setDocumento] = useState(null);
  const [erro, setErro] = useState('');

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

  // Espera as imagens de marca carregarem antes de abrir o diálogo:
  // imprimir cedo demais sai com capa e logo em branco.
  useEffect(() => {
    if (!documento) return undefined;
    const t = setTimeout(() => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => window.print());
      } else {
        window.print();
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [documento]);

  if (erro) {
    return <p style={{ padding: 40, color: '#eaeaf5', fontFamily: 'var(--f)' }}>{erro}</p>;
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
      <p id="lince-print-aviso" style={S.aviso}>
        Preparando a impressão. No diálogo, escolha <strong>Salvar como PDF</strong>.
        Se não abrir sozinho, use Ctrl+P.
      </p>
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
  aviso: {
    fontFamily: "'Outfit', sans-serif", fontSize: 13, color: '#52526e',
    textAlign: 'center', padding: '14px 20px', lineHeight: 1.5,
  },
};
