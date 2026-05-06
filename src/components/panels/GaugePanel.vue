<!--
  @file components/panels/GaugePanel.vue
  @brief 240° SVG arc gauge. Colour driven by per-panel thresholds.
-->
<script setup>
import { computed } from 'vue'
import { formatValue, getUnit } from '../../utils/formatting'
import { getThresholdColor } from '../../composables/useThresholdColor'
import { useTheme } from '../../composables/useTheme'

const props = defineProps({
  panel:       { type: Object,           required: true },
  value:       { type: [Number, String], default: null  },
  displayName: { type: String,           default: ''    },
  isStale:     { type: Boolean,          default: false },
})

const { mode } = useTheme()
const isLight = computed(() => mode.value === 'light')

// ── Gauge geometry ────────────────────────────────────────────────────────────
// Angles measured clockwise from 12 o'clock (0 = top, 90 = right, 180 = bottom)
const CX          = 100
const CY          = 105   // centre, shifted down to give head-room above arc
const R           = 72
const START_DEG   = 234   // ~7:45 o'clock
const SWEEP_DEG   = 252   // 252° sweep → ends at ~4:15 o'clock

/**
 * Convert clock-degrees to SVG Cartesian coordinates.
 * @param {number} deg  0 = 12 o'clock, 90 = 3 o'clock, etc.
 */
const clockXY = (deg) => {
  const rad = (deg - 90) * (Math.PI / 180)
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
}

/**
 * Build an SVG arc path string.
 * @param {number} startDeg  Start angle (clock degrees)
 * @param {number} sweepDeg  Sweep angle (always clockwise; 0 = nothing drawn)
 */
const arcPath = (startDeg, sweepDeg) => {
  if (sweepDeg <= 0) return ''
  const clamped = Math.min(sweepDeg, 359.9)
  const s = clockXY(startDeg)
  const e = clockXY(startDeg + clamped)
  const large = clamped > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

// ── Derived values ────────────────────────────────────────────────────────────

const min = computed(() => props.panel.min ?? 0)
const max = computed(() => props.panel.max ?? 100)

const pct = computed(() => {
  if (props.value === null || props.value === undefined) return 0
  return Math.max(0, Math.min(1, (Number(props.value) - min.value) / (max.value - min.value)))
})

const color    = computed(() => getThresholdColor(props.value, props.panel.thresholds, mode.value))
const fmtValue = computed(() => formatValue(props.panel.key, props.value))
const unit     = computed(() => props.panel.unit || getUnit(props.panel.key) || '')

const trackPath = arcPath(START_DEG, SWEEP_DEG)
const valuePath = computed(() => arcPath(START_DEG, SWEEP_DEG * pct.value))

// Label positions near arc endpoints
const minPt = clockXY(START_DEG)
const maxPt = clockXY(START_DEG + SWEEP_DEG)
</script>

<template>
  <div class="flex flex-col items-center h-full overflow-hidden select-none">
    <!-- SVG gauge fills flex space -->
    <svg viewBox="0 0 200 175" class="w-full flex-1" preserveAspectRatio="xMidYMid meet">
      <!-- Background track -->
      <path :d="trackPath" fill="none"
        :stroke="isLight ? '#cbd5e1' : '#3f3f46'"
        stroke-width="13" stroke-linecap="round" />

      <!-- Value arc -->
      <path v-if="pct > 0" :d="valuePath" fill="none"
        :stroke="isStale ? (isLight ? '#94a3b8' : '#52525b') : color"
        stroke-width="13" stroke-linecap="round"
        style="transition: stroke 0.3s" />

      <!-- Centre value -->
      <text :x="CX" :y="CY - 10" text-anchor="middle" dominant-baseline="middle"
        font-weight="700" font-size="26"
        :fill="isStale ? (isLight ? '#94a3b8' : '#52525b') : color"
        style="transition: fill 0.3s">
        {{ fmtValue }}
      </text>

      <!-- Unit -->
      <text v-if="unit" :x="CX" :y="CY + 14" text-anchor="middle"
        font-size="12" :fill="isLight ? '#64748b' : '#71717a'">
        {{ unit }}
      </text>

      <!-- Min label -->
      <text :x="minPt.x - 6" :y="minPt.y + 14" text-anchor="middle"
        font-size="10" :fill="isLight ? '#94a3b8' : '#52525b'">
        {{ min }}
      </text>

      <!-- Max label -->
      <text :x="maxPt.x + 6" :y="maxPt.y + 14" text-anchor="middle"
        font-size="10" :fill="isLight ? '#94a3b8' : '#52525b'">
        {{ max }}
      </text>
    </svg>

    <!-- Panel title below gauge -->
    <p class="text-xs text-gray-500 font-medium truncate max-w-full px-2 pb-1 flex-shrink-0">
      {{ panel.title || displayName }}
    </p>
  </div>
</template>
