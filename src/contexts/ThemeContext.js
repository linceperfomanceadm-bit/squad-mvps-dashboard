import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { sectorTheme } from '../lib/firebase';

// ─── Tema (dark / light) ──────────────────────────────────────
// O tema vive em <html data-theme="..."> e o index.css troca os
// tokens por CSS. Persistido em localStorage, por navegador — cada
// pessoa escolhe o seu, não é configuração de conta.

const STORAGE_KEY = 'squad-theme';
const ThemeContext = createContext({ theme: 'dark', setTheme: () => {}, toggle: () => {} });

const readTheme = () => {
  try { return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
};

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* modo privado */ }
  }, [theme]);

  const setTheme = useCallback((t) => setThemeState(t === 'light' ? 'light' : 'dark'), []);
  const toggle = useCallback(() => setThemeState(t => (t === 'light' ? 'dark' : 'light')), []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// ─── Cor do painel ────────────────────────────────────────────
// Pinta --c / --c2 / --on no <html> conforme o setor e o tema.
// É o que faz o item ativo da sidebar, os botões primários e os
// gráficos seguirem a cor do emblema. Chame uma vez por dashboard.
export function useSectorTheme(sectorId) {
  const { theme } = useTheme();
  useEffect(() => {
    const t = sectorTheme(sectorId, theme);
    const root = document.documentElement.style;
    root.setProperty('--c', t.c);
    root.setProperty('--c2', t.c2);
    root.setProperty('--on', t.on);
  }, [sectorId, theme]);
}
