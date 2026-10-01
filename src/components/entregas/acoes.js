/*
 * Liga as funções do useClients às telas de entregas, já com o nome de
 * quem está logado e o toast de erro. Cada painel monta o seu objeto
 * com o que a pessoa pode fazer:
 *
 *   acoesDeEntregas(useClientsResult, me, toast)            → tudo (CS, líder, admin)
 *     (renomear e salvarEquipe só existem se a tela passar renameClient
 *     e updateClient — hoje só o admin passa)
 *   acoesDeEntregas(useClientsResult, me, toast, { soMarcar: true }) → quem produz
 *
 * Ação que não vem no objeto some da tela (sem botão).
 */
export function acoesDeEntregas(fns, me, toast, { soMarcar = false } = {}) {
  const avisa = (r) => {
    if (r && r.success === false && toast) toast(r.error || 'Não foi possível salvar.', 'e');
    return r;
  };

  const marcar = fns.marcarEntrega
    ? async (clientId, mes, itemId, delta) => avisa(await fns.marcarEntrega(clientId, mes, itemId, delta, me))
    : undefined;

  if (soMarcar) return { marcar };

  return {
    marcar,
    ajustar: fns.ajustarMesEntregas
      ? async (clientId, mes, qtds) => {
        const r = avisa(await fns.ajustarMesEntregas(clientId, mes, qtds, me));
        if (r?.success && toast) toast('Ajuste do mês salvo.');
        return r;
      }
      : undefined,
    saveCadastro: fns.saveCadastro
      ? async (clientId, dados) => fns.saveCadastro(clientId, dados, me)
      : undefined,
    saveEscopo: fns.saveEscopo
      ? async (clientId, escopo) => fns.saveEscopo(clientId, escopo, me)
      : undefined,
    upload: fns.uploadClientFile,
    // Só o admin recebe estas duas (formulário único: nome e equipe).
    // O nome vai pelo renameClient porque está copiado em tasks,
    // requests e documents, e só ele propaga.
    renomear: fns.renameClient
      ? async (clientId, nome) => {
        const r = await fns.renameClient(clientId, nome, me);
        if (r?.success && r.warning && toast) toast(r.warning, 'e');
        return r;
      }
      : undefined,
    salvarEquipe: fns.updateClient
      ? async (clientId, responsibles) => fns.updateClient(clientId, { responsibles })
      : undefined,
  };
}
