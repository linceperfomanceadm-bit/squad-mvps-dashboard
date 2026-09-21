import React, { useState } from 'react';
import ClienteContratoModal from './ClienteContratoModal';
import ClienteCadastroModal from './ClienteCadastroModal';

/*
 * Ficha de contrato do cliente: alterna entre o card de contrato e
 * entregas e o formulário de completar cadastro, sem a tela que abriu
 * precisar controlar os dois modais.
 *
 * `client` deve vir do array vivo do useClients (quem abre guarda só o
 * id), para que marcação e cadastro apareçam em tempo real.
 * `acoes` sai de `acoesDeEntregas` — ação ausente esconde o botão.
 */
export default function ClienteFicha({ client, acoes = {}, onClose, toast }) {
  const [editando, setEditando] = useState(false);
  if (!client) return null;

  if (editando) {
    return (
      <ClienteCadastroModal
        client={client}
        toast={toast}
        onClose={() => setEditando(false)}
        onSaveCadastro={(dados) => acoes.saveCadastro(client.id, dados)}
        onSaveEscopo={(escopo) => acoes.saveEscopo(client.id, escopo)}
        onUpload={acoes.upload}
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
