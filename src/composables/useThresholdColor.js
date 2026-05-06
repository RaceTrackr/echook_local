/**
 * @file composables/useThresholdColor.js
 * @brief Resolves the active colour from a panel's threshold configuration.
 *
 * The special value 'adaptive' resolves to white (#ffffff) in dark mode
 * and black (#000000) in light mode.
 *
 * @param {number|string|null} value       Current data value
 * @param {Array}              thresholds  [{ value: number|null, color: string }]
 * @param {string}             mode        'dark' | 'light'
 * @returns {string} Hex colour string
 */
export function getThresholdColor(value, thresholds, mode = 'dark') {
  if (!thresholds?.length) return mode === 'light' ? '#1e293b' : '#ffffff'

  const resolveColor = (c) =>
    c === 'adaptive' ? (mode === 'light' ? '#1e293b' : '#ffffff') : c

  // Base = threshold with no value trigger
  const base  = thresholds.find(t => t.value === null || t.value === undefined || t.value === '')
  let   color = base ? resolveColor(base.color) : (mode === 'light' ? '#1e293b' : '#ffffff')

  if (value === null || value === undefined || value === '') return color
  const v = Number(value)
  if (isNaN(v)) return color

  // Apply value-based thresholds in ascending order
  const active = thresholds
    .filter(t => t.value !== null && t.value !== undefined && t.value !== '')
    .sort((a, b) => Number(a.value) - Number(b.value))

  for (const t of active) {
    if (v >= Number(t.value)) color = resolveColor(t.color)
  }

  return color
}
