import { useEffect, useState } from 'react';
import type { ThemeMode } from '../types/theme';
import { getActivePreset, getThemeMode, setThemeMode, toggleThemeMode } from '../styles/theme';

/** React binding for the DOM-level theme system (keeps components in sync via `themechange`). */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode);
  const [presetId, setPresetId] = useState(() => getActivePreset().id);

  useEffect(() => {
    const sync = () => {
      setMode(getThemeMode());
      setPresetId(getActivePreset().id);
    };
    window.addEventListener('themechange', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('themechange', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return {
    mode,
    presetId,
    toggle: () => setMode(toggleThemeMode()),
    setMode: (m: ThemeMode) => setMode(setThemeMode(m)),
    refresh: () => {
      setMode(getThemeMode());
      setPresetId(getActivePreset().id);
    },
  };
}
