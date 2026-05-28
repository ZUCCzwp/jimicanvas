import { useEffect, useState } from 'react';
import { getTheme, subscribeTheme, toggleTheme as toggleThemeValue } from '../lib/theme';

export function useTheme() {
  const [theme, setTheme] = useState(getTheme);

  useEffect(() => subscribeTheme(setTheme), []);

  return {
    theme,
    isDark: theme === 'dark',
    toggleTheme: () => toggleThemeValue(),
  };
}
