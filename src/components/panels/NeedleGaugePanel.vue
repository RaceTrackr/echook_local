<!--
  @file components/panels/NeedleGaugePanel.vue
  @brief Speedometer-style needle gauge. Threshold zones colour the track; needle sweeps to current value.
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

// Same geometry as GaugePanel for visual consistency
const CX        = 100
const CY        = 105
const R         = 72
const START_DEG = 234   // clock degrees: 0 = 12 o'clock, clockwise
const SWEEP_DEG = 252

// Convert clock-degrees to SVG Cartesian coords (0 = top, clockwise)
const clockXY = (deg, r = R) => {
  const rad = (deg - 90) * (Math.PI / 180)
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

const arcSegPath = (startDeg, sweepDeg, r = R) => {
  if (sweepDeg <= 0) return ''
  const clamped = Math.min(sweepDeg, 359.9)
  const s = clockXY(startDeg, r)
  const e = clockXY(startDeg + clamped, r)
  const large = clamped > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

const min = computed(() => props.panel.min ?? 0)
const max = computed(() => props.panel.max ?? 100)

const pct = computed(() => {
  if (props.value === null || props.value === undefined) return 0
  return Math.max(0, Math.min(1, (Number(props.value) - min.value) / (max.value - min.value)))
})

// Needle angle in clock-degrees (tip at 12 o'clock = 0° before rotation)
const needleDeg = computed(() => START_DEG + pct.value * SWEEP_DEG)

const color    = computed(() => getThresholdColor(props.value, props.panel.thresholds, mode.value))
const fmtValue = computed(() => formatValue(props.panel.key, props.value))
const unit     = computed(() => props.panel.unit || getUnit(props.panel.key) || '')

// Threshold zone arcs painted on the track background
const zones = computed(() => {
  const thresholds = props.panel.thresholds ?? []
  const active = thresholds
    .slice(1)
    .filter(t => t.value !== null && t.value !== undefined)
    .sort((a, b) => a.value - b.value)

  if (!active.length) return []

  const valToAngle = (v) =>
    START_DEG + Math.max(0, Math.min(1, (v - min.value) / (max.value - min.value))) * SWEEP_DEG

  const segments = []
  let prevDeg   = START_DEG
  let prevColor = thresholds[0]?.color ?? 'adaptive'

  for (const t of active) {
    const deg = Math.max(prevDeg, valToAngle(t.value))
    if (deg > prevDeg) {
      segments.push({
        path:  arcSegPath(prevDeg, deg - prevDeg),
        color: prevColor === 'adaptive' ? (isLight.value ? '#1e293b' : '#e2e8f0') : prevColor,
      })
    }
    prevDeg   = deg
    prevColor = t.color
  }

  const endDeg = START_DEG + SWEEP_DEG
  if (prevDeg < endDeg) {
    segments.push({
      path:  arcSegPath(prevDeg, endDeg - prevDeg),
      color: prevColor === 'adaptive' ? (isLight.value ? '#1e293b' : '#e2e8f0') : prevColor,
    })
  }
  return segments
})

// Tick marks drawn inside the arc
const ticks = computed(() => {
  const result = []
  const COUNT = 8  // 8 intervals → 9 marks
  for (let i = 0; i <= COUNT; i++) {
    const deg   = START_DEG + (i / COUNT) * SWEEP_DEG
    const major = i % 2 === 0
    const r1    = R - (major ? 11 : 6)
    const r2    = R - 2
    const p1    = clockXY(deg, r1)
    const p2    = clockXY(deg, r2)
    result.push({ x1: p1.x.toFixed(2), y1: p1.y.toFixed(2),
                  x2: p2.x.toFixed(2), y2: p2.y.toFixed(2), major })
  }
  return result
})

const minPt = clockXY(START_DEG)
const maxPt = clockXY(START_DEG + SWEEP_DEG)
</script>

<template>
  <div class="flex flex-col items-center h-full overflow-hidden select-none">
    <p class="text-xs font-bold uppercase tracking-widest text-gray-500 text-center truncate w-full flex-shrink-0 pt-2 px-2">
      {{ panel.title || displayName }}
    </p>
    <svg viewBox="0 0 200 175" class="w-full flex-1" preserveAspectRatio="xMidYMid meet">

      <!-- Background track -->
      <path :d="arcSegPath(START_DEG, SWEEP_DEG)"
        fill="none" :stroke="isLight ? '#cbd5e1' : '#3f3f46'"
        stroke-width="13" stroke-linecap="round" />

      <!-- Threshold zone colouring -->
      <path v-for="(z, i) in zones" :key="i"
        :d="z.path" fill="none" :stroke="z.color"
        stroke-width="13" stroke-linecap="butt" opacity="0.5" />

      <!-- Tick marks (inside arc) -->
      <line v-for="(t, i) in ticks" :key="i"
        :x1="t.x1" :y1="t.y1" :x2="t.x2" :y2="t.y2"
        :stroke="isLight ? '#94a3b8' : '#71717a'"
        :stroke-width="t.major ? 1.5 : 1" stroke-linecap="round" />

      <!-- Needle: tip points at 12 o'clock before rotation -->
      <g :style="`transform: rotate(${needleDeg}deg);
                  transform-origin: ${CX}px ${CY}px;
                  transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1)`">
        <polygon
          :points="`${CX},${CY - 62} ${CX - 3},${CY + 12} ${CX + 3},${CY + 12}`"
          :fill="isStale ? (isLight ? '#94a3b8' : '#52525b') : color"
          style="transition: fill 0.3s" />
        <!-- Counterweight stub -->
        <polygon
          :points="`${CX},${CY + 18} ${CX - 4},${CY + 12} ${CX + 4},${CY + 12}`"
          :fill="isLight ? '#475569' : '#71717a'" />
      </g>

      <!-- Centre hub -->
      <circle :cx="CX" :cy="CY" r="8"
        :fill="isLight ? '#f1f5f9' : '#27272a'"
        :stroke="isLight ? '#94a3b8' : '#71717a'"
        stroke-width="2" />
      <circle :cx="CX" :cy="CY" r="3"
        :fill="isLight ? '#64748b' : '#a1a1aa'" />

      <!-- Value -->
      <text :x="CX" :y="CY - 10" text-anchor="middle" dominant-baseline="middle"
        font-weight="700" font-size="26"
        :fill="isStale ? (isLight ? '#94a3b8' : '#52525b') : color"
        style="transition: fill 0.3s">
        {{ fmtValue }}
      </text>

      <!-- Unit (above value to avoid needle overlap) -->
      <text v-if="unit" :x="CX" :y="CY - 28" text-anchor="middle"
        font-size="10" :fill="isLight ? '#64748b' : '#71717a'">
        {{ unit }}
      </text>

      <!-- Min / max labels -->
      <text :x="minPt.x - 6" :y="minPt.y + 14" text-anchor="middle"
        font-size="10" :fill="isLight ? '#94a3b8' : '#52525b'">{{ min }}</text>
      <text :x="maxPt.x + 6" :y="maxPt.y + 14" text-anchor="middle"
        font-size="10" :fill="isLight ? '#94a3b8' : '#52525b'">{{ max }}</text>

    </svg>
  </div>
</template>
