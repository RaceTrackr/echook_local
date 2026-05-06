/**
 * @file composables/useTheme.js
 * @brief Reactive theme system — dark/light mode, accent colour, and body font.
 *
 * Strategy:
 *  - Sets `data-theme` attribute on <html> for mode switching.
 *  - Injects a <style id="app-theme-overrides"> tag for accent + font overrides.
 *  - Injects a <link id="app-font-link"> tag for the selected Google Font.
 *  - Persists to localStorage so the theme survives page reloads.
 *  - Exported as a singleton so any component shares the same state.
 */

import { ref } from 'vue'

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY    = 'app-theme-v2'
const DEFAULT_ACCENT = '#cb1557'
const DEFAULT_FONT   = 'formula'

export const PRESET_ACCENTS = [
  { name: 'Adaptive', value: 'adaptive' },
  { name: 'Rose',    value: '#cb1557' },
  { name: 'Blue',    value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber',   value: '#f59e0b' },
  { name: 'Violet',  value: '#8b5cf6' },
  { name: 'Orange',  value: '#f97316' },
  { name: 'Cyan',    value: '#06b6d4' },
  { name: 'Lime',    value: '#84cc16' },
  { name: 'Red',     value: '#ef4444' },
  { name: 'Pink',    value: '#ec4899' },
]

/** Resolve 'adaptive' to the correct hex for the current mode. */
export function resolveAccent(value, currentMode) {
  if (value === 'adaptive') return currentMode === 'light' ? '#000000' : '#ffffff'
  return value
}

export const FONT_OPTIONS = [
  { name: 'System Default', value: 'system',       family: 'system-ui, -apple-system, sans-serif',  google: null },
  { name: 'Formula',        value: 'formula',       family: "'Formula', sans-serif",                 google: null },
  { name: 'Inter',          value: 'inter',         family: "'Inter', sans-serif",                   google: 'Inter:wght@300;400;500;600;700' },
  { name: 'Roboto',         value: 'roboto',        family: "'Roboto', sans-serif",                  google: 'Roboto:wght@300;400;500;700' },
  { name: 'Space Grotesk',  value: 'space-grotesk', family: "'Space Grotesk', sans-serif",           google: 'Space+Grotesk:wght@300;400;500;600;700' },
  { name: 'Rajdhani',       value: 'rajdhani',      family: "'Rajdhani', sans-serif",                google: 'Rajdhani:wght@300;400;500;600;700' },
  { name: 'Nunito',         value: 'nunito',        family: "'Nunito', sans-serif",                  google: 'Nunito:wght@300;400;500;600;700' },
  { name: 'Oxanium',        value: 'oxanium',       family: "'Oxanium', sans-serif",                 google: 'Oxanium:wght@300;400;500;600;700' },
  { name: 'JetBrains Mono', value: 'jetbrains',     family: "'JetBrains Mono', monospace",           google: 'JetBrains+Mono:wght@300;400;500;700' },
  { name: 'Custom',         value: 'custom',        family: "'AppCustomFont', sans-serif",           google: null },
]

// ─── Singleton state ──────────────────────────────────────────────────────────

const mode           = ref('dark')
const accent         = ref(DEFAULT_ACCENT)
const font           = ref(DEFAULT_FONT)
const customFont      = ref(null)   // base64 data URL of uploaded UI font
const customFontName  = ref(null)   // original filename for display
const displayFont     = ref(null)   // base64 data URL of uploaded team-name display font
const displayFontName = ref(null)   // original filename for display

try {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  if (stored.mode   && ['dark', 'light'].includes(stored.mode))    mode.value   = stored.mode
  if (stored.accent && (stored.accent === 'adaptive' || /^#[0-9a-fA-F]{6}$/.test(stored.accent))) accent.value = stored.accent
  if (stored.font   && FONT_OPTIONS.some(f => f.value === stored.font)) font.value = stored.font
  if (stored.customFont)      customFont.value      = stored.customFont
  if (stored.customFontName)  customFontName.value  = stored.customFontName
  if (stored.displayFont)     displayFont.value     = stored.displayFont
  if (stored.displayFontName) displayFontName.value = stored.displayFontName
} catch { /* ignore */ }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToComponents(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : '203 21 87'
}

// ─── CSS builders ─────────────────────────────────────────────────────────────

function buildAccentCSS(hex) {
  const rgb = hexToComponents(hex)
  // Ensure readable contrast on bg-primary buttons (white is too light, black too dark)
  const textOnAccent = hex === '#ffffff' ? '#000000' : '#ffffff'
  return /* css */`
    /* ── Accent colour overrides ─────────────────────────── */
    :root { --accent: ${hex}; --accent-rgb: ${rgb}; }

    .text-primary,
    .group:hover .group-hover\\:text-primary { color: ${hex} !important; }

    .bg-primary  { background-color: ${hex} !important; }

    .border-primary              { border-color: ${hex} !important; }
    .border-primary\\/50         { border-color: rgb(${rgb} / 0.5) !important; }

    .ring-primary                { --tw-ring-color: ${hex} !important; }
    .focus\\:ring-primary:focus  { --tw-ring-color: ${hex} !important; }
    .focus\\:border-primary:focus { border-color: ${hex} !important; }

    .bg-primary\\/10 { background-color: rgb(${rgb} / 0.1) !important; }
    .bg-primary\\/20 { background-color: rgb(${rgb} / 0.2) !important; }
    .bg-primary\\/30 { background-color: rgb(${rgb} / 0.3) !important; }

    .hover\\:bg-primary\\/90:hover { background-color: rgb(${rgb} / 0.9) !important; }

    .bg-primary { color: ${textOnAccent}; }

    .bg-primary.rounded-r-full,
    .bg-primary.rounded-t-full { background-color: ${hex} !important; }
  `
}

function buildLightCSS() {
  return /* css */`
    /* ── Light mode overrides ────────────────────────────── */

    [data-theme="light"] .bg-neutral-900             { background-color: #f1f5f9 !important; }
    [data-theme="light"] .bg-neutral-800             { background-color: #ffffff !important; }
    [data-theme="light"] .bg-neutral-700             { background-color: #e2e8f0 !important; }
    [data-theme="light"] .bg-neutral-800\\/50        { background-color: rgba(255,255,255,.5) !important; }
    [data-theme="light"] .bg-neutral-800\\/60        { background-color: rgba(255,255,255,.6) !important; }
    [data-theme="light"] .bg-neutral-900\\/30        { background-color: rgba(241,245,249,.5) !important; }
    [data-theme="light"] .bg-neutral-900\\/40        { background-color: rgba(241,245,249,.6) !important; }
    [data-theme="light"] .bg-neutral-900\\/50        { background-color: rgba(241,245,249,.5) !important; }
    [data-theme="light"] .bg-neutral-900\\/90        { background-color: rgba(241,245,249,.9) !important; }
    [data-theme="light"] .bg-neutral-900\\/95        { background-color: rgba(241,245,249,.95) !important; }
    [data-theme="light"] .bg-neutral-700\\/40        { background-color: rgba(226,232,240,.4) !important; }
    [data-theme="light"] .bg-neutral-700\\/50        { background-color: rgba(226,232,240,.5) !important; }

    [data-theme="light"] .border-neutral-900   { border-color: #cbd5e1 !important; }
    [data-theme="light"] .border-neutral-800   { border-color: #e2e8f0 !important; }
    [data-theme="light"] .border-neutral-700   { border-color: #cbd5e1 !important; }
    [data-theme="light"] .border-neutral-700\\/60 { border-color: rgba(203,213,225,.6) !important; }
    [data-theme="light"] .border-neutral-600   { border-color: #94a3b8 !important; }

    [data-theme="light"] .text-white                  { color: #0f172a !important; }
    [data-theme="light"] .text-gray-100               { color: #1e293b !important; }
    [data-theme="light"] .text-gray-200               { color: #334155 !important; }
    [data-theme="light"] .text-gray-300               { color: #475569 !important; }
    [data-theme="light"] .text-gray-400               { color: #64748b !important; }
    [data-theme="light"] .text-gray-500               { color: #94a3b8 !important; }
    [data-theme="light"] .text-gray-600               { color: #cbd5e1 !important; }
    [data-theme="light"] .hover\\:text-white:hover    { color: #0f172a !important; }
    [data-theme="light"] .hover\\:text-gray-300:hover { color: #475569 !important; }

    [data-theme="light"] .bg-primary .text-white,
    [data-theme="light"] button.bg-primary,
    [data-theme="light"] a.bg-primary,
    [data-theme="light"] .bg-green-900 .text-green-200,
    [data-theme="light"] .bg-red-900\\/90 .text-red-100 { color: #ffffff !important; }

    [data-theme="light"] .hover\\:bg-neutral-800:hover     { background-color: #f8fafc !important; }
    [data-theme="light"] .hover\\:bg-neutral-700:hover     { background-color: #e2e8f0 !important; }
    [data-theme="light"] .hover\\:bg-neutral-700\\/50:hover { background-color: rgba(226,232,240,.5) !important; }

    [data-theme="light"] input,
    [data-theme="light"] select,
    [data-theme="light"] textarea {
      background-color: #f8fafc !important;
      color: #0f172a !important;
      border-color: #e2e8f0 !important;
    }
    [data-theme="light"] input::placeholder { color: #94a3b8 !important; }

    [data-theme="light"] .bg-red-900\\/50  { background-color: rgba(254,226,226,.8) !important; }
    [data-theme="light"] .border-red-500  { border-color: #ef4444 !important; }
    [data-theme="light"] .text-red-200    { color: #b91c1c !important; }
    [data-theme="light"] .text-red-500    { color: #dc2626 !important; }

    [data-theme="light"] .bg-red-900\\/90 { background-color: rgba(153,27,27,.9) !important; }

    [data-theme="light"] .shadow-2xl {
      box-shadow: 0 25px 50px -12px rgba(0,0,0,.12) !important;
    }

    [data-theme="light"] .bg-green-900 { background-color: #dcfce7 !important; }
    [data-theme="light"] .text-green-200 { color: #166534 !important; }

    [data-theme="light"] .divide-neutral-700 > * + * { border-color: #e2e8f0 !important; }

    [data-theme="light"] [data-zr-dom-id] { background-color: transparent !important; }
  `
}

// ─── Apply functions ──────────────────────────────────────────────────────────

let styleEl         = null
let fontLinkEl      = null
let customFontEl    = null
let displayFontEl   = null

function injectCustomFontFace(dataUrl) {
  if (!customFontEl) {
    customFontEl = document.createElement('style')
    customFontEl.id = 'app-custom-font'
    document.head.appendChild(customFontEl)
  }
  customFontEl.textContent = dataUrl
    ? `@font-face { font-family: 'AppCustomFont'; src: url('${dataUrl}'); font-weight: 100 900; font-style: normal; }`
    : ''
}

// Uploads use 'AppDisplayFontCustom' — a separate name so the built-in porscha
// ('AppDisplayFont') acts as an automatic fallback when no upload is present.
function injectDisplayFontFace(dataUrl) {
  if (!displayFontEl) {
    displayFontEl = document.createElement('style')
    displayFontEl.id = 'app-display-font-custom'
    document.head.appendChild(displayFontEl)
  }
  displayFontEl.textContent = dataUrl
    ? `@font-face { font-family: 'AppDisplayFontCustom'; src: url('${dataUrl}'); font-weight: 100 900; font-style: normal; }`
    : ''
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', mode.value)

  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'app-theme-overrides'
    document.head.appendChild(styleEl)
  }

  const opt = FONT_OPTIONS.find(f => f.value === font.value) || FONT_OPTIONS[0]
  styleEl.textContent = [
    buildAccentCSS(resolveAccent(accent.value, mode.value)),
    mode.value === 'light' ? buildLightCSS() : '',
    `html, body { font-family: ${opt.family} !important; }`,
    // Custom upload ('AppDisplayFontCustom') takes priority; built-in porscha ('AppDisplayFont') is the fallback
    `.app-display-font { font-family: 'AppDisplayFontCustom', 'AppDisplayFont', sans-serif !important; }`,
  ].join('\n')

  // Inject custom @font-face rules when font files have been uploaded
  injectCustomFontFace(font.value === 'custom' ? customFont.value : null)
  injectDisplayFontFace(displayFont.value)

  // Reinforce on <html> inline style as a belt-and-braces measure
  if (font.value === 'system') {
    document.documentElement.style.removeProperty('font-family')
  } else {
    document.documentElement.style.fontFamily = opt.family
  }

  // Inject / update Google Fonts link for the selected font
  if (opt.google) {
    if (!fontLinkEl) {
      fontLinkEl = document.createElement('link')
      fontLinkEl.rel = 'stylesheet'
      fontLinkEl.id  = 'app-font-link'
      document.head.appendChild(fontLinkEl)
    }
    fontLinkEl.href = `https://fonts.googleapis.com/css2?family=${opt.google}&display=swap`
  } else if (fontLinkEl) {
    fontLinkEl.href = ''
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode:            mode.value,
      accent:          accent.value,
      font:            font.value,
      customFont:      customFont.value,
      customFontName:  customFontName.value,
      displayFont:     displayFont.value,
      displayFontName: displayFontName.value,
    }))
  } catch { /* quota errors — font data URL may be large */ }
}

applyTheme()

// ─── Public API ───────────────────────────────────────────────────────────────

export function useTheme() {
  const setCustomFont = (dataUrl, name) => {
    customFont.value     = dataUrl
    customFontName.value = name
    font.value           = 'custom'
    applyTheme()
  }

  const clearCustomFont = () => {
    customFont.value     = null
    customFontName.value = null
    font.value           = DEFAULT_FONT
    applyTheme()
  }

  const setDisplayFont = (dataUrl, name) => {
    displayFont.value     = dataUrl
    displayFontName.value = name
    applyTheme()
  }

  const clearDisplayFont = () => {
    displayFont.value     = null
    displayFontName.value = null
    applyTheme()
  }

  return {
    mode,
    accent,
    font,
    customFont,
    customFontName,
    displayFont,
    displayFontName,
    presets:          PRESET_ACCENTS,
    fontOptions:      FONT_OPTIONS,
    toggleMode:       () => { mode.value = mode.value === 'dark' ? 'light' : 'dark'; applyTheme() },
    setMode:          (m)   => { mode.value   = m;   applyTheme() },
    setAccent:        (hex) => { accent.value = hex; applyTheme() },
    setFont:          (val) => { font.value   = val; applyTheme() },
    setCustomFont,
    clearCustomFont,
    setDisplayFont,
    clearDisplayFont,
  }
}
