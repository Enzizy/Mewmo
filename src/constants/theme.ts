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
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodySemiBold: 'DMSans_600SemiBold',
  bodyBold: 'DMSans_700Bold',
  pixel: 'Silkscreen_400Regular',
  pixelSemiBold: 'Silkscreen_400Regular',
  pixelBold: 'Silkscreen_700Bold',
  editorial: 'Silkscreen_400Regular',
  editorialSemiBold: 'Silkscreen_700Bold',
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  full: 999,
} as const;

export const type = {
  display: { fontFamily: fonts.pixelBold, fontSize: 34, lineHeight: 36, color: colors.ink },
  title: { fontFamily: fonts.pixelSemiBold, fontSize: 24, lineHeight: 28, color: colors.ink },
  section: { fontFamily: fonts.pixelSemiBold, fontSize: 17, lineHeight: 21, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  label: { fontFamily: fonts.pixelSemiBold, fontSize: 12, lineHeight: 15, color: colors.secondary },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.secondary },
} as const;

export const motion = { fast: 140, base: 220, slow: 360 } as const;
