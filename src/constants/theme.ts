export const colors = {
  background: '#FAFAFA',
  paper: '#FFFFFF',
  surface: '#FFFFFF',
  ink: '#111111',
  dark: '#111111',
  secondary: '#555555',
  muted: '#818181',
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
} as const;

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
  pixel: 'InstrumentSans_500Medium',
  pixelSemiBold: 'InstrumentSans_600SemiBold',
  pixelBold: 'InstrumentSans_700Bold',
  editorial: 'InstrumentSans_500Medium',
  editorialSemiBold: 'InstrumentSans_700Bold',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  full: 999,
} as const;

export const type = {
  display: { fontFamily: fonts.bodyBold, fontSize: 34, lineHeight: 40, letterSpacing: -1.1, color: colors.ink },
  title: { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 32, letterSpacing: -0.6, color: colors.ink },
  section: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: colors.secondary },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
} as const;

export const motion = { fast: 140, base: 220, slow: 360 } as const;
