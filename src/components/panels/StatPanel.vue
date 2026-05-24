<!--
  @file components/panels/StatPanel.vue
  @brief Large single-value display panel, colour driven by thresholds.
-->
<script setup>
import { computed } from 'vue'
import { useFormatValue } from '../../composables/useFormatValue'
import { getUnit } from '../../utils/formatting'
import { getThresholdColor } from '../../composables/useThresholdColor'
import { useTheme } from '../../composables/useTheme'
import { useTelemetryStore } from '../../stores/telemetry'

const props = defineProps({
  panel:       { type: Object,              required: true },
  value:       { type: [Number, String],    default: null  },
  displayName: { type: String,              default: ''    },
  isStale:     { type: Boolean,             default: false },
})

const { mode } = useTheme()
const telemetry = useTelemetryStore()

const color    = computed(() => getThresholdColor(props.value, props.panel.thresholds, mode.value))
const fmt = useFormatValue()
const fmtValue = computed(() => fmt(props.panel.key, props.value))
const unit     = computed(() => props.panel.unit || getUnit(props.panel.key) || '')

// Sparkline — last 100 points normalised to a 0 0 100 100 SVG viewBox
const sparklinePath = computed(() => {
  if (!props.panel.sparkline) return null
  const history = telemetry.displayHistory
  if (!history?.length) return null

  const recent = history.slice(-100)
  const vals = recent
    .map(pt => pt[props.panel.key])
    .filter(v => v != null && !isNaN(Number(v)))
    .map(Number)

  if (vals.length < 2) return null

  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1

  const pts = vals.map((v, i) => ({
    x: (i / (vals.length - 1)) * 100,
    y: 100 - ((v - min) / range) * 85, // leave 15% headroom at top
  }))

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
  // Close the fill area down to the bottom corners
  const fill = `${line} L100,100 L0,100 Z`

  return { line, fill }
})
</script>

<template>
  <div class="flex flex-col items-center h-full w-full overflow-hidden px-2 select-none relative"
    style="container-type: size">

    <!-- Sparkline background -->
    <svg v-if="sparklinePath && !isStale"
      class="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient :id="`sg-${panel.id}`" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.20" />
          <stop offset="100%" :stop-color="color" stop-opacity="0.02" />
        </linearGradient>
      </defs>
      <path :d="sparklinePath.fill" :fill="`url(#sg-${panel.id})`" />
      <path :d="sparklinePath.line" :stroke="color" stroke-width="1.5"
        stroke-opacity="0.5" fill="none" vector-effect="non-scaling-stroke" />
    </svg>

    <p class="text-xs font-bold uppercase tracking-widest text-gray-500 text-center truncate w-full flex-shrink-0 pt-2 relative">
      {{ panel.title || displayName }}
    </p>
    <div class="flex-1 flex items-center justify-center gap-1 min-w-0 w-full overflow-hidden relative">
      <span
        class="font-bold tabular-nums leading-none transition-colors duration-300 text-center"
        :class="isStale ? 'text-gray-600' : ''"
        :style="isStale ? { fontSize: 'clamp(0.75rem, min(14cqh, 14cqw), 4.5rem)' } : { color, fontSize: 'clamp(0.75rem, min(14cqh, 14cqw), 4.5rem)' }">
        {{ fmtValue }}
      </span>
      <span v-if="unit" class="text-gray-500 font-medium flex-shrink-0"
        :style="{ fontSize: 'clamp(0.6rem, min(4cqh, 4cqw), 1rem)' }">{{ unit }}</span>
    </div>
  </div>
</template>
