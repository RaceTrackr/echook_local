<!--
  @file components/tabs/LapsTab.vue
  @brief Lap times and race session display tab.
-->
<script setup>
import { computed, ref } from 'vue'
import { useTelemetryStore } from '../../stores/telemetry'
import { useSettingsStore } from '../../stores/settings'
import { useAuthStore } from '../../stores/auth'
import { ChartBarIcon, ArrowPathIcon, ArrowDownTrayIcon, AdjustmentsHorizontalIcon } from '@heroicons/vue/24/outline'

const telemetry = useTelemetryStore()
const settings  = useSettingsStore()
const auth      = useAuthStore()

// ── Column definitions ────────────────────────────────────────────────────────
const speedUnit = computed(() => telemetry.unitSettings.speedUnit.toUpperCase())

const ALL_COLUMNS = computed(() => [
  { key: 'startTime',  label: 'Start',           format: 'time',    dir:  0 },
  { key: 'finishTime', label: 'Finish',           format: 'time',    dir:  0 },
  { key: 'LL_Time',    label: 'Lap Time',         format: 'laptime', dir: -1 },
  { key: 'LL_VA_min',  label: 'Min V Batt A',     format: 'number',  dir:  1 },
  { key: 'LL_VB_min',  label: 'Min V Batt B',     format: 'number',  dir:  1 },
  { key: 'LL_VA_avg',  label: 'Avg V Batt A',     format: 'number',  dir:  1 },
  { key: 'LL_VB_avg',  label: 'Avg V Batt B',     format: 'number',  dir:  1 },
  { key: 'LL_I',       label: 'Avg Amps',         format: 'number',  dir: -1 },
  { key: 'LL_I_max',   label: 'Max Amps',         format: 'number',  dir: -1 },
  { key: 'LL_RPM_min', label: 'Min RPM',          format: 'number',  dir:  0 },
  { key: 'LL_RPM',     label: 'Avg RPM',          format: 'number',  dir:  0 },
  { key: 'LL_Ah',      label: 'Ah Used',          format: 'number',  dir: -1 },
  { key: 'LL_Spd',     label: `Speed (${speedUnit.value})`, format: 'number', dir: 1 },
])

const visibleKeys = computed({
  get: () => settings.lapsVisibleCols ?? ALL_COLUMNS.value.map(c => c.key),
  set: (v) => { settings.lapsVisibleCols = v },
})

const visibleColumns = computed(() =>
  ALL_COLUMNS.value.filter(c => visibleKeys.value.includes(c.key))
)

const toggleCol = (key) => {
  const cur = visibleKeys.value
  visibleKeys.value = cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key]
}

// Keep column order stable (matches ALL_COLUMNS order regardless of toggle order)
const orderedVisibleColumns = computed(() =>
  ALL_COLUMNS.value.filter(c => visibleKeys.value.includes(c.key))
)

// ── Race data ─────────────────────────────────────────────────────────────────
const sortedRaces = computed(() => {
  const raceList = Object.values(telemetry.races).sort((a, b) => b.startTimeMs - a.startTimeMs)

  return raceList.map(race => {
    const lapList = Object.values(race.laps).sort((a, b) => a.lapNumber - b.lapNumber)

    // Min/max per column for background bars
    const stats = {}
    orderedVisibleColumns.value.forEach(col => {
      if (col.format === 'time') return
      let min = Infinity, max = -Infinity
      lapList.forEach(lap => {
        const val = lap[col.key]
        if (val != null && !isNaN(val)) {
          if (val < min) min = val
          if (val > max) max = val
        }
      })
      if (max === min) max = min + 1
      stats[col.key] = { min, max }
    })

    return { ...race, startTime: race.startTimeMs, sortedLaps: [...lapList].reverse(), stats }
  })
})

// ── Formatting ────────────────────────────────────────────────────────────────
const formatLapTime = (seconds) => {
  if (seconds == null || !isFinite(seconds)) return '-'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

const formatTimestamp = (ms) => {
  if (!ms || !Number.isFinite(ms)) return '-'
  return new Date(ms).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatDate = (isoStringOrMs) => {
  if (!isoStringOrMs) return 'Unknown Time'
  return new Date(isoStringOrMs).toLocaleString()
}

const formatCell = (col, value) => {
  if (value == null || (typeof value === 'number' && isNaN(value))) return '-'
  if (col.format === 'time')    return formatTimestamp(value)
  if (col.format === 'laptime') return formatLapTime(value)
  return typeof value === 'number' ? value.toFixed(2) : value
}

// ── Diff / comparison ─────────────────────────────────────────────────────────
const getDiff = (lap, sortedLaps, key, idx) => {
  const prev = sortedLaps[idx + 1]
  if (!prev) return null
  const a = lap[key], b = prev[key]
  if (a == null || b == null) return null
  return a - b
}

const getDiffColor = (col, diff) => {
  if (Math.abs(diff) < 0.001) return 'text-gray-500'
  const isGood = (diff * col.dir) > 0
  return isGood ? 'text-green-500' : 'text-red-500'
}

const formatDiff = (col, diff) => {
  if (diff == null) return null
  if (col.format === 'laptime') {
    const abs = Math.abs(diff)
    return (diff > 0 ? '+' : '-') + formatLapTime(abs)
  }
  return (diff > 0 ? '+' : '') + diff.toFixed(2)
}

// ── Background bar ────────────────────────────────────────────────────────────
const getBarPercent = (val, min, max) => {
  if (val == null) return 0
  const range = max - min
  if (range === 0) return 0
  return Math.min(100, Math.max(0, ((val - min) / range) * 100))
}

// ── History loading ───────────────────────────────────────────────────────────
const isLoadingHistory = ref(false)
async function loadExtra(minutes) {
  const carId = telemetry.viewingCar?.id || auth.user?.id || auth.user?._id
  if (!carId) return
  isLoadingHistory.value = true
  try { await telemetry.loadExtraHistory(carId, minutes) }
  finally { isLoadingHistory.value = false }
}

// ── CSV export ────────────────────────────────────────────────────────────────
import { exportHistoryAsCsv } from '../../utils/csvExport'

const downloadRaceCsv = (race) => {
  const startTime = race.startTimeMs
  const allStartTimes = Object.keys(telemetry.races).map(Number).sort((a, b) => a - b)
  const myIndex = allStartTimes.indexOf(startTime)
  const endTime = (myIndex !== -1 && myIndex < allStartTimes.length - 1)
    ? allStartTimes[myIndex + 1]
    : (telemetry.history[telemetry.history.length - 1]?.timestamp ?? Date.now())
  exportHistoryAsCsv(startTime, endTime, 'eChook', race.trackName)
}

// ── Graph navigation ──────────────────────────────────────────────────────────
const viewSessionOnGraph = (race) => {
  telemetry.requestChartZoom(race.startTime - 30000, (race.sortedLaps[0]?.finishTime ?? Date.now()) + 30000)
  if (!telemetry.isPaused) telemetry.togglePause()
  settings.activeTabId = 'graph'
}
const viewLapOnGraph = (lap) => {
  if (!lap.startTime || !lap.finishTime) return
  telemetry.requestChartZoom(lap.startTime - 10000, lap.finishTime + 10000)
  if (!telemetry.isPaused) telemetry.togglePause()
  settings.activeTabId = 'graph'
}

// ── Clear laps ────────────────────────────────────────────────────────────────
const confirmClear = ref(false)
const clearLaps = () => { telemetry.clearRaces(); confirmClear.value = false }

// ── Column picker ─────────────────────────────────────────────────────────────
const showColPicker = ref(false)
const colPickerRef  = ref(null)

const onOutsideClick = (e) => {
  if (colPickerRef.value && !colPickerRef.value.contains(e.target)) showColPicker.value = false
}
watch(showColPicker, (v) => {
  if (v) document.addEventListener('mousedown', onOutsideClick)
  else   document.removeEventListener('mousedown', onOutsideClick)
})
onUnmounted(() => document.removeEventListener('mousedown', onOutsideClick))

// ── Disclaimer ────────────────────────────────────────────────────────────────
import DisclaimerModal from '../ui/DisclaimerModal.vue'
import { onMounted, onUnmounted, watch } from 'vue'
const showDisclaimer = ref(false)
onMounted(() => { if (!settings.hideLapsDisclaimer) showDisclaimer.value = true })
const handleDisclaimerConfirm = (doNotShow) => {
  if (doNotShow) settings.hideLapsDisclaimer = true
  showDisclaimer.value = false
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">

    <!-- Toolbar -->
    <div class="flex items-center justify-between px-3 md:px-6 py-2 border-b border-neutral-800 flex-shrink-0 bg-neutral-900">
      <span class="text-xs text-gray-500 font-semibold uppercase tracking-wider">Laps</span>

      <div class="flex items-center gap-2">
        <!-- Clear laps confirmation -->
        <template v-if="confirmClear">
          <span class="text-xs text-gray-400">Clear all lap data?</span>
          <button @click="clearLaps"
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition">
            Yes, clear
          </button>
          <button @click="confirmClear = false"
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-neutral-800 border border-neutral-700 text-gray-400 hover:text-white transition">
            Cancel
          </button>
        </template>
        <button v-else @click="confirmClear = true"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border
                 bg-neutral-800 border-neutral-700 text-gray-400 hover:text-red-400 hover:border-red-700">
          Clear Laps
        </button>

        <div ref="colPickerRef" class="relative">
        <button @click="showColPicker = !showColPicker"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border"
          :class="showColPicker
            ? 'bg-primary/10 border-primary text-primary'
            : 'bg-neutral-800 border-neutral-700 text-gray-400 hover:text-white'">
          <AdjustmentsHorizontalIcon class="w-3.5 h-3.5" />
          Columns
        </button>

        <!-- Column picker dropdown -->
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
          <div v-if="showColPicker"
            class="absolute top-full right-0 mt-1 z-50 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl p-3 min-w-[220px]">
            <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Show / Hide Columns</p>
            <div class="space-y-1">
              <label v-for="col in ALL_COLUMNS" :key="col.key"
                class="flex items-center gap-2.5 px-2 py-1 rounded-lg cursor-pointer hover:bg-neutral-700 transition">
                <input type="checkbox"
                  :checked="visibleKeys.includes(col.key)"
                  @change="toggleCol(col.key)"
                  class="w-3.5 h-3.5 accent-primary rounded" />
                <span class="text-xs text-gray-300">{{ col.label }}</span>
              </label>
            </div>
          </div>
        </Transition>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-2 md:p-6 space-y-4 md:space-y-8">

      <!-- Empty state -->
      <div v-if="sortedRaces.length === 0"
        class="flex items-center justify-center h-full text-gray-500 italic text-sm">
        No lap data recorded yet.
      </div>

      <!-- Race sessions -->
      <div v-for="race in sortedRaces" :key="race.id" class="flex flex-col space-y-2 md:space-y-4">

        <!-- Race header -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between sticky top-0 bg-neutral-900 z-20 py-1 md:py-2 border-b border-neutral-800">
          <div class="flex items-center space-x-3">
            <h2 class="text-sm md:text-xl font-bold text-white tracking-tight flex items-center flex-wrap gap-2 leading-none">
              <span v-if="race.trackName" class="text-white">{{ race.trackName }}</span>
              <span class="text-primary font-mono text-xs md:text-base pt-0.5">{{ formatDate(race.startTime) }}</span>
            </h2>
            <button @click="downloadRaceCsv(race)"
              class="bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white p-1 rounded transition"
              title="Download Race CSV">
              <ArrowDownTrayIcon class="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <button @click="viewSessionOnGraph(race)"
              class="bg-neutral-800 hover:bg-neutral-700 text-gray-300 hover:text-white p-1 rounded transition"
              title="View Race on Graph">
              <ChartBarIcon class="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          <div class="text-xs md:text-sm text-gray-400 mt-1 md:mt-0">
            Laps: <span class="text-white font-mono font-bold">{{ race.sortedLaps.length }}</span>
          </div>
        </div>

        <!-- Lap table -->
        <div class="bg-neutral-800 rounded-lg border border-neutral-700 shadow-xl overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead class="bg-neutral-900">
              <tr>
                <!-- Lap # always first -->
                <th class="px-3 md:px-5 py-2 md:py-3 text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-neutral-700 whitespace-nowrap">
                  Lap
                </th>
                <th v-for="col in orderedVisibleColumns" :key="col.key"
                  class="px-3 md:px-5 py-2 md:py-3 text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-neutral-700 whitespace-nowrap">
                  {{ col.label }}
                </th>
                <!-- View on graph -->
                <th class="px-3 md:px-5 py-2 md:py-3 border-b border-neutral-700 w-8" />
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-700">
              <tr v-for="(lap, idx) in race.sortedLaps" :key="lap.lapNumber"
                class="hover:bg-neutral-700/50 transition">

                <!-- Lap number -->
                <td class="px-3 md:px-5 py-1.5 md:py-3 font-mono text-xs md:text-sm text-primary font-bold whitespace-nowrap">
                  {{ lap.lapNumber ?? '-' }}
                </td>

                <!-- Data columns -->
                <td v-for="col in orderedVisibleColumns" :key="col.key"
                  class="px-3 md:px-5 py-1.5 md:py-3 font-mono text-[11px] md:text-sm text-gray-300 relative whitespace-nowrap">

                  <!-- Background bar (numeric columns only) -->
                  <div v-if="col.format !== 'time' && race.stats[col.key]"
                    class="absolute inset-y-0.5 left-1 right-1 z-0 overflow-hidden rounded">
                    <div class="h-full bg-white/10 transition-all duration-700 ease-out"
                      :style="{ width: getBarPercent(lap[col.key], race.stats[col.key].min, race.stats[col.key].max) + '%' }" />
                  </div>

                  <!-- Value + diff -->
                  <div class="relative z-10 flex justify-between items-center gap-2">
                    <span>{{ formatCell(col, lap[col.key]) }}</span>
                    <span v-if="col.dir !== 0 && getDiff(lap, race.sortedLaps, col.key, idx) !== null"
                      class="text-[9px] md:text-[11px] font-bold flex-shrink-0"
                      :class="getDiffColor(col, getDiff(lap, race.sortedLaps, col.key, idx))">
                      {{ formatDiff(col, getDiff(lap, race.sortedLaps, col.key, idx)) }}
                    </span>
                  </div>
                </td>

                <!-- View lap on graph -->
                <td class="px-2 py-1.5 md:py-3">
                  <button @click="viewLapOnGraph(lap)"
                    class="text-gray-600 hover:text-primary transition"
                    title="View lap on graph">
                    <ChartBarIcon class="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </button>
                </td>

              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Load more history -->
      <div class="flex flex-col md:flex-row items-center justify-between bg-neutral-800/50 p-3 rounded-lg border border-neutral-700/50 mt-4 mb-4">
        <div class="flex items-center space-x-2 text-xs text-gray-400 mb-2 md:mb-0">
          <ArrowPathIcon class="w-4 h-4" :class="isLoadingHistory ? 'animate-spin text-primary' : ''" />
          <span>Load More History:</span>
        </div>
        <div class="flex space-x-2 w-full md:w-auto">
          <button @click="loadExtra(10)" :disabled="isLoadingHistory"
            class="flex-1 md:flex-none px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded text-xs text-gray-300 hover:text-white transition disabled:opacity-50">
            +10m
          </button>
          <button @click="loadExtra(30)" :disabled="isLoadingHistory"
            class="flex-1 md:flex-none px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded text-xs text-gray-300 hover:text-white transition disabled:opacity-50">
            +30m
          </button>
          <button @click="loadExtra(60)" :disabled="isLoadingHistory"
            class="flex-1 md:flex-none px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded text-xs text-gray-300 hover:text-white transition disabled:opacity-50">
            +1h
          </button>
        </div>
      </div>

    </div>

    <DisclaimerModal :is-open="showDisclaimer" title="Disclaimer"
      message="eChook measured lap times are only accurate to within a few seconds and are no replacement for the official lap times."
      @confirm="handleDisclaimerConfirm" />
  </div>
</template>
