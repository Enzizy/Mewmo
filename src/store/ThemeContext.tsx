import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import React from 'react';
import { Appearance } from 'react-native';
import {
  colors,
  getActiveTheme,
  setActiveTheme,
  subscribeToTheme,
  type Palette,
  type ThemeName,
  type ThemePreference,
} from '@/constants/theme';

const THEME_PREFERENCE_KEY = 'lifedesk.theme';

type ThemeContextValue = {
  /** The palette actually in use right now. */
  theme: ThemeName;
  /** What the user selected, which may be "system". */
  preference: ThemePreference;
  colors: Palette;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_PREFERENCE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

function resolve(preference: ThemePreference): ThemeName {
  if (preference !== 'system') return preference;
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  // Applied in the initializer so the tree never paints a frame in the wrong
  // theme. Nothing has subscribed yet at this point, so no listener fires.
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const stored = readStoredPreference();
    setActiveTheme(resolve(stored));
    return stored;
  });

  useEffect(() => {
    if (preference !== 'system') return;
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setActiveTheme(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => subscription.remove();
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    setActiveTheme(resolve(next));
    try {
      if (next === 'system') localStorage.removeItem(THEME_PREFERENCE_KEY);
      else localStorage.setItem(THEME_PREFERENCE_KEY, next);
    } catch {
      // A preference that cannot be written is not worth failing a render over.
    }
  }, []);

  const theme = useThemeName();
  const value = useMemo<ThemeContextValue>(() => ({ theme, preference, colors, setPreference }), [preference, setPreference, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeName() {
  return useSyncExternalStore(subscribeToTheme, getActiveTheme, getActiveTheme);
}

/**
 * Subscribes a component to theme changes. Every screen calls this so that a
 * switch re-renders it against the new palette; the returned `colors` is the
 * same live proxy exported from the theme module.
 */
export function useTheme(): ThemeContextValue {
  const context = React.use(ThemeContext);
  const fallbackName = useThemeName();
  return context ?? { theme: fallbackName, preference: 'system', colors, setPreference: () => undefined };
}
