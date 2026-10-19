import type { ThemeId } from './types'

export interface ThemeTokens {
  bg: string
  bgElevated: string
  surface: string
  surfaceHover: string
  border: string
  borderStrong: string
  text: string
  textSecondary: string
  textMuted: string
  accent: string
  accentHover: string
  accentContrast: string
  selection: string
  codeBg: string
  codeBorder: string
  inlineCode: string
  danger: string
  warning: string
  success: string
  shadow: string
  scrollbar: string
  synKeyword: string
  synString: string
  synNumber: string
  synComment: string
  synFunction: string
  synVariable: string
  synOperator: string
  synType: string
}

export interface ThemeDefinition {
  id: ThemeId
  nameKey: string
  light: ThemeTokens
  dark: ThemeTokens
}

export const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    nameKey: 'settings.appearanceSection.themes.default',
    light: {
      bg: '#ffffff',
      bgElevated: '#fbfbfa',
      surface: '#f3f3f1',
      surfaceHover: '#ececea',
      border: '#e4e4e0',
      borderStrong: '#cfcfca',
      text: '#252525',
      textSecondary: '#575752',
      textMuted: '#8a8a84',
      accent: '#3b6ef5',
      accentHover: '#2f5ee0',
      accentContrast: '#ffffff',
      selection: 'rgba(59, 110, 245, 0.18)',
      codeBg: '#f6f6f4',
      codeBorder: '#e6e6e2',
      inlineCode: '#b43757',
      danger: '#d93a3a',
      warning: '#b8770b',
      success: '#2f7d4f',
      shadow: '0 10px 30px rgba(20, 20, 18, 0.12)',
      scrollbar: 'rgba(0, 0, 0, 0.18)',
      synKeyword: '#a626a4',
      synString: '#2f7d4f',
      synNumber: '#b76b01',
      synComment: '#9a9a94',
      synFunction: '#4078f2',
      synVariable: '#c18401',
      synOperator: '#0184bc',
      synType: '#986801',
    },
    dark: {
      bg: '#1c1d21',
      bgElevated: '#232429',
      surface: '#2a2b31',
      surfaceHover: '#32333a',
      border: '#35363d',
      borderStrong: '#46474f',
      text: '#e7e7e4',
      textSecondary: '#b5b5b0',
      textMuted: '#8a8a85',
      accent: '#7c9cff',
      accentHover: '#94adff',
      accentContrast: '#111318',
      selection: 'rgba(124, 156, 255, 0.24)',
      codeBg: '#232429',
      codeBorder: '#34353c',
      inlineCode: '#f28ba8',
      danger: '#ff6b6b',
      warning: '#e0a94a',
      success: '#6fcf97',
      shadow: '0 14px 36px rgba(0, 0, 0, 0.45)',
      scrollbar: 'rgba(255, 255, 255, 0.18)',
      synKeyword: '#c678dd',
      synString: '#98c379',
      synNumber: '#d19a66',
      synComment: '#7f848e',
      synFunction: '#61afef',
      synVariable: '#e5c07b',
      synOperator: '#56b6c2',
      synType: '#e5c07b',
    },
  },
  {
    id: 'paper',
    nameKey: 'settings.appearanceSection.themes.paper',
    light: {
      bg: '#fbf7ef',
      bgElevated: '#f6f0e4',
      surface: '#f0e8d8',
      surfaceHover: '#e8decb',
      border: '#e0d5c1',
      borderStrong: '#c9b99f',
      text: '#332c22',
      textSecondary: '#5f5444',
      textMuted: '#8d806c',
      accent: '#9a5b2d',
      accentHover: '#824a22',
      accentContrast: '#fffaf2',
      selection: 'rgba(154, 91, 45, 0.2)',
      codeBg: '#f2ebdc',
      codeBorder: '#e2d6c1',
      inlineCode: '#a2442f',
      danger: '#b93a32',
      warning: '#a06a0a',
      success: '#4d7148',
      shadow: '0 10px 30px rgba(74, 58, 35, 0.14)',
      scrollbar: 'rgba(74, 58, 35, 0.2)',
      synKeyword: '#8f4e8b',
      synString: '#4d7148',
      synNumber: '#9c6217',
      synComment: '#a1937e',
      synFunction: '#3d6592',
      synVariable: '#96651e',
      synOperator: '#2f7373',
      synType: '#7d5b1f',
    },
    dark: {
      bg: '#211d18',
      bgElevated: '#28231d',
      surface: '#302a23',
      surfaceHover: '#3a332a',
      border: '#413930',
      borderStrong: '#564c3f',
      text: '#eee6d8',
      textSecondary: '#c9bfae',
      textMuted: '#9a8f7d',
      accent: '#d9a06b',
      accentHover: '#e6b383',
      accentContrast: '#221a11',
      selection: 'rgba(217, 160, 107, 0.25)',
      codeBg: '#28231d',
      codeBorder: '#423a30',
      inlineCode: '#e8a28d',
      danger: '#ff8177',
      warning: '#e2b45d',
      success: '#9bd08f',
      shadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
      scrollbar: 'rgba(238, 230, 216, 0.18)',
      synKeyword: '#d3a4dc',
      synString: '#9bd08f',
      synNumber: '#e2b45d',
      synComment: '#8a7f6e',
      synFunction: '#8fb8e0',
      synVariable: '#e2b45d',
      synOperator: '#7dc4c4',
      synType: '#e2b45d',
    },
  },
  {
    id: 'nordic',
    nameKey: 'settings.appearanceSection.themes.nordic',
    light: {
      bg: '#f9fbfc',
      bgElevated: '#f2f6f8',
      surface: '#eaf0f4',
      surfaceHover: '#dfe8ee',
      border: '#d6e0e6',
      borderStrong: '#b9c9d3',
      text: '#23313a',
      textSecondary: '#4d606c',
      textMuted: '#7b8e99',
      accent: '#2f7f92',
      accentHover: '#256b7b',
      accentContrast: '#ffffff',
      selection: 'rgba(47, 127, 146, 0.2)',
      codeBg: '#f0f5f7',
      codeBorder: '#dbe5ea',
      inlineCode: '#b34765',
      danger: '#c63e4d',
      warning: '#a86d12',
      success: '#3b7d63',
      shadow: '0 10px 30px rgba(30, 55, 70, 0.12)',
      scrollbar: 'rgba(30, 55, 70, 0.18)',
      synKeyword: '#8b5fa8',
      synString: '#3b7d63',
      synNumber: '#a86d12',
      synComment: '#93a3ac',
      synFunction: '#2f6f9c',
      synVariable: '#96752a',
      synOperator: '#2f7f92',
      synType: '#7a5f24',
    },
    dark: {
      bg: '#1b2329',
      bgElevated: '#212b32',
      surface: '#28343c',
      surfaceHover: '#303e48',
      border: '#35434d',
      borderStrong: '#495a66',
      text: '#e3edf2',
      textSecondary: '#b4c5cf',
      textMuted: '#8499a5',
      accent: '#6fb6c8',
      accentHover: '#8bc8d7',
      accentContrast: '#102025',
      selection: 'rgba(111, 182, 200, 0.25)',
      codeBg: '#212b32',
      codeBorder: '#35434d',
      inlineCode: '#f0a3b5',
      danger: '#ff7b88',
      warning: '#e2b35d',
      success: '#7dd0a8',
      shadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
      scrollbar: 'rgba(227, 237, 242, 0.18)',
      synKeyword: '#c9a0dc',
      synString: '#7dd0a8',
      synNumber: '#e2b35d',
      synComment: '#7d8f9a',
      synFunction: '#82c2e8',
      synVariable: '#e2b35d',
      synOperator: '#6fb6c8',
      synType: '#e2b35d',
    },
  },
  {
    id: 'contrast',
    nameKey: 'settings.appearanceSection.themes.contrast',
    light: {
      bg: '#ffffff',
      bgElevated: '#ffffff',
      surface: '#f0f0f0',
      surfaceHover: '#e4e4e4',
      border: '#bcbcbc',
      borderStrong: '#6b6b6b',
      text: '#0a0a0a',
      textSecondary: '#333333',
      textMuted: '#5c5c5c',
      accent: '#0047d6',
      accentHover: '#003bb3',
      accentContrast: '#ffffff',
      selection: 'rgba(0, 71, 214, 0.24)',
      codeBg: '#f4f4f4',
      codeBorder: '#c7c7c7',
      inlineCode: '#a00034',
      danger: '#b30000',
      warning: '#7a4d00',
      success: '#0e6434',
      shadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
      scrollbar: 'rgba(0, 0, 0, 0.35)',
      synKeyword: '#7a0099',
      synString: '#0e6434',
      synNumber: '#7a4d00',
      synComment: '#565656',
      synFunction: '#003bb3',
      synVariable: '#7a4d00',
      synOperator: '#005f66',
      synType: '#6b3d00',
    },
    dark: {
      bg: '#0b0b0b',
      bgElevated: '#121212',
      surface: '#1c1c1c',
      surfaceHover: '#262626',
      border: '#3d3d3d',
      borderStrong: '#6b6b6b',
      text: '#ffffff',
      textSecondary: '#d6d6d6',
      textMuted: '#a3a3a3',
      accent: '#8ab4ff',
      accentHover: '#a9c7ff',
      accentContrast: '#001233',
      selection: 'rgba(138, 180, 255, 0.32)',
      codeBg: '#121212',
      codeBorder: '#3d3d3d',
      inlineCode: '#ff9db3',
      danger: '#ff8080',
      warning: '#ffd166',
      success: '#7dffb0',
      shadow: '0 14px 36px rgba(0, 0, 0, 0.7)',
      scrollbar: 'rgba(255, 255, 255, 0.35)',
      synKeyword: '#ffa3ff',
      synString: '#7dffb0',
      synNumber: '#ffd166',
      synComment: '#a3a3a3',
      synFunction: '#8ab4ff',
      synVariable: '#ffd166',
      synOperator: '#7df9ff',
      synType: '#ffd166',
    },
  },
]

export function getThemeDefinition(id: ThemeId): ThemeDefinition {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}

export function getThemeTokens(id: ThemeId, mode: 'light' | 'dark'): ThemeTokens {
  const theme = getThemeDefinition(id)
  return mode === 'dark' ? theme.dark : theme.light
}

export function themeTokensToCss(tokens: ThemeTokens): Record<string, string> {
  const mapping: Record<keyof ThemeTokens, string> = {
    bg: '--nd-bg',
    bgElevated: '--nd-bg-elevated',
    surface: '--nd-surface',
    surfaceHover: '--nd-surface-hover',
    border: '--nd-border',
    borderStrong: '--nd-border-strong',
    text: '--nd-text',
    textSecondary: '--nd-text-secondary',
    textMuted: '--nd-text-muted',
    accent: '--nd-accent',
    accentHover: '--nd-accent-hover',
    accentContrast: '--nd-accent-contrast',
    selection: '--nd-selection',
    codeBg: '--nd-code-bg',
    codeBorder: '--nd-code-border',
    inlineCode: '--nd-inline-code',
    danger: '--nd-danger',
    warning: '--nd-warning',
    success: '--nd-success',
    shadow: '--nd-shadow',
    scrollbar: '--nd-scrollbar',
    synKeyword: '--nd-syn-keyword',
    synString: '--nd-syn-string',
    synNumber: '--nd-syn-number',
    synComment: '--nd-syn-comment',
    synFunction: '--nd-syn-function',
    synVariable: '--nd-syn-variable',
    synOperator: '--nd-syn-operator',
    synType: '--nd-syn-type',
  }

  return Object.fromEntries(
    (Object.keys(mapping) as (keyof ThemeTokens)[]).map((key) => [mapping[key], tokens[key]]),
  )
}
