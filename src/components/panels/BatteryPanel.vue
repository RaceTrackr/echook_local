<!--
  @file components/panels/BatteryPanel.vue
  @brief Battery health panel: SoC % and predicted time to empty.
  @description
    Lead-acid 24V pack (2x 12V in series), 25Ah real-world capacity.
    SoC uses coulomb counting from ampH (resets each race with fresh batteries).
    Time to empty uses a rolling average of the last 20 current readings.
-->
<script setup>
import { computed } from 'vue'
import { useTelemetryStore } from '../../stores/telemetry'
import { useTheme } from '../../composables/useTheme'

const props = defineProps({
  panel:   { type: Object,  required: true },
  isStale: { type: Boolean, default: false },
})

const telemetry = useTelemetryStore()
const { mode } = useTheme()

const CAPACITY_AH = computed(() => Number(props.panel.capacityAh) || 25)

const ampH = computed(() => {
  const v = telemetry.displayLiveData?.ampH
  return v != null && !isNaN(Number(v)) ? Number(v) : null
})

const soc = computed(() => {
  if (ampH.value === null) return null
  return Math.max(0, Math.min(100, ((CAPACITY_AH.value - ampH.value) / CAPACITY_AH.value) * 100))
})

const ahRemaining = computed(() => {
  if (ampH.value === null) return null
  return Math.max(0, CAPACITY_AH.value - ampH.value)
})

// Rolling average over last 20 history points for a stable time-to-empty
const avgCurrent = computed(() => {
  const history = telemetry.displayHistory
  if (history?.length) {
    const recent = history.slice(-20)
    const vals = recent.map(pt => pt.current).filter(v => v != null && !isNaN(Number(v))).map(Number)
    if (vals.length) return vals.reduce((a, b) => a + b, 0) / vals.length
  }
  const live = telemetry.displayLiveData?.current
  return live != null && !isNaN(Number(live)) ? Number(live) : null
})

// Hours remaining = Ah remaining / avg current draw
const timeToEmpty = computed(() => {
  if (ahRemaining.value === null || !avgCurrent.value || avgCurrent.value <= 0) return null
  const hours = ahRemaining.value / avgCurrent.value
  return isFinite(hours) && hours < 100 ? hours : null
})

const formatTime = (hours) => {
  if (hours === null) return '-'
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`
}

const socColor = computed(() => {
  if (props.isStale || soc.value === null) return '#6b7280'
  if (soc.value > 50) return '#10b981'
  if (soc.value > 25) return '#f59e0b'
  return '#ef4444'
})

const isLight = computed(() => mode.value === 'light')
</script>

<template>
  <div class="flex flex-col h-full w-full overflow-hidden select-none"
    style="container-type: size">

    <!-- Title -->
    <p class="text-xs font-bold uppercase tracking-widest text-center flex-shrink-0 px-2 pt-2"
      :class="isLight ? 'text-gray-500' : 'text-gray-500'">
      {{ panel.title || 'Battery' }}
    </p>

    <!-- SoC -->
    <div class="flex-1 flex flex-col items-center justify-center min-h-0 px-2 gap-0.5">
      <div class="flex items-baseline gap-1 justify-center w-full overflow-hidden">
        <span
          class="font-bold font-mono tabular-nums leading-none transition-colors duration-300"
          :style="{ color: socColor, fontSize: 'clamp(1.5rem, 14cqh, 4.5rem)' }">
          {{ soc !== null ? Math.round(soc) : '-' }}
        </span>
        <span class="font-semibold flex-shrink-0 transition-colors duration-300"
          :style="{ color: socColor, fontSize: 'clamp(0.75rem, 5cqh, 1.5rem)' }">
          %
        </span>
      </div>

      <!-- Ah used / remaining -->
      <p v-if="ampH !== null"
        class="text-center text-gray-500 leading-none"
        :style="{ fontSize: 'clamp(0.6rem, 3cqh, 0.85rem)' }">
        {{ ampH.toFixed(1) }} Ah used · {{ ahRemaining.toFixed(1) }} Ah left
      </p>
    </div>

    <!-- Divider -->
    <div class="mx-3 border-t border-neutral-700/50 flex-shrink-0" />

    <!-- Time to empty -->
    <div class="flex items-center justify-center gap-1.5 flex-shrink-0 px-2 py-2">
      <svg class="flex-shrink-0 text-gray-500" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        :style="{ width: 'clamp(0.75rem, 4cqh, 1.25rem)', height: 'clamp(0.75rem, 4cqh, 1.25rem)' }">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span class="font-mono font-semibold text-gray-300 tabular-nums"
        :style="{ fontSize: 'clamp(0.7rem, 4cqh, 1.1rem)' }">
        {{ formatTime(timeToEmpty) }}
      </span>
      <span class="text-gray-600"
        :style="{ fontSize: 'clamp(0.6rem, 3cqh, 0.8rem)' }">
        remaining
      </span>
    </div>

  </div>
</template>
