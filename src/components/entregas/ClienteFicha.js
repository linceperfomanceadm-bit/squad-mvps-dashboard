import React, { useState } from 'react';
import ClienteContratoModal from './ClienteContratoModal';
import ClienteForm from '../cadastro/ClienteForm';

/*
 * Ficha de contrato do cliente: alterna entre o card de contrato e
 * entregas e o formulário único de cadastro (ClienteForm), sem a tela
 * que abriu precisar controlar os dois modais.
 *
 * `client` deve vir do array vivo do useClients (quem abre guarda só o
 * id), para que marcação e cadastro apareçam em tempo real.
 * `acoes` sai de `acoesDeEntregas` — ação ausente esconde o botão.
 * A aba Equipe e a troca de nome aparecem só quando `acoes` traz
 * `salvarEquipe`/`renomear` (admin) e a tela passa `collaborators`.
 * `editar` abre direto no formulário (botão "Editar" da lista do admin).
 */
export default function ClienteFicha({ client, acoes = {}, collaborators = [], onClose, toast, editar = false, etapaInicial }) {
  const [editando, setEditando] = useState(editar);
  if (!client) return null;

  if (editando) {
    const comEquipe = !!acoes.salvarEquipe && collaborators.length > 0;
    return (
      <ClienteForm
        modo="editar"
        client={client}
        collaborators={collaborators}
        toast={toast}
        etapaInicial={etapaInicial}
        onClose={editar ? onClose : () => setEditando(false)}
        onUpload={acoes.upload}
        onSaveCadastro={(dados) => acoes.saveCadastro(client.id, dados)}
        onSaveEscopo={(escopo) => acoes.saveEscopo(client.id, escopo)}
        onRenomear={acoes.renomear ? (nome) => acoes.renomear(client.id, nome) : undefined}
        onSalvarEquipe={comEquipe ? (responsibles) => acoes.salvarEquipe(client.id, responsibles) : undefined}
      />
    );
  }

  return (
    <ClienteContratoModal
      client={client}
      onClose={onClose}
      onEditar={acoes.saveCadastro ? () => setEditando(true) : undefined}
      onMarcar={acoes.marcar ? (mes, itemId, delta) => acoes.marcar(client.id, mes, itemId, delta) : undefined}
      onAjustar={acoes.ajustar ? (mes, qtds) => acoes.ajustar(client.id, mes, qtds) : undefined}
    />
  );
}
