import { useEffect, useState } from 'react';
import {
  getNextThemeLabel,
  getTheme,
  subscribeTheme,
  toggleTheme as toggleThemeValue,
} from '../lib/theme';

export function useTheme() {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => subscribeTheme(setTheme), []);

  return {
    theme,
    isDark: theme !== 'light',
    nextThemeLabel: getNextThemeLabel(theme),
    toggleTheme: () => toggleThemeValue(),
  };
}
