import React from 'react';
import { Aside } from './AppShell';
import { useSectorTheme } from '../../contexts/ThemeContext';

// ─── Sidebar (compatibilidade) ────────────────────────────────
// Mantida para os dashboards de setor que ainda montam
// <Sidebar/> + <main marginLeft:224>. Já desenha a sidebar nova e
// pinta a cor do setor; a barra superior (Agenda, tema, perfil)
// chega quando o dashboard passar a usar <AppShell>.
// Enquanto isso o perfil fica aqui embaixo da marca (showUser).

export default function Sidebar({ navItems, activeKey, onNav, onAddClient, sectorId }) {
  useSectorTheme(sectorId);
  return (
    <Aside
      sectorId={sectorId}
      navItems={navItems}
      activeKey={activeKey}
      onNav={onNav}
      onAddClient={onAddClient}
      showUser
    />
  );
}
