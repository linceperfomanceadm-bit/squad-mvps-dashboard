import React from 'react';
import PostDetalheModal from './PostDetalheModal';
import { MarcacaoModal, NovaMarcacaoModal } from './MarcacaoModais';

// ─────────────────────────────────────────────────────────────
// Modais do conteúdo num lugar só. O painel guarda `modal` e qualquer
// tela (visão geral, calendário) abre o mesmo detalhe:
//   { t: 'post', planoId, postId } | { t: 'marca', id } | { t: 'novaMarca', data }
// ─────────────────────────────────────────────────────────────

export default function ConteudoModais({
  modal, onClose, modo, planos, clientes, marcacoes, me, acoes, acoesMarcacao, toast, onAbrirPlanejamento,
}) {
  if (!modal) return null;

  if (modal.t === 'post') {
    const plano = planos.find((p) => p.id === modal.planoId);
    const post = plano?.posts?.find((p) => p.id === modal.postId);
    if (!plano || !post) return null;
    return (
      <PostDetalheModal
        plano={plano}
        post={post}
        cliente={clientes.find((c) => c.id === plano.clientId)}
        modo={modo}
        marcacoes={marcacoes}
        me={me}
        acoes={acoes}
        toast={toast}
        onClose={onClose}
        onAbrirPlanejamento={(planoId, postId) => { onClose(); onAbrirPlanejamento && onAbrirPlanejamento(planoId, postId); }}
      />
    );
  }

  if (modal.t === 'marca') {
    const m = marcacoes.find((x) => x.id === modal.id);
    if (!m) return null;
    return (
      <MarcacaoModal
        marcacao={m}
        podeExcluir={!!acoesMarcacao && m.autorName === me}
        onClose={onClose}
        onExcluir={async () => {
          const res = await acoesMarcacao.excluirMarcacao(m.id);
          if (res.success) { toast('Marcação excluída.'); onClose(); } else toast(res.error, 'e');
        }}
      />
    );
  }

  if (modal.t === 'novaMarca' && acoesMarcacao) {
    return (
      <NovaMarcacaoModal
        clientes={clientes}
        dataInicial={modal.data}
        onClose={onClose}
        onSalvar={async (f) => {
          const res = await acoesMarcacao.criarMarcacao(f, me);
          if (res.success) { toast('Marcação salva na sua agenda.'); onClose(); } else toast(res.error, 'e');
        }}
      />
    );
  }
  return null;
}
