<!--
  @file components/tabs/GrafanaTab.vue
  @brief Grafana-style coordinate-grid panel dashboard.

  Features:
  - Configurable column count and row height (edit mode)
  - Named layout presets (save/load/delete)
  - Add Panel only visible in edit mode
  - Drag panels to reposition in edit mode
  - Per-panel independent thresholds
-->
<script setup>
import { ref, computed, watch, inject, onMounted, onUnmounted, nextTick } from 'vue'
import { useTelemetryStore } from '../../stores/telemetry'
import { useSettingsStore  } from '../../stores/settings'
import StatPanel    from '../panels/StatPanel.vue'
import GaugePanel   from '../panels/GaugePanel.vue'
import BarPanel     from '../panels/BarPanel.vue'
import LinePanel    from '../panels/LinePanel.vue'
import TextPanel    from '../panels/TextPanel.vue'
import MapPanel     from '../panels/MapPanel.vue'
import BatteryPanel   from '../panels/BatteryPanel.vue'
import LapChartPanel  from '../panels/LapChartPanel.vue'
import { LAP_METRICS } from '../../utils/lapMetrics'
import {
  PlusIcon, XMarkIcon, PencilSquareIcon,
  CheckIcon, Bars3Icon, BookmarkIcon,
  ChevronDownIcon,
} from '@heroicons/vue/24/outline'
import { useAlarmState } from '../../composables/useAlarmState'
import { useTheme, resolveAccent } from '../../composables/useTheme'

const { getCardState, acknowledgeAlarm } = useAlarmState()
const { mode, accent } = useTheme()

// Provided by DashboardView — false while in focus mode until user taps the screen
const showFocusControls = inject('showFocusControls', { value: true })

// Per-panel alarm state using the panel's own threshold[3] (Alarm level)
const acknowledgedPanels = ref([])

const getPanelAlarmState = (panel) => {
  const t3 = panel.thresholds?.[3]
  if (!t3 || t3.value === null || t3.value === undefined || t3.value === '') return 'normal'
  const v = Number(telemetry.displayLiveData?.[panel.key])
  if (isNaN(v)) return 'normal'
  if (v >= Number(t3.value)) {
    return acknowledgedPanels.value.includes(panel.id) ? 'alert' : 'alarm'
  }
  // Clear acknowledgement when value returns to normal
  if (acknowledgedPanels.value.includes(panel.id)) {
    acknowledgedPanels.value = acknowledgedPanels.value.filter(id => id !== panel.id)
  }
  return 'normal'
}

const acknowledgePanelAlarm = (panelId) => {
  if (!acknowledgedPanels.value.includes(panelId)) {
    acknowledgedPanels.value = [...acknowledgedPanels.value, panelId]
  }
}

const telemetry = useTelemetryStore()
const settings  = useSettingsStore()

// ── Grid config (reactive, persisted) ─────────────────────────────────────────
const HEADER = 36

const H_UNITS = { xs: 1, sm: 2, md: 3, lg: 5 }
const SIZES   = [
  { key: 'xs', label: 'XS' },
  { key: 'sm', label: 'S'  },
  { key: 'md', label: 'M'  },
  { key: 'lg', label: 'L'  },
]
const COL_OPTIONS  = [4, 6, 8, 12]
// Row options now store TARGET ROW COUNT, not pixel heights.
// rowH is derived from containerH so the grid always fills the space exactly.
const ROW_H_OPTIONS = [
  { label: 'XS', value: 8 },
  { label: 'S',  value: 6 },
  { label: 'M',  value: 4 },
  { label: 'L',  value: 3 },
]
const GAP = 6
const PADDING = 16  // p-2 on wrapper = 8px each side

const cols = computed({
  get: () => settings.panelGridCols || 8,
  set: (v) => {
    // Clamp all panels to new col count before changing
    panels.value = panels.value.map(p => {
      const w = Math.min(p.w, v)
      const x = Math.min(p.x, v - w)
      return { ...p, w, x }
    })
    settings.panelGridCols = v
    persist()
  },
})

const rowH = computed(() => {
  if (!containerH.value) return 100
  const usable = containerH.value - PADDING
  return Math.max(40, Math.floor((usable - (numRows.value - 1) * GAP) / numRows.value))
})

// numRows = user-selected target row count (stored in settings.panelRowH)
// Values > 10 are old px values — migrate to default 4
const numRows = computed({
  get: () => {
    const v = settings.panelRowH || 4
    return v > 10 ? 4 : v
  },
  set: (v) => { settings.panelRowH = v },
})

// ── Migration ─────────────────────────────────────────────────────────────────
const migratePanel = (p, index, c) => {
  const hUnits = p.hUnits ?? H_UNITS[p.h ?? p.hKey ?? 'md'] ?? 3
  const isV1   = !p._v || p._v < 2
  const w      = isV1 ? Math.min((p.w || 2) * 2, c) : Math.min(p.w || 4, c)
  const x      = isV1
    ? Math.min((p.x ?? (index % 4)) * 2, c - w)
    : Math.min(p.x ?? (index % c), c - w)
  const y      = p.y ?? Math.floor(index / (c / 2)) * 3
  return { ...p, x, y, w, hUnits, _v: 2 }
}

// ── Panels ────────────────────────────────────────────────────────────────────
const panels = ref(
  (settings.panelLayout ?? []).map((p, i) => migratePanel(p, i, settings.panelGridCols || 8))
)

const persist = () => {
  settings.panelLayout = JSON.parse(JSON.stringify(
    panels.value.map(({ h, hKey, ...rest }) => rest)
  ))
}

watch(() => settings.panelLayout, (v) => {
  const migrated = (v ?? []).map((p, i) => migratePanel(p, i, cols.value))
  if (JSON.stringify(migrated) !== JSON.stringify(panels.value)) {
    panels.value = migrated
  }
}, { deep: true })

// ── Grid geometry ─────────────────────────────────────────────────────────────
const gridRef       = ref(null)
const containerW    = ref(0)
const containerH    = ref(0)
let   resizeObs     = null

onMounted(async () => {
  await nextTick()
  if (gridRef.value) {
    resizeObs = new ResizeObserver(([e]) => {
      containerW.value = e.contentRect.width
      containerH.value = e.contentRect.height
    })
    resizeObs.observe(gridRef.value)
    containerW.value = gridRef.value.clientWidth
    containerH.value = gridRef.value.clientHeight
  }
})
onUnmounted(() => {
  resizeObs?.disconnect()
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup',   onPointerUp)
})

// Number of rows that fit exactly in the container for the selected row height
// For background grid cells — show exactly the target row count
const displayRows = computed(() => numRows.value)

const cellW = computed(() =>
  containerW.value
    ? Math.floor((containerW.value - 16 - (cols.value - 1) * GAP) / cols.value)
    : 200
)

// ── CSS helpers ───────────────────────────────────────────────────────────────
const panelStyle = (p) => ({
  gridColumn: `${p.x + 1} / span ${Math.min(p.w, cols.value - p.x)}`,
  gridRow:    `${p.y + 1} / span ${p.hUnits}`,
})

const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${cols.value}, minmax(0, 1fr))`,
  gridTemplateRows:    `repeat(${numRows.value}, ${rowH.value}px)`,
}))

const chartH = (p) =>
  p.hUnits * rowH.value + (p.hUnits - 1) * GAP - (editMode.value ? HEADER : 0)

// ── Drag ──────────────────────────────────────────────────────────────────────
const editMode  = ref(false)
const dragState = ref(null)

const clientToCell = (clientX, clientY) => {
  const rect = gridRef.value.getBoundingClientRect()
  // Account for the p-2 (8px) padding on the wrapper
  return {
    col: Math.max(0, Math.floor((clientX - rect.left  - 8) / (cellW.value + GAP))),
    row: Math.max(0, Math.floor((clientY - rect.top   - 8) / (rowH.value  + GAP))),
  }
}

const startDrag = (e, id) => {
  if (!editMode.value || e.button !== 0) return
  e.preventDefault()
  const p = panels.value.find(p => p.id === id)
  const { col, row } = clientToCell(e.clientX, e.clientY)
  dragState.value = { id, grabCol: col - p.x, grabRow: row - p.y, targetX: p.x, targetY: p.y }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup',   onPointerUp)
}

const onPointerMove = (e) => {
  if (!dragState.value) return
  const p = panels.value.find(p => p.id === dragState.value.id)
  const { col, row } = clientToCell(e.clientX, e.clientY)
  dragState.value.targetX = Math.max(0, Math.min(cols.value - p.w, col - dragState.value.grabCol))
  dragState.value.targetY = Math.max(0, row - dragState.value.grabRow)
}

const onPointerUp = () => {
  if (!dragState.value) return
  const { id, targetX, targetY } = dragState.value
  const moving  = panels.value.find(p => p.id === id)
  const others  = panels.value.filter(p => p.id !== id)

  // Build the proposed position for the moving panel
  const proposed = { ...moving, x: targetX, y: targetY }

  // Only commit if no other panel overlaps the target area
  const blocked = others.some(p => overlaps(proposed, p))

  if (!blocked) {
    panels.value = panels.value.map(p =>
      p.id === id ? { ...p, x: targetX, y: targetY } : p
    )
    persist()
  }
  // If blocked, panel snaps back to its original position (no change needed)

  dragState.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup',   onPointerUp)
}

const overlaps = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.hUnits && a.y + a.hUnits > b.y

const ghostBlocked = computed(() => {
  if (!dragState.value) return false
  const moving  = panels.value.find(p => p.id === dragState.value.id)
  if (!moving) return false
  const proposed = { ...moving, x: dragState.value.targetX, y: dragState.value.targetY }
  return panels.value.filter(p => p.id !== dragState.value.id).some(p => overlaps(proposed, p))
})

const ghostStyle = computed(() => {
  if (!dragState.value) return {}
  const p = panels.value.find(p => p.id === dragState.value.id)
  if (!p) return {}
  return {
    gridColumn:    `${dragState.value.targetX + 1} / span ${Math.min(p.w, cols.value - dragState.value.targetX)}`,
    gridRow:       `${dragState.value.targetY + 1} / span ${p.hUnits}`,
    pointerEvents: 'none',
  }
})

// ── Presets ───────────────────────────────────────────────────────────────────
const activePresetId    = ref(null)
const showPresetMenu    = ref(false)
const showSavePreset    = ref(false)
const showManagePresets = ref(false)
const newPresetName     = ref('')
const presetMenuRef     = ref(null)

// Per-preset rename state: { [id]: string }
const renameDrafts = ref({})

const presets = computed(() => settings.panelPresets ?? [])

const loadPreset = (preset) => {
  panels.value           = JSON.parse(JSON.stringify(preset.panels))
  settings.panelGridCols = preset.cols
  settings.panelRowH     = preset.rowH   // stored as row count
  settings.panelLayout   = JSON.parse(JSON.stringify(preset.panels))
  activePresetId.value   = preset.id
  showPresetMenu.value   = false
}

const saveAsPreset = () => {
  const name = newPresetName.value.trim()
  if (!name) return
  const preset = {
    id:     Date.now().toString(36),
    name,
    panels: JSON.parse(JSON.stringify(panels.value.map(({ h, hKey, ...r }) => r))),
    cols:   cols.value,
    rowH:   numRows.value,
  }
  settings.panelPresets  = [...(settings.panelPresets ?? []), preset]
  activePresetId.value   = preset.id
  newPresetName.value    = ''
  showSavePreset.value   = false
}

const updatePreset = () => {
  settings.panelPresets = (settings.panelPresets ?? []).map(p =>
    p.id === activePresetId.value
      ? { ...p,
          panels: JSON.parse(JSON.stringify(panels.value.map(({ h, hKey, ...r }) => r))),
          cols: cols.value, rowH: numRows.value }
      : p
  )
}

const deletePreset = (id) => {
  settings.panelPresets = (settings.panelPresets ?? []).filter(p => p.id !== id)
  if (activePresetId.value === id) activePresetId.value = null
  delete renameDrafts.value[id]
}

const startRename = (preset) => {
  renameDrafts.value[preset.id] = preset.name
}

const commitRename = (id) => {
  const name = (renameDrafts.value[id] ?? '').trim()
  if (!name) return cancelRename(id)
  settings.panelPresets = (settings.panelPresets ?? []).map(p =>
    p.id === id ? { ...p, name } : p
  )
  delete renameDrafts.value[id]
}

const cancelRename = (id) => {
  delete renameDrafts.value[id]
}

const activePreset = computed(() =>
  presets.value.find(p => p.id === activePresetId.value) ?? null
)

// Close preset menu on outside click
const handleOutsideClick = (e) => {
  if (presetMenuRef.value && !presetMenuRef.value.contains(e.target)) {
    showPresetMenu.value = false
  }
}
watch(showPresetMenu, (v) => {
  if (v) document.addEventListener('mousedown', handleOutsideClick)
  else   document.removeEventListener('mousedown', handleOutsideClick)
})
onUnmounted(() => document.removeEventListener('mousedown', handleOutsideClick))

// ── Panel CRUD ────────────────────────────────────────────────────────────────
const showModal  = ref(false)
const draftMode  = ref('add')
const draftIdx   = ref(-1)
const mkId       = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

const emptyDraft = () => ({
  id: mkId(), type: 'stat', key: telemetry.availableKeys[0] ?? '',
  title: '', w: 1, hUnits: 1, color: 'accent', timeScope: null, rollingAverage: 0,
  content: '', fontSize: 'md', capacityAh: 25, sparkline: false, lapMetric: 'LL_Time', lapCount: 5,
  mapSettings: { satellite: false, trailSeconds: 300, metric: 'speed' },
  min: null, max: null, unit: '',
  thresholds: [
    { value: null, color: 'adaptive' },
    { value: null, color: '#f59e0b' },
    { value: null, color: '#ef4444' },
    { value: null, color: '#ef4444', isAlarm: true },
  ],
})

const draft = ref(emptyDraft())

const openAdd = () => {
  draft.value = { ...emptyDraft(), key: telemetry.availableKeys[0] ?? '' }
  draftMode.value = 'add'
  showModal.value = true
}
const openEdit = (index) => {
  draft.value = JSON.parse(JSON.stringify(panels.value[index]))
  if (!draft.value.hUnits) draft.value.hUnits = H_UNITS[draft.value.h ?? 'md'] ?? 3
  if (!draft.value.mapSettings) draft.value.mapSettings = { satellite: false, trailSeconds: 300, metric: 'speed' }
  if (!draft.value.thresholds[3]) draft.value.thresholds.push({ value: null, color: '#ef4444', isAlarm: true })
  draftMode.value  = 'edit'
  draftIdx.value   = index
  showModal.value  = true
}
const commitDraft = () => {
  if (!draft.value.key && !['text', 'map', 'battery', 'lapchart'].includes(draft.value.type)) return
  // Normalise empty strings from v-model number inputs → null
  const clean = {
    ...draft.value,
    w:   Math.max(1, Math.min(cols.value, parseInt(draft.value.w) || 1)),
    min: draft.value.min === '' || draft.value.min === null ? null : Number(draft.value.min),
    max: draft.value.max === '' || draft.value.max === null ? null : Number(draft.value.max),
    thresholds: draft.value.thresholds.map((t, i) => i === 0
      ? { ...t, value: null }
      : { ...t, value: (t.value === '' || t.value === null) ? null : Number(t.value) }
    ),
  }
  if (draftMode.value === 'add') {
    // Find the first grid cell that fits the panel without overlapping
    const findFreeCell = (w, h) => {
      const occupied = (r, c) => panels.value.some(p =>
        c < p.x + p.w && c + w > p.x &&
        r < p.y + p.hUnits && r + h > p.y
      )
      for (let r = 0; r < 200; r++) {
        for (let c = 0; c <= cols.value - w; c++) {
          let fits = true
          for (let dr = 0; dr < h && fits; dr++)
            for (let dc = 0; dc < w && fits; dc++)
              if (occupied(r + dr, c + dc)) fits = false
          if (fits) return { x: c, y: r }
        }
      }
      return { x: 0, y: panels.value.length ? Math.max(...panels.value.map(p => p.y + p.hUnits)) : 0 }
    }
    const { x: px, y: py } = findFreeCell(clean.w, clean.hUnits)
    panels.value = [...panels.value, { ...clean, x: px, y: py, _v: 2 }]
  } else {
    panels.value = panels.value.map((p, i) => i === draftIdx.value ? { ...p, ...clean } : p)
  }
  persist()
  showModal.value = false
}
const removePanel = (index) => {
  panels.value = panels.value.filter((_, i) => i !== index)
  persist()
}

const setThresholdColor = (i, c) => {
  draft.value.thresholds[i] = { ...draft.value.thresholds[i], color: c }
}

const needsRange = computed(() => ['gauge', 'bar'].includes(draft.value.type))
const getValue   = (key) => telemetry.displayLiveData?.[key] ?? null

const onPanelClick = (e, panel) => {
  if (getPanelAlarmState(panel) === 'alarm') {
    e.stopPropagation()
    acknowledgePanelAlarm(panel.id)
  }
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden bg-neutral-900">

    <!-- ── Toolbar — hidden in focus mode until user taps the screen ────────── -->
    <div v-show="showFocusControls.value ?? showFocusControls"
      class="flex items-center gap-2 px-3 h-10 border-b border-neutral-800 flex-shrink-0 bg-neutral-900 flex-wrap">

      <!-- Add Panel — edit mode only -->
      <button v-if="editMode" @click="openAdd"
        class="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold
               bg-primary hover:opacity-90 text-white transition flex-shrink-0">
        <PlusIcon class="w-3.5 h-3.5" /> Add Panel
      </button>

      <button v-if="editMode && panels.length > 0" @click="panels = []; persist()"
        class="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold
               bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-gray-400 hover:text-white transition flex-shrink-0">
        <XMarkIcon class="w-3.5 h-3.5" /> Clear
      </button>

      <!-- Column count — edit mode only -->
      <template v-if="editMode">
        <div class="h-4 w-px bg-neutral-700 flex-shrink-0" />
        <div class="flex items-center gap-1 flex-shrink-0">
          <span class="text-xs text-gray-500">Cols</span>
          <button v-for="n in COL_OPTIONS" :key="n" @click="cols = n"
            class="w-6 h-6 rounded text-xs font-bold transition"
            :class="cols === n ? 'bg-primary text-white' : 'text-gray-500 hover:text-white hover:bg-neutral-700'">
            {{ n }}
          </button>
        </div>
        <div class="h-4 w-px bg-neutral-700 flex-shrink-0" />
        <div class="flex items-center gap-1 flex-shrink-0">
          <span class="text-xs text-gray-500">Row</span>
          <button v-for="opt in ROW_H_OPTIONS" :key="opt.value" @click="numRows = opt.value"
            class="px-2 h-6 rounded text-xs font-bold transition"
            :class="numRows === opt.value ? 'bg-primary text-white' : 'text-gray-500 hover:text-white hover:bg-neutral-700'">
            {{ opt.label }}
          </button>
        </div>
      </template>

      <div class="flex-1" />

      <!-- Preset picker — view mode -->
      <div v-if="!editMode" ref="presetMenuRef" class="relative flex-shrink-0">
        <button @click="showPresetMenu = !showPresetMenu"
          class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-neutral-800
                 hover:bg-neutral-700 text-gray-300 transition border border-neutral-700">
          <BookmarkIcon class="w-3.5 h-3.5" />
          {{ activePreset?.name ?? 'Presets' }}
          <ChevronDownIcon class="w-3 h-3 text-gray-500" />
        </button>
        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
          <div v-if="showPresetMenu"
            class="absolute top-full mt-1 right-0 z-50 origin-top-right bg-neutral-800 border border-neutral-700
                   rounded-lg shadow-2xl min-w-[180px] py-1 max-h-72 overflow-y-auto">
            <div v-if="presets.length === 0"
              class="px-3 py-4 text-xs text-gray-500 text-center italic">
              No saved presets
            </div>
            <button v-for="preset in presets" :key="preset.id"
              @click="loadPreset(preset)"
              class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-700 transition flex items-center gap-2"
              :class="activePresetId === preset.id ? 'text-primary' : 'text-gray-300'">
              <BookmarkIcon class="w-3.5 h-3.5 flex-shrink-0" />
              {{ preset.name }}
            </button>
          </div>
        </Transition>
      </div>

      <!-- Preset management — edit mode -->
      <template v-if="editMode">
        <!-- Save as new preset -->
        <div v-if="!showSavePreset" class="flex items-center gap-1.5 flex-shrink-0">
          <button @click="showSavePreset = true"
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold
                   bg-neutral-800 hover:bg-neutral-700 text-gray-300 border border-neutral-700 transition">
            <BookmarkIcon class="w-3.5 h-3.5" /> Save Preset
          </button>
          <!-- Update existing preset -->
          <button v-if="activePreset" @click="updatePreset"
            class="px-2.5 py-1 rounded-md text-xs font-semibold bg-neutral-800 hover:bg-neutral-700
                   text-gray-300 border border-neutral-700 transition">
            Update "{{ activePreset.name }}"
          </button>
          <!-- Manage presets -->
          <button v-if="presets.length > 0" @click="showManagePresets = true"
            class="px-2.5 py-1 rounded-md text-xs font-semibold bg-neutral-800 hover:bg-neutral-700
                   text-gray-300 border border-neutral-700 transition">
            Manage
          </button>
        </div>
        <!-- Save name input -->
        <div v-else class="flex items-center gap-1.5 flex-shrink-0">
          <input v-model="newPresetName" type="text" placeholder="Preset name…" autofocus
            @keydown.enter="saveAsPreset" @keydown.escape="showSavePreset = false"
            class="w-36 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white
                   focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
          <button @click="saveAsPreset" :disabled="!newPresetName.trim()"
            class="px-2.5 py-1 rounded-md text-xs font-bold bg-primary hover:opacity-90
                   disabled:opacity-40 text-white transition">Save</button>
          <button @click="showSavePreset = false"
            class="px-2 py-1 rounded text-xs text-gray-500 hover:text-white transition">✕</button>
        </div>

      </template>

      <!-- Edit/Done toggle — always visible -->
      <button @click="editMode = !editMode"
        class="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition flex-shrink-0"
        :class="editMode ? 'bg-primary text-white' : 'bg-neutral-800 text-gray-400 hover:text-white border border-neutral-700'">
        <component :is="editMode ? CheckIcon : PencilSquareIcon" class="w-3.5 h-3.5" />
        {{ editMode ? 'Done' : 'Edit' }}
      </button>

    </div>

    <!-- ── Grid — always rendered so ResizeObserver stays active ────────────── -->
    <div ref="gridRef" class="flex-1 overflow-hidden p-2 relative">
      <div v-if="dragState" class="fixed inset-0 z-50 cursor-grabbing" />

      <!-- Empty hint -->
      <div v-if="panels.length === 0"
        class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <p class="text-sm text-gray-600">Switch to <span class="text-gray-500 font-semibold">Edit</span> mode and click <span class="text-gray-500 font-semibold">Add Panel</span></p>
      </div>

      <div class="grid w-full h-full" :style="[gridStyle, { gap: GAP + 'px' }]">

        <!-- Background grid cells (edit mode) -->
        <template v-if="editMode">
          <template v-for="r in displayRows" :key="'row-' + r">
            <div v-for="c in cols" :key="'cell-' + r + '-' + c"
              class="rounded border border-dashed border-neutral-700/30 pointer-events-none"
              :style="{ gridColumn: c, gridRow: r }" />
          </template>
        </template>

        <!-- Drag ghost — red when target is occupied, accent when clear -->
        <div v-if="dragState"
          class="rounded-xl border-2 border-dashed z-10 pointer-events-none transition-colors duration-100"
          :style="[ghostStyle, ghostBlocked
            ? { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.10)' }
            : { borderColor: 'var(--accent,#cb1557)', backgroundColor: 'rgba(203,21,87,0.07)' }]" />

        <!-- Panels -->
        <div v-for="(panel, index) in panels" :key="panel.id"
          class="flex flex-col rounded-xl border overflow-hidden relative transition-opacity duration-100 min-h-0"
          style="isolation: isolate"
          :class="{
            'border-neutral-700 bg-neutral-800': dragState?.id !== panel.id && getPanelAlarmState(panel) === 'normal',
            'border-neutral-600 opacity-30':     dragState?.id === panel.id,
            'border-red-500 bg-neutral-800 ring-2 ring-red-500 shadow-lg shadow-red-500/40': getPanelAlarmState(panel) === 'alert',
            'border-red-500 bg-neutral-800 ring-2 ring-red-500 cursor-pointer':              getPanelAlarmState(panel) === 'alarm',
          }"
          :style="panelStyle(panel)"
          @click="onPanelClick($event, panel)">

          <!-- Alarm overlays -->
          <div v-if="getPanelAlarmState(panel) === 'alert'"
            class="absolute inset-0 rounded-xl ring-2 ring-red-400 animate-pulse pointer-events-none z-10" />
          <div v-if="getPanelAlarmState(panel) === 'alarm'"
            class="absolute inset-0 rounded-xl alarm-blink pointer-events-none z-10" />

          <!-- Header — edit mode only -->
          <div v-if="editMode"
            class="flex items-center gap-1.5 px-2 flex-shrink-0 bg-neutral-900/60 border-b border-neutral-800 cursor-grab active:cursor-grabbing"
            :style="{ height: HEADER + 'px' }"
            @pointerdown="startDrag($event, panel.id)">
            <Bars3Icon class="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
            <span class="text-xs font-semibold text-gray-400 truncate flex-1 min-w-0 select-none">
              {{ panel.title || telemetry.getDisplayName(panel.key) }}
              <span class="text-gray-600 font-normal capitalize ml-1">({{ panel.type }})</span>
            </span>
            <button @pointerdown.stop @click.stop="openEdit(index)"
              class="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-primary hover:bg-neutral-700 transition cursor-pointer flex-shrink-0">
              <PencilSquareIcon class="w-3.5 h-3.5" />
            </button>
            <button @pointerdown.stop @click.stop="removePanel(index)"
              class="w-6 h-6 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-neutral-700 transition cursor-pointer flex-shrink-0">
              <XMarkIcon class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 min-h-0 overflow-hidden">
            <StatPanel  v-if="panel.type === 'stat'"
              :panel="panel" :value="getValue(panel.key)"
              :display-name="telemetry.getDisplayName(panel.key)" :is-stale="telemetry.isDataStale" />
            <GaugePanel v-else-if="panel.type === 'gauge'"
              :panel="panel" :value="getValue(panel.key)"
              :display-name="telemetry.getDisplayName(panel.key)" :is-stale="telemetry.isDataStale" />
            <BarPanel   v-else-if="panel.type === 'bar'"
              :panel="panel" :value="getValue(panel.key)"
              :display-name="telemetry.getDisplayName(panel.key)" :is-stale="telemetry.isDataStale" />
            <LinePanel  v-else-if="panel.type === 'line'"
              :panel="panel" :data="telemetry.displayHistory"
              :chart-height="chartH(panel)"
              :line-color="panel.color"
              :rolling-average="panel.rollingAverage ?? 0"
              :display-name="telemetry.getDisplayName(panel.key)" :is-stale="telemetry.isDataStale" />
            <TextPanel  v-else-if="panel.type === 'text'"
              :panel="panel"
              :display-name="telemetry.getDisplayName(panel.key)" :is-stale="telemetry.isDataStale" />
            <MapPanel     v-else-if="panel.type === 'map'"
              :panel="panel"
              :display-name="telemetry.getDisplayName(panel.key)" :is-stale="telemetry.isDataStale" />
            <BatteryPanel   v-else-if="panel.type === 'battery'"
              :panel="panel" :is-stale="telemetry.isDataStale" />
            <LapChartPanel  v-else-if="panel.type === 'lapchart'"
              :panel="panel" :is-stale="telemetry.isDataStale" />
          </div>
        </div>

      </div>
    </div>

    <!-- ── Panel editor modal ──────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showModal"
        class="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        @click.self="showModal = false">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showModal = false" />
        <div class="relative z-10 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl
                    w-full max-w-lg max-h-[90vh] overflow-y-auto">

          <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
            <h2 class="text-base font-bold text-white">{{ draftMode === 'add' ? 'Add Panel' : 'Edit Panel' }}</h2>
            <button @click="showModal = false"
              class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-neutral-800 transition">
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>

          <div class="px-6 py-5 space-y-5">

            <!-- Lap metric + count selectors (lapchart only) -->
            <div v-if="draft.type === 'lapchart'" class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Metric</label>
                <select v-model="draft.lapMetric"
                  class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white
                         focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  <option v-for="m in LAP_METRICS" :key="m.key" :value="m.key">{{ m.label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Laps to Show</label>
                <div class="flex gap-1.5">
                  <button v-for="opt in [{ label: '3', value: 3 }, { label: '5', value: 5 }, { label: '10', value: 10 }, { label: 'Max', value: 0 }]"
                    :key="opt.value" @click="draft.lapCount = opt.value"
                    class="flex-1 py-1.5 rounded-lg text-xs font-bold transition border"
                    :class="(draft.lapCount ?? 0) === opt.value
                      ? 'bg-primary border-primary text-white'
                      : 'border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-500'">
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Metric (not needed for text, map, battery, or lapchart panels) -->
            <div v-if="!['text', 'map', 'battery', 'lapchart'].includes(draft.type)">
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Metric</label>
              <select v-model="draft.key"
                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white
                       focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                <option v-for="key in telemetry.availableKeys" :key="key" :value="key">
                  {{ telemetry.getDisplayName(key) }} ({{ key }})
                </option>
              </select>
            </div>

            <!-- Text content (text panels only) -->
            <div v-if="draft.type === 'text'">
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Content</label>
              <textarea v-model="draft.content" rows="6" placeholder="Enter text or markdown…
# Heading
**bold**, *italic*, \`code\`"
                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white
                       font-mono resize-none focus:border-primary focus:ring-1 focus:ring-primary outline-none
                       leading-relaxed" />
              <p class="text-[10px] text-gray-600 mt-1">Supports # headings, **bold**, *italic*, `code`, blank lines for paragraphs.</p>
            </div>

            <!-- Font size (text panels only) -->
            <div v-if="draft.type === 'text'">
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Font Size</label>
              <div class="flex gap-1.5">
                <button v-for="opt in [{ label:'Small', value:'sm' }, { label:'Medium', value:'md' }, { label:'Large', value:'lg' }]"
                  :key="opt.value" @click="draft.fontSize = opt.value"
                  class="flex-1 py-1.5 rounded-lg text-xs font-bold transition border"
                  :class="draft.fontSize === opt.value
                    ? 'bg-primary border-primary text-white'
                    : 'border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-500'">
                  {{ opt.label }}
                </button>
              </div>
            </div>

            <!-- Type -->
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Type</label>
              <div class="grid grid-cols-4 gap-2">
                <button v-for="t in [
                  { id:'stat',    label:'Stat',    icon:'123' }, { id:'gauge',   label:'Gauge',   icon:'◎' },
                  { id:'bar',     label:'Bar',     icon:'▬'  }, { id:'line',    label:'Line',    icon:'📈' },
                  { id:'text',    label:'Text',    icon:'T'  }, { id:'map',     label:'Map',     icon:'🗺'  },
                  { id:'battery',  label:'Battery', icon:'🔋' },
                  { id:'lapchart', label:'Laps',    icon:'🏁' },
                ]" :key="t.id" @click="draft.type = t.id"
                  class="flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition"
                  :class="draft.type === t.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-neutral-700 text-gray-400 hover:border-neutral-500 hover:text-white'">
                  <span class="text-lg leading-none">{{ t.icon }}</span>
                  <span>{{ t.label }}</span>
                </button>
              </div>
            </div>

            <!-- Title -->
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Title <span class="font-normal text-gray-600 normal-case">(optional)</span>
              </label>
              <input v-model="draft.title" type="text" :placeholder="telemetry.getDisplayName(draft.key)"
                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white
                       focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
            </div>

            <!-- Sparkline toggle (stat type only) -->
            <div v-if="draft.type === 'stat'" class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-white">Sparkline</p>
                <p class="text-xs text-gray-500 mt-0.5">Show a history graph behind the value</p>
              </div>
              <button
                @click="draft.sparkline = !draft.sparkline"
                class="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
                :class="draft.sparkline ? 'bg-primary' : 'bg-neutral-600'">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                  :class="draft.sparkline ? 'translate-x-5' : 'translate-x-0'" />
              </button>
            </div>

            <!-- Capacity (battery type only) -->
            <div v-if="draft.type === 'battery'">
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                Pack Capacity (Ah)
              </label>
              <input type="number" min="1" max="500" step="0.5" v-model.number="draft.capacityAh"
                placeholder="25"
                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono
                       focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              <p class="text-[10px] text-gray-600 mt-1">Real-world usable capacity. SoC and time to empty are calculated from this figure.</p>
            </div>

            <!-- Line colour (line type only) -->
            <div v-if="draft.type === 'line'">
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Line Colour</label>
              <div class="flex items-center gap-3">
                <div class="relative w-10 h-10 rounded-lg overflow-hidden border border-neutral-700 flex-shrink-0">
                  <div class="absolute inset-0 rounded-lg"
                    :style="draft.color === 'adaptive'
                      ? { background: 'linear-gradient(135deg, #000 50%, #fff 50%)' }
                      : { backgroundColor: resolveAccent(draft.color, mode) }" />
                  <input v-if="draft.color !== 'adaptive' && draft.color !== 'accent'" type="color"
                    :value="draft.color"
                    @input="draft.color = $event.target.value"
                    class="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                </div>
                <div class="flex gap-1.5 flex-wrap">
                  <!-- Accent swatch -->
                  <button
                    @click="draft.color = 'accent'"
                    class="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                    :class="draft.color === 'accent' ? 'border-white scale-110' : 'border-transparent'"
                    :style="{ backgroundColor: resolveAccent(accent, mode) }"
                    title="Follow accent colour" />
                  <!-- Adaptive (auto dark/light) swatch -->
                  <button
                    @click="draft.color = 'adaptive'"
                    class="w-7 h-7 rounded-md border-2 overflow-hidden transition-transform hover:scale-110"
                    :class="draft.color === 'adaptive' ? 'border-white scale-110' : 'border-transparent'"
                    title="Auto — white in dark mode, black in light mode"
                    style="background: linear-gradient(135deg, #000 50%, #fff 50%)" />
                  <!-- Preset swatches -->
                  <button v-for="c in ['#cb1557','#3b82f6','#10b981','#f59e0b','#8b5cf6','#f97316','#06b6d4','#ec4899','#ef4444','#84cc16']"
                    :key="c"
                    @click="draft.color = c"
                    class="w-7 h-7 rounded-md border-2 transition-transform hover:scale-110"
                    :class="draft.color === c ? 'border-white scale-110' : 'border-transparent'"
                    :style="{ backgroundColor: c }" />
                </div>
              </div>
              <p class="text-[10px] text-gray-600 mt-1.5">
                The diagonal swatch auto-switches between white (dark mode) and black (light mode).
              </p>
            </div>

            <!-- Time scope (line type only) -->
            <div v-if="draft.type === 'line'">
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Time Scope</label>
              <div class="flex gap-1.5">
                <button v-for="opt in [
                  { label: 'Auto', value: null  },
                  { label: '30s',  value: 30    },
                  { label: '1m',   value: 60    },
                  { label: '2m',   value: 120   },
                  { label: '5m',   value: 300   },
                ]" :key="String(opt.value)"
                  @click="draft.timeScope = opt.value"
                  class="flex-1 py-1.5 rounded-lg text-xs font-bold transition border"
                  :class="draft.timeScope === opt.value
                    ? 'bg-primary border-primary text-white'
                    : 'border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-500'">
                  {{ opt.label }}
                </button>
              </div>
              <p class="text-[10px] text-gray-600 mt-1.5">Auto shows all available history.</p>
            </div>

            <!-- Rolling average (line type only) -->
            <div v-if="draft.type === 'line'">
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Rolling Average</label>
              <div class="flex gap-1.5">
                <button v-for="opt in [
                  { label: 'Off', value: 0  },
                  { label: '5',   value: 5  },
                  { label: '10',  value: 10 },
                  { label: '25',  value: 25 },
                  { label: '50',  value: 50 },
                ]" :key="opt.value"
                  @click="draft.rollingAverage = opt.value"
                  class="flex-1 py-1.5 rounded-lg text-xs font-bold transition border"
                  :class="(draft.rollingAverage ?? 0) === opt.value
                    ? 'bg-primary border-primary text-white'
                    : 'border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-500'">
                  {{ opt.label }}
                </button>
              </div>
              <p class="text-[10px] text-gray-600 mt-1.5">Smooths the line by averaging the last N data points.</p>
            </div>

            <!-- Columns + Rows -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Columns</label>
                <div class="flex gap-1 mb-1.5">
                  <button v-for="opt in [
                    { label: '1',    value: 1          },
                    { label: '2',    value: 2          },
                    { label: '4',    value: 4          },
                    { label: 'Full', value: cols       },
                  ].filter(o => o.value <= cols)" :key="opt.label"
                    @click="draft.w = opt.value"
                    class="flex-1 py-1.5 rounded-lg text-xs font-bold transition border"
                    :class="draft.w === opt.value
                      ? 'bg-primary border-primary text-white'
                      : 'border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-500'">
                    {{ opt.label }}
                  </button>
                </div>
                <input
                  type="number" min="1" :max="cols" step="1"
                  v-model="draft.w"
                  class="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono
                         focus:border-primary focus:ring-1 focus:ring-primary outline-none transition" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Rows</label>
                <div class="flex gap-1">
                  <button v-for="opt in [
                    { label: '1',    value: 1           },
                    { label: '2',    value: 2           },
                    { label: '3',    value: 3           },
                    { label: 'Full', value: numRows     },
                  ]" :key="opt.label"
                    @click="draft.hUnits = opt.value"
                    class="flex-1 py-1.5 rounded-lg text-xs font-bold transition border"
                    :class="draft.hUnits === opt.value
                      ? 'bg-primary border-primary text-white'
                      : 'border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-500'">
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Min / Max -->
            <div v-if="needsRange && draft.type !== 'text'" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Min</label>
                <input type="number" step="any" v-model="draft.min"
                  placeholder="0"
                  class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Max</label>
                <input type="number" step="any" v-model="draft.max"
                  placeholder="100"
                  class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              </div>
            </div>

            <!-- Thresholds (not for text, map, battery, or lapchart panels) -->
            <div v-if="!['text', 'map', 'battery', 'lapchart'].includes(draft.type)">
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Thresholds</label>
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <div class="relative w-8 h-8 rounded-md overflow-hidden border border-neutral-700 flex-shrink-0">
                    <div class="absolute inset-0 rounded-md"
                      :style="draft.thresholds[0].color === 'adaptive'
                        ? { background: 'linear-gradient(135deg, #000 50%, #fff 50%)' }
                        : { backgroundColor: draft.thresholds[0].color }" />
                    <input type="color" :value="draft.thresholds[0].color === 'adaptive' ? '#ffffff' : draft.thresholds[0].color"
                      @input="setThresholdColor(0, $event.target.value)"
                      class="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <span class="text-xs text-gray-400 w-16">Base</span>
                  <div class="flex items-center gap-2">
                    <button
                      @click="setThresholdColor(0, 'adaptive')"
                      class="text-[10px] px-2 py-0.5 rounded border transition"
                      :class="draft.thresholds[0].color === 'adaptive'
                        ? 'border-primary text-primary bg-primary/10'
                        : 'border-neutral-700 text-gray-500 hover:text-white'">
                      Auto
                    </button>
                    <span class="text-xs text-gray-600 italic" v-if="draft.thresholds[0].color === 'adaptive'">adaptive</span>
                    <span class="text-xs text-gray-600 italic" v-else>always</span>
                  </div>
                </div>
                <div v-for="(label, ti) in ['Warning', 'Critical']" :key="label" class="flex items-center gap-2">
                  <div class="relative w-8 h-8 rounded-md overflow-hidden border border-neutral-700 flex-shrink-0">
                    <div class="absolute inset-0 rounded-md" :style="{ backgroundColor: draft.thresholds[ti+1].color }" />
                    <input type="color" :value="draft.thresholds[ti+1].color"
                      @input="setThresholdColor(ti+1, $event.target.value)"
                      class="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                  </div>
                  <span class="text-xs text-gray-400 w-16">{{ label }}</span>
                  <div class="flex items-center gap-1 flex-1">
                    <span class="text-xs text-gray-600">≥</span>
                    <input type="number" step="any" v-model="draft.thresholds[ti+1].value" placeholder="disabled"
                      class="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-primary outline-none" />
                  </div>
                </div>

                <!-- Alarm row — triggers panel flash -->
                <div v-if="draft.thresholds[3]" class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-md flex-shrink-0 flex items-center justify-center bg-red-900/30 border border-red-700/50">
                    <svg class="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                  </div>
                  <span class="text-xs text-red-400 font-semibold w-16">Alarm</span>
                  <div class="flex items-center gap-1 flex-1">
                    <span class="text-xs text-gray-600">≥</span>
                    <input type="number" step="any" v-model="draft.thresholds[3].value" placeholder="disabled"
                      class="flex-1 bg-neutral-800 border border-red-700/40 rounded px-2 py-1 text-xs text-white font-mono focus:border-red-500 outline-none" />
                  </div>
                </div>
              </div>
              <p class="text-[10px] text-gray-600 mt-2">Colour applies when value ≥ threshold. <span class="text-red-500/70">Alarm</span> flashes the panel border.</p>
            </div>

            <!-- Map settings (map type only) -->
            <div v-if="draft.type === 'map'" class="space-y-4">

              <!-- Satellite toggle -->
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm font-medium text-white">Satellite View</p>
                  <p class="text-xs text-gray-500 mt-0.5">Use ESRI satellite imagery instead of OSM</p>
                </div>
                <button
                  @click="draft.mapSettings.satellite = !draft.mapSettings.satellite"
                  class="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
                  :class="draft.mapSettings.satellite ? 'bg-primary' : 'bg-neutral-600'">
                  <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                    :class="draft.mapSettings.satellite ? 'translate-x-5' : 'translate-x-0'" />
                </button>
              </div>

              <!-- Trail duration -->
              <div>
                <div class="flex justify-between mb-1.5">
                  <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Trail Duration</label>
                  <span class="text-xs font-mono text-primary">
                    {{ draft.mapSettings.trailSeconds >= 60
                      ? Math.round(draft.mapSettings.trailSeconds / 60) + ' min'
                      : draft.mapSettings.trailSeconds + 's' }}
                  </span>
                </div>
                <div class="flex gap-1.5 flex-wrap">
                  <button v-for="opt in [
                    { label: '30s',  value: 30   },
                    { label: '1m',   value: 60   },
                    { label: '2m',   value: 120  },
                    { label: '5m',   value: 300  },
                    { label: '10m',  value: 600  },
                  ]" :key="opt.value"
                    @click="draft.mapSettings.trailSeconds = opt.value"
                    class="flex-1 py-1.5 rounded-lg text-xs font-bold transition border"
                    :class="draft.mapSettings.trailSeconds === opt.value
                      ? 'bg-primary border-primary text-white'
                      : 'border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-500'">
                    {{ opt.label }}
                  </button>
                </div>
              </div>

              <!-- Trail metric -->
              <div>
                <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Trail Metric</label>
                <select v-model="draft.mapSettings.metric"
                  class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white
                         focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                  <option v-for="key in telemetry.availableKeys" :key="key" :value="key">
                    {{ telemetry.getDisplayName(key) }}
                  </option>
                </select>
              </div>

            </div>

          </div>

          <div class="flex gap-2 px-6 py-4 border-t border-neutral-800">
            <button @click="showModal = false"
              class="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-sm font-semibold rounded-lg transition">
              Cancel
            </button>
            <button @click="commitDraft" :disabled="!draft.key && !['text', 'map', 'battery', 'lapchart'].includes(draft.type)"
              class="flex-1 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-white text-sm font-bold rounded-lg transition">
              {{ draftMode === 'add' ? 'Add Panel' : 'Save Changes' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── Manage Presets modal ────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showManagePresets"
        class="fixed inset-0 z-[1000] flex items-center justify-center p-4"
        @click.self="showManagePresets = false">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="showManagePresets = false" />

        <div class="relative z-10 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl
                    w-full max-w-md max-h-[80vh] flex flex-col">

          <div class="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
            <h2 class="text-base font-bold text-white">Manage Presets</h2>
            <button @click="showManagePresets = false"
              class="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500
                     hover:text-white hover:bg-neutral-800 transition">
              <XMarkIcon class="w-4 h-4" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">

            <div v-if="presets.length === 0"
              class="text-center py-8 text-sm text-gray-500 italic">
              No saved presets.
            </div>

            <div v-for="preset in presets" :key="preset.id"
              class="flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors"
              :class="activePresetId === preset.id
                ? 'border-primary/40 bg-primary/5'
                : 'border-neutral-700 bg-neutral-800/50'">

              <!-- Inline rename input or name -->
              <div class="flex-1 min-w-0">
                <input v-if="renameDrafts[preset.id] !== undefined"
                  :value="renameDrafts[preset.id]"
                  @input="renameDrafts[preset.id] = $event.target.value"
                  @keydown.enter="commitRename(preset.id)"
                  @keydown.escape="cancelRename(preset.id)"
                  @blur="commitRename(preset.id)"
                  autofocus
                  class="w-full bg-neutral-900 border border-primary rounded px-2 py-0.5 text-sm
                         text-white focus:ring-1 focus:ring-primary outline-none" />
                <button v-else
                  @click="startRename(preset)"
                  class="text-sm font-semibold text-left w-full truncate transition group flex items-center gap-1.5"
                  :class="activePresetId === preset.id ? 'text-primary' : 'text-white hover:text-primary'"
                  title="Click to rename">
                  {{ preset.name }}
                  <PencilSquareIcon class="w-3 h-3 opacity-0 group-hover:opacity-40 transition flex-shrink-0" />
                </button>
                <p class="text-[10px] text-gray-600 mt-0.5">{{ preset.cols }} cols · {{ preset.rowH }} rows</p>
              </div>

              <!-- Load -->
              <button @click="loadPreset(preset); showManagePresets = false"
                class="px-2.5 py-1 rounded text-xs font-semibold transition flex-shrink-0"
                :class="activePresetId === preset.id
                  ? 'bg-primary/20 text-primary cursor-default'
                  : 'bg-neutral-700 hover:bg-neutral-600 text-gray-300'">
                {{ activePresetId === preset.id ? 'Active' : 'Load' }}
              </button>

              <!-- Delete -->
              <button @click="deletePreset(preset.id)"
                class="w-7 h-7 flex items-center justify-center rounded text-gray-600
                       hover:text-red-400 hover:bg-neutral-700 transition flex-shrink-0">
                <XMarkIcon class="w-4 h-4" />
              </button>

            </div>
          </div>

          <div class="px-6 py-4 border-t border-neutral-800 flex-shrink-0">
            <button @click="showManagePresets = false"
              class="w-full py-2 bg-neutral-800 hover:bg-neutral-700 text-gray-300 text-sm
                     font-semibold rounded-lg transition">
              Close
            </button>
          </div>

        </div>
      </div>
    </Teleport>

  </div>
</template>


<style>
@keyframes alarm-blink {
  0%, 100% { background-color: rgba(239, 68, 68, 0.15); }
  50%       { background-color: transparent; }
}
.alarm-blink {
  animation: alarm-blink 0.55s step-end infinite;
}
</style>
