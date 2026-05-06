<!--
  @file components/panels/LapChartPanel.vue
  @brief Per-lap bar chart panel. Shows one bar per lap for a configurable metric.
-->
<script setup>
import { computed } from 'vue'
import { useTelemetryStore } from '../../stores/telemetry'
import { useTheme, resolveAccent } from '../../composables/useTheme'
import { LAP_METRICS } from '../../utils/lapMetrics'

const props = defineProps({
  panel:   { type: Object,  required: true },
  isStale: { type: Boolean, default: false },
})

const telemetry = useTelemetryStore()
const { mode, accent } = useTheme()

const metricKey = computed(() => props.panel.lapMetric ?? 'LL_Time')
const metricDef = computed(() => LAP_METRICS.find(m => m.key === metricKey.value) ?? LAP_METRICS[0])

// Use the most recent race's laps
const laps = computed(() => {
  const raceList = Object.values(telemetry.races).sort((a, b) => b.startTimeMs - a.startTimeMs)
  if (!raceList.length) return []
  const all = Object.values(raceList[0].laps)
    .sort((a, b) => a.lapNumber - b.lapNumber)
    .filter(l => l[metricKey.value] != null)
  const n = props.panel.lapCount || 0
  return n > 0 ? all.slice(-n) : all
})

const values = computed(() => laps.value.map(l => l[metricKey.value]))

const minVal = computed(() => values.value.length ? Math.min(...values.value) : 0)
const maxVal = computed(() => values.value.length ? Math.max(...values.value) : 1)

// Best = lowest for dir -1, highest for dir 1, first for dir 0
const bestIdx = computed(() => {
  if (!values.value.length) return -1
  const dir = metricDef.value.dir
  if (dir === -1) return values.value.indexOf(minVal.value)
  if (dir ===  1) return values.value.indexOf(maxVal.value)
  return -1
})

const accentColor = computed(() => resolveAccent(accent.value, mode.value))

const formatValue = (val) => {
  if (val == null) return '-'
  if (metricKey.value === 'LL_Time') {
    const m = Math.floor(val / 60)
    const s = (val % 60).toFixed(1).padStart(4, '0')
    return `${m}:${s}`
  }
  return Number(val).toFixed(2)
}

// Bar heights: normalise so tallest bar = 100%
// Use a floor so small differences are still visible
const BAR_FLOOR = 0.15
const barHeights = computed(() => {
  const range = maxVal.value - minVal.value
  return values.value.map(v => {
    if (range === 0) return 1
    return BAR_FLOOR + (1 - BAR_FLOOR) * ((v - minVal.value) / range)
  })
})
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden select-none px-2 pt-2 pb-1">

    <!-- Title -->
    <p class="text-xs font-bold uppercase tracking-widest text-gray-500 text-center flex-shrink-0 mb-1">
      {{ panel.title || metricDef.label }}
    </p>

    <!-- Empty state -->
    <div v-if="!laps.length"
      class="flex-1 flex items-center justify-center text-xs text-gray-600 italic">
      No lap data
    </div>

    <!-- Bar chart -->
    <div v-else class="flex-1 flex flex-col min-h-0">

      <!-- Value labels row — fixed 14px height -->
      <div class="flex items-end gap-px flex-shrink-0" style="height: 14px">
        <div v-for="(lap, i) in laps" :key="lap.lapNumber"
          class="flex-1 min-w-0 flex justify-center overflow-hidden">
          <span class="text-[9px] leading-none font-mono tabular-nums text-gray-400 truncate">
            {{ formatValue(values[i]) }}
          </span>
        </div>
      </div>

      <!-- Bars row — flex-1 -->
      <div class="flex-1 flex items-end gap-px min-h-0">
        <div v-for="(lap, i) in laps" :key="lap.lapNumber"
          class="flex-1 min-w-0 h-full flex items-end">
          <div
            class="w-full rounded-t transition-all duration-500"
            :style="{
              height: (barHeights[i] * 100).toFixed(1) + '%',
              backgroundColor: i === bestIdx
                ? accentColor
                : (isStale ? '#404040' : '#525252'),
              opacity: isStale ? 0.5 : 1,
            }" />
        </div>
      </div>

      <!-- Lap number labels row — fixed 14px height -->
      <div class="flex items-start gap-px flex-shrink-0" style="height: 14px">
        <div v-for="(lap, i) in laps" :key="lap.lapNumber"
          class="flex-1 min-w-0 flex justify-center overflow-hidden">
          <span class="text-[9px] leading-none font-mono text-gray-500 truncate">
            {{ lap.lapNumber }}
          </span>
        </div>
      </div>

    </div>

  </div>
</template>
