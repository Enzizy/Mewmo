import { StyleSheet } from 'react-native';

export type ThemeName = 'light' | 'dark';
/** What the user chose. "system" follows the device appearance setting. */
export type ThemePreference = ThemeName | 'system';

export type Palette = {
  background: string;
  paper: string;
  surface: string;
  ink: string;
  dark: string;
  secondary: string;
  muted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  terracotta: string;
  terracottaDark: string;
  terracottaSoft: string;
  green: string;
  greenSoft: string;
  mustard: string;
  mustardSoft: string;
  blue: string;
  blueSoft: string;
  danger: string;
  dangerSoft: string;
  catRed: string;
  catYellow: string;
  bitcoin: string;
  vanguard: string;
  /** Backdrop behind modals and dialogs. Opacity is applied by the component. */
  scrim: string;
  /** Secondary text on an `ink`-filled surface, where `paper` is the primary. */
  onInkMuted: string;
  /** Divider drawn on an `ink`-filled surface. */
  onInkBorder: string;
  /** Pressed state for an `ink`-filled button. */
  inkPressed: string;
  /** Warning tint for an `ink`-filled surface, such as an over-budget hero. */
  warningOnInk: string;
};

/**
 * `ink` and `paper` are a deliberate pair: `ink` is the strongest foreground and
 * `paper` the surface that sits behind it. Inverted elements — a filled button
 * with `backgroundColor: ink` and `color: paper` — stay legible in both themes
 * because both swap together.
 */
const lightPalette: Palette = {
  background: '#FAFAFA',
  paper: '#FFFFFF',
  surface: '#FFFFFF',
  ink: '#111111',
  dark: '#111111',
  secondary: '#555555',
  muted: '#707070',
  border: '#E5E5E5',
  borderStrong: '#C9C9C9',
  accent: '#2563EB',
  accentSoft: '#E8F0FF',
  terracotta: '#2563EB',
  terracottaDark: '#1746B0',
  terracottaSoft: '#E8F0FF',
  green: '#16824B',
  greenSoft: '#E4F5EB',
  mustard: '#C47B00',
  mustardSoft: '#FFF3D6',
  blue: '#2563EB',
  blueSoft: '#E8F0FF',
  danger: '#C9372C',
  dangerSoft: '#FCE8E6',
  catRed: '#D92336',
  catYellow: '#FFD400',
  bitcoin: '#F7931A',
  vanguard: '#C8102E',
  scrim: '#111111',
  onInkMuted: '#C8C8C8',
  onInkBorder: '#3A3A3A',
  inkPressed: '#2A2A2A',
  warningOnInk: '#332218',
};

const darkPalette: Palette = {
  background: '#0E0F11',
  paper: '#17181B',
  surface: '#17181B',
  ink: '#F3F4F6',
  dark: '#F3F4F6',
  secondary: '#A9ADB4',
  muted: '#868B93',
  border: '#2A2C31',
  borderStrong: '#3D4047',
  accent: '#6AA0FF',
  accentSoft: '#17233C',
  terracotta: '#6AA0FF',
  terracottaDark: '#A8C6FF',
  terracottaSoft: '#17233C',
  green: '#4ADE80',
  greenSoft: '#12291D',
  mustard: '#F0B429',
  mustardSoft: '#33280D',
  blue: '#6AA0FF',
  blueSoft: '#17233C',
  danger: '#FF7A6E',
  dangerSoft: '#361916',
  catRed: '#FF5A6A',
  catYellow: '#FFD400',
  bitcoin: '#F7931A',
  vanguard: '#E8455C',
  scrim: '#000000',
  onInkMuted: '#5A6068',
  onInkBorder: '#CBCED4',
  inkPressed: '#DCDEE3',
  warningOnInk: '#F6E3C4',
};

const palettes: Record<ThemeName, Palette> = { light: lightPalette, dark: darkPalette };

let activeTheme: ThemeName = 'light';
const listeners = new Set<() => void>();

export function getActiveTheme() {
  return activeTheme;
}

export function setActiveTheme(name: ThemeName) {
  if (name === activeTheme) return;
  activeTheme = name;
  for (const listener of listeners) listener();
}

export function subscribeToTheme(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Reads resolve against whichever theme is active at the moment of access, so a
 * `colors.ink` written inside JSX or inside `themedStyles` needs no changes to
 * support both themes.
 */
export const colors = new Proxy({} as Palette, {
  get: (_target, key: string) => palettes[activeTheme][key as keyof Palette],
  has: (_target, key: string) => key in palettes[activeTheme],
  ownKeys: () => Reflect.ownKeys(palettes[activeTheme]),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
}) as Palette;

type StyleInput = Parameters<typeof StyleSheet.create>[0];

/**
 * Drop-in replacement for `StyleSheet.create` whose factory is evaluated once
 * per theme and cached, instead of once at module load. Components re-render on
 * a theme change via `useTheme`; this supplies the matching colors.
 */
export function themedStyles<T extends StyleInput>(factory: () => T): T {
  const cache = new Map<ThemeName, T>();
  const resolve = () => {
    const cached = cache.get(activeTheme);
    if (cached) return cached;
    const created = StyleSheet.create(factory());
    cache.set(activeTheme, created);
    return created;
  };
  return new Proxy({} as T, {
    get: (_target, key: string) => (resolve() as Record<string, unknown>)[key],
    has: (_target, key: string) => key in (resolve() as object),
    ownKeys: () => Reflect.ownKeys(resolve() as object),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  }) as T;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const fonts = {
  body: 'InstrumentSans_400Regular',
  bodyMedium: 'InstrumentSans_500Medium',
  bodySemiBold: 'InstrumentSans_600SemiBold',
  bodyBold: 'InstrumentSans_700Bold',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  full: 999,
} as const;

/** Typography tokens read colors through the proxy, so they follow the theme. */
export const type = {
  get display() { return { fontFamily: fonts.bodyBold, fontSize: 34, lineHeight: 40, letterSpacing: -1.1, color: colors.ink }; },
  get title() { return { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: colors.ink }; },
  get section() { return { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: colors.ink }; },
  get body() { return { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink }; },
  get label() { return { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.secondary }; },
  get caption() { return { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary }; },
};

export const motion = { fast: 140, base: 220, slow: 360 } as const;
