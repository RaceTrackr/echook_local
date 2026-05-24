<!--
  @file components/tabs/SettingsTab.vue
  @brief User settings and preferences component.
-->
<script setup>
import { computed, ref, reactive, watchEffect, onMounted } from 'vue'
import QRCode from 'qrcode'
import { useTelemetryStore } from '../../stores/telemetry'
import { useSettingsStore } from '../../stores/settings'
import ThemePicker from '../ui/ThemePicker.vue'
import draggable from 'vuedraggable'
import { Switch, SwitchGroup, SwitchLabel, Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/vue'
import {
  EllipsisVerticalIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
} from '@heroicons/vue/24/outline'

const telemetry = useTelemetryStore()
const settings  = useSettingsStore()

// ── Collapsible sections ──────────────────────────────────────────────────────

const openSections = reactive({
  qr:          false,
  admin:       false,
  theme:       false,
  ribbon:      false,
  keybindings: false,
  standings:   false,
  units:       false,
  performance: false,
  rawData:     false,
})

const toggleSection = (key) => { openSections[key] = !openSections[key] }

// ── Data Ribbon ───────────────────────────────────────────────────────────────

const toggleRibbonKey = (key) => {
  if (settings.ribbonHiddenKeys.includes(key)) {
    settings.ribbonHiddenKeys = settings.ribbonHiddenKeys.filter(k => k !== key)
  } else {
    settings.ribbonHiddenKeys = [...settings.ribbonHiddenKeys, key]
  }
}

const isRibbonKeyVisible = (key) => !settings.ribbonHiddenKeys.includes(key)

const orderedAvailableKeys = computed({
  get: () => {
    const available = new Set(telemetry.availableKeys)
    const userOrder = settings.dataCardOrder.filter(k => available.has(k))
    const newKeys = telemetry.availableKeys.filter(k => !settings.dataCardOrder.includes(k))
    return [...userOrder, ...newKeys]
  },
  set: (newOrder) => { settings.dataCardOrder = newOrder }
})

// ── Alarm thresholds ──────────────────────────────────────────────────────────

const alarmDraft = reactive({})

watchEffect(() => {
  telemetry.availableKeys.forEach(key => {
    if (!(key in alarmDraft)) {
      const stored = settings.alarmThresholds[key]
      alarmDraft[key] = {
        alertLower: stored?.alert?.lower ?? '',
        alertUpper: stored?.alert?.upper ?? '',
        alarmLower: stored?.alarm?.lower ?? '',
        alarmUpper: stored?.alarm?.upper ?? '',
      }
    }
  })
})

const commitAlarm = (key) => {
  const d = alarmDraft[key]
  const parse = (v) => (v === '' || v === null || v === undefined) ? null : Number(v)
  const alert = { lower: parse(d.alertLower), upper: parse(d.alertUpper) }
  const alarm = { lower: parse(d.alarmLower), upper: parse(d.alarmUpper) }
  const hasAny = Object.values(alert).some(v => v !== null) || Object.values(alarm).some(v => v !== null)
  if (!hasAny) {
    const updated = { ...settings.alarmThresholds }
    delete updated[key]
    settings.alarmThresholds = updated
  } else {
    settings.alarmThresholds = { ...settings.alarmThresholds, [key]: { alert, alarm } }
  }
}

const clearAlarm = (key) => {
  alarmDraft[key] = { alertLower: '', alertUpper: '', alarmLower: '', alarmUpper: '' }
  const updated = { ...settings.alarmThresholds }
  delete updated[key]
  settings.alarmThresholds = updated
}

const hasAlarm = (key) => {
  const t = settings.alarmThresholds[key]
  if (!t) return false
  return [t.alert?.lower, t.alert?.upper, t.alarm?.lower, t.alarm?.upper].some(v => v !== null && v !== undefined)
}

// ── Settings import / export ──────────────────────────────────────────────────

const fileInput = ref(null)

const downloadSettings = () => {
  const data = JSON.stringify(settings.$state, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${new Date().toISOString().split('T')[0]}.echook_settings`
  link.click()
  URL.revokeObjectURL(url)
}

const triggerFileLoad = () => { fileInput.value.click() }

const handleFileLoad = (event) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try { settings.importSettings(JSON.parse(e.target.result)) }
    catch (err) { console.error('Failed to load settings file', err) }
  }
  reader.readAsText(file)
}

// ── Admin mode ────────────────────────────────────────────────────────────────

const showAdminPrompt    = ref(false)
const adminPasswordInput = ref('')
const adminPasswordError = ref('')
const newAdminPassword   = ref('')
const passwordChangeMsg  = ref(null)

const submitAdminPassword = () => {
  if (adminPasswordInput.value === settings.adminPassword) {
    settings.isAdminMode     = true
    showAdminPrompt.value    = false
    adminPasswordInput.value = ''
    adminPasswordError.value = ''
  } else {
    adminPasswordError.value = 'Incorrect password.'
  }
}

const changeAdminPassword = () => {
  if (!newAdminPassword.value.trim()) return
  settings.adminPassword = newAdminPassword.value.trim()
  newAdminPassword.value = ''
  passwordChangeMsg.value = { ok: true, text: 'Password updated.' }
  setTimeout(() => { passwordChangeMsg.value = null }, 3000)
}

// ── Metric precision ─────────────────────────────────────────────────────────

const setMetricPrecision = (key, dp) => {
  const updated = { ...settings.metricPrecision }
  if (dp === null) delete updated[key]
  else updated[key] = dp
  settings.metricPrecision = updated
}

// ── Keybindings ───────────────────────────────────────────────────────────────

const recordingKey = ref(null)

const BINDING_LABELS = {
  cycleTab:    { label: 'Cycle Tab',      desc: 'Cycle through Graph → Map → Laps' },
  pauseResume: { label: 'Pause / Resume', desc: 'Pause or resume live data' },
  zoomRace:    { label: 'Zoom to Race',   desc: 'Zoom chart to the full current race' },
  unlockZoom:  { label: 'Unlock Zoom',    desc: 'Return to live scrolling' },
  panLeft:     { label: 'Pan Left',       desc: 'Pan chart back 1 minute' },
  panRight:    { label: 'Pan Right',      desc: 'Pan chart forward 1 minute' },
  zoomIn:      { label: 'Zoom In',        desc: 'Zoom chart in 20%' },
  zoomOut:     { label: 'Zoom Out',       desc: 'Zoom chart out 20%' },
  focusMode:   { label: 'Focus Mode',     desc: 'Toggle focus mode (hide chrome)' },
}

const formatKey = (key) => {
  if (!key) return '—'
  const map = { ' ': 'Space', 'ArrowLeft': '← Left', 'ArrowRight': '→ Right',
                'ArrowUp': '↑ Up', 'ArrowDown': '↓ Down', 'Tab': 'Tab',
                'Escape': 'Esc', 'Enter': 'Enter', 'Backspace': 'Backspace' }
  return map[key] || key.toUpperCase()
}

const startRecording = (action) => { recordingKey.value = action }

const onCaptureKey = (e) => {
  if (!recordingKey.value) return
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') { recordingKey.value = null; return }
  settings.keyBindings = { ...settings.keyBindings, [recordingKey.value]: e.key }
  recordingKey.value = null
}

const clearBinding = (action) => {
  settings.keyBindings = { ...settings.keyBindings, [action]: null }
}

const resetBindings = () => {
  settings.keyBindings = {
    cycleTab: 'Tab', pauseResume: ' ', zoomRace: 'r', unlockZoom: 'l',
    panLeft: 'ArrowLeft', panRight: 'ArrowRight', zoomIn: 'ArrowUp', zoomOut: 'ArrowDown',
    focusMode: 'f',
  }
}

// ── QR Code ───────────────────────────────────────────────────────────────────

const qrDataUrl    = ref('')
const networkUrls  = ref([])
const isLocal      = ref(false)

onMounted(async () => {
  try {
    const [networkRes, localRes] = await Promise.all([
      fetch('/api/network-info'),
      fetch('/api/is-local'),
    ])
    const { ips, port } = await networkRes.json()
    const { isLocal: local } = await localRes.json()
    isLocal.value = local
    networkUrls.value = ips.map(ip => `http://${ip}:${port}`)
    const target = networkUrls.value[0] || window.location.origin
    qrDataUrl.value = await QRCode.toDataURL(target, {
      width:  220,
      margin: 2,
      color:  { dark: '#ffffff', light: '#262626' },
    })
  } catch (err) {
    console.error('QR code generation failed:', err)
  }
})
</script>

<template>
  <div class="h-full overflow-y-auto bg-neutral-900 text-gray-300 p-6">
    <div class="max-w-4xl mx-auto space-y-4">

      <!-- Page header + menu -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-white">Settings</h2>

        <Menu as="div" class="relative">
          <MenuButton class="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-gray-400 hover:text-white">
            <EllipsisVerticalIcon class="w-6 h-6" />
          </MenuButton>
          <Transition enter-active-class="transition duration-100 ease-out"
            enter-from-class="transform scale-95 opacity-0" enter-to-class="transform scale-100 opacity-100"
            leave-active-class="transition duration-75 ease-in" leave-from-class="transform scale-100 opacity-100"
            leave-to-class="transform scale-95 opacity-0">
            <MenuItems
              class="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-neutral-700 rounded-xl bg-neutral-800 shadow-2xl ring-1 ring-white/5 focus:outline-none z-50">
              <div class="px-1 py-1">
                <MenuItem v-slot="{ active }">
                  <button @click="downloadSettings" :class="[
                    active ? 'bg-primary text-white' : 'text-gray-300',
                    'group flex w-full items-center rounded-lg px-3 py-2 text-sm'
                  ]">
                    <ArrowDownTrayIcon class="mr-2 h-5 w-5" />
                    Download Settings
                  </button>
                </MenuItem>
                <MenuItem v-slot="{ active }">
                  <button @click="triggerFileLoad" :class="[
                    active ? 'bg-primary text-white' : 'text-gray-300',
                    'group flex w-full items-center rounded-lg px-3 py-2 text-sm'
                  ]">
                    <ArrowUpTrayIcon class="mr-2 h-5 w-5" />
                    Load Settings
                  </button>
                </MenuItem>
              </div>
            </MenuItems>
          </Transition>
        </Menu>

        <input type="file" ref="fileInput" class="hidden" accept=".echook_settings,application/json"
          @change="handleFileLoad" />
      </div>

      <!-- ── QR Code ─────────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('qr')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <div>
            <h3 class="text-lg font-semibold text-white">Open on Another Device</h3>
            <p class="text-xs text-gray-500 mt-0.5">Scan to open the dashboard on a phone or tablet</p>
          </div>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="openSections.qr ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.qr" class="px-6 pb-6 border-t border-neutral-700 pt-4">
          <div v-if="!qrDataUrl" class="text-sm text-gray-500 italic">
            Generating QR code…
          </div>
          <div v-else class="flex flex-col items-center gap-4">
            <img :src="qrDataUrl" alt="Dashboard QR code" class="rounded-lg" width="220" height="220" />
            <div class="text-center space-y-1">
              <p v-for="url in networkUrls" :key="url" class="text-xs font-mono text-primary">{{ url }}</p>
              <p v-if="networkUrls.length === 0" class="text-xs text-gray-500">
                No network interfaces found — are you connected to a network?
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Admin ───────────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('admin')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white flex items-center gap-2">
            <ShieldCheckIcon class="w-5 h-5 text-primary" />
            Admin
          </h3>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="openSections.admin ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.admin" class="px-6 pb-6 border-t border-neutral-700 pt-4">
          <div v-if="settings.isAdminMode" class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-white">Admin mode</p>
                <p class="text-xs text-gray-500 mt-0.5">Admin tab is visible in the sidebar.</p>
              </div>
              <button @click="settings.isAdminMode = false"
                class="relative w-11 h-6 rounded-full bg-primary transition-colors duration-200 flex-shrink-0 focus:outline-none">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 translate-x-5" />
              </button>
            </div>

            <div class="pt-3 border-t border-neutral-700">
              <p class="text-xs font-medium text-gray-400 mb-2">Change admin password</p>
              <div class="flex gap-2">
                <input v-model="newAdminPassword" type="password" placeholder="New password"
                  class="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none transition" />
                <button @click="changeAdminPassword" :disabled="!newAdminPassword.trim()"
                  class="px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition">
                  Save
                </button>
              </div>
              <p v-if="passwordChangeMsg" class="text-xs mt-1.5"
                :class="passwordChangeMsg.ok ? 'text-green-400' : 'text-red-400'">
                {{ passwordChangeMsg.text }}
              </p>
            </div>
          </div>

          <div v-else class="space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-white">Admin mode</p>
                <p class="text-xs text-gray-500 mt-0.5">Enter the admin password to unlock.</p>
              </div>
              <button @click="showAdminPrompt = !showAdminPrompt"
                class="relative w-11 h-6 rounded-full bg-neutral-700 transition-colors duration-200 flex-shrink-0 focus:outline-none">
                <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 translate-x-0" />
              </button>
            </div>

            <Transition enter-active-class="transition-all duration-200" enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0" leave-active-class="transition-all duration-150"
              leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 -translate-y-1">
              <div v-if="showAdminPrompt" class="flex gap-2">
                <input v-model="adminPasswordInput" type="password" placeholder="Admin password"
                  @keydown.enter="submitAdminPassword"
                  class="flex-1 bg-neutral-900 border rounded-lg px-3 py-2 text-sm text-white focus:ring-1 outline-none transition"
                  :class="adminPasswordError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-neutral-700 focus:border-primary focus:ring-primary'" />
                <button @click="submitAdminPassword" :disabled="!adminPasswordInput.trim()"
                  class="px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition">
                  Unlock
                </button>
              </div>
            </Transition>
            <p v-if="adminPasswordError" class="text-xs text-red-400">{{ adminPasswordError }}</p>
          </div>
        </div>
      </section>

      <!-- ── Theme ───────────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('theme')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white">Theme</h3>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="openSections.theme ? 'rotate-180' : ''" />
        </button>
        <div v-show="openSections.theme" class="px-6 pb-6 border-t border-neutral-700 pt-4">
          <ThemePicker />
        </div>
      </section>

      <!-- ── Data Ribbon ─────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('ribbon')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white">Data Ribbon</h3>
          <div class="flex items-center gap-3">
            <div class="flex rounded-lg bg-neutral-900 p-1 gap-1" @click.stop>
              <button v-for="opt in [{ label: 'Scroll', value: 'scroll' }, { label: 'Wrap', value: 'wrap' }]"
                :key="opt.value" @click="settings.ribbonOverflow = opt.value"
                class="px-3 py-1 text-xs font-bold rounded-md transition-all duration-150"
                :class="settings.ribbonOverflow === opt.value
                  ? 'bg-primary text-white shadow'
                  : 'text-gray-400 hover:text-white'">
                {{ opt.label }}
              </button>
            </div>
            <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
              :class="openSections.ribbon ? 'rotate-180' : ''" />
          </div>
        </button>

        <div v-show="openSections.ribbon" class="px-6 pb-6 border-t border-neutral-700 pt-4">
          <p class="text-xs text-gray-500 mb-4">
            Toggle which metrics appear in the ribbon and set alarm thresholds.
            Drag rows to reorder — the ribbon updates immediately.
            Threshold values use your current display units (mph, °C etc.)
          </p>

          <div v-if="telemetry.availableKeys.length === 0"
            class="text-center py-6 border-2 border-dashed border-neutral-700 rounded-lg text-gray-500 text-sm">
            No telemetry data yet — cards will appear here once connected.
          </div>

          <draggable v-else v-model="orderedAvailableKeys" item-key="key" handle=".drag-handle"
            :animation="150" class="space-y-2">
            <template #item="{ element: key }">
              <div class="rounded-lg border transition-colors duration-150"
                :class="hasAlarm(key) ? 'border-red-500/30 bg-red-500/5' : 'border-neutral-700/60 bg-neutral-900/30'">
                <div class="flex items-center justify-between px-3 py-2.5 gap-3">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="drag-handle cursor-grab active:cursor-grabbing text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 px-0.5"
                      title="Drag to reorder">
                      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="9"  cy="5"  r="1.5"/><circle cx="15" cy="5"  r="1.5"/>
                        <circle cx="9"  cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                        <circle cx="9"  cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                      </svg>
                    </div>
                    <span class="w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-200"
                      :class="hasAlarm(key) ? 'bg-red-500 animate-pulse' : 'bg-neutral-600'"/>
                    <div class="min-w-0">
                      <p class="text-sm font-medium text-gray-200 truncate">{{ telemetry.getDisplayName(key) }}</p>
                      <p class="text-xs text-gray-500">{{ key }}</p>
                    </div>
                  </div>
                  <button type="button" @click="toggleRibbonKey(key)"
                    :class="isRibbonKeyVisible(key) ? 'bg-primary' : 'bg-neutral-600'"
                    class="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-neutral-900">
                    <span :class="isRibbonKeyVisible(key) ? 'translate-x-6' : 'translate-x-1'"
                      class="inline-block h-4 w-4 transform rounded-full bg-white transition" />
                  </button>
                </div>

                <div class="px-3 pb-3 space-y-2">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-semibold text-orange-400 w-9 flex-shrink-0">Alert</span>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs text-gray-500">below</span>
                      <input type="number" step="any" v-model="alarmDraft[key].alertLower" @change="commitAlarm(key)" placeholder="—"
                        class="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none transition" />
                    </div>
                    <span class="text-neutral-600 text-xs">·</span>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs text-gray-500">above</span>
                      <input type="number" step="any" v-model="alarmDraft[key].alertUpper" @change="commitAlarm(key)" placeholder="—"
                        class="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-orange-400 focus:ring-1 focus:ring-orange-400 outline-none transition" />
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs font-semibold text-red-400 w-9 flex-shrink-0">Alarm</span>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs text-gray-500">below</span>
                      <input type="number" step="any" v-model="alarmDraft[key].alarmLower" @change="commitAlarm(key)" placeholder="—"
                        class="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition" />
                    </div>
                    <span class="text-neutral-600 text-xs">·</span>
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs text-gray-500">above</span>
                      <input type="number" step="any" v-model="alarmDraft[key].alarmUpper" @change="commitAlarm(key)" placeholder="—"
                        class="w-20 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-white font-mono focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition" />
                    </div>
                    <button v-if="hasAlarm(key)" @click="clearAlarm(key)"
                      class="ml-auto text-xs text-red-400/70 hover:text-red-400 transition-colors">
                      Clear all
                    </button>
                  </div>
                </div>
              </div>
            </template>
          </draggable>

          <div v-if="settings.ribbonHiddenKeys.length > 0" class="mt-4 pt-4 border-t border-neutral-700 flex justify-end">
            <button @click="settings.ribbonHiddenKeys = []"
              class="text-xs text-gray-500 hover:text-white transition">
              Show all cards
            </button>
          </div>
        </div>
      </section>

      <!-- ── Keyboard Shortcuts ──────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('keybindings')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white">Keyboard Shortcuts</h3>
          <div class="flex items-center gap-3">
            <button @click.stop="resetBindings"
              class="text-xs text-gray-500 hover:text-white transition px-2 py-1 rounded">
              Reset to defaults
            </button>
            <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
              :class="openSections.keybindings ? 'rotate-180' : ''" />
          </div>
        </button>

        <div v-show="openSections.keybindings" class="px-6 pb-6 border-t border-neutral-700 pt-4">
          <p class="text-xs text-gray-500 mb-4">Click a key badge to remap it, then press any key. Press Escape to cancel.</p>
          <div class="space-y-1" @keydown="onCaptureKey" tabindex="-1">
            <div v-for="(meta, action) in BINDING_LABELS" :key="action"
              class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-neutral-700/30 transition">
              <div class="min-w-0 mr-4">
                <p class="text-sm font-medium text-white">{{ meta.label }}</p>
                <p class="text-xs text-gray-500">{{ meta.desc }}</p>
              </div>
              <div class="flex items-center gap-2 flex-shrink-0">
                <button @click="startRecording(action)"
                  class="px-3 py-1 rounded-md text-xs font-mono font-bold border transition min-w-[4rem] text-center"
                  :class="recordingKey === action
                    ? 'border-primary bg-primary/10 text-primary animate-pulse'
                    : settings.keyBindings[action]
                      ? 'border-neutral-600 bg-neutral-900 text-gray-200 hover:border-primary'
                      : 'border-neutral-700 bg-neutral-900/50 text-gray-600 hover:border-neutral-500'">
                  {{ recordingKey === action ? 'Press key…' : formatKey(settings.keyBindings[action]) }}
                </button>
                <button v-if="settings.keyBindings[action]" @click="clearBinding(action)"
                  class="text-gray-600 hover:text-red-400 transition p-1 rounded">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div v-else class="w-5" />
              </div>
            </div>
          </div>
          <div class="pt-4 border-t border-neutral-700 mt-4 flex justify-end">
            <button @click="settings.showShortcutsModal = true"
              class="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded transition text-sm font-medium flex items-center">
              <InformationCircleIcon class="w-4 h-4 mr-2" />
              View Keyboard Shortcuts
            </button>
          </div>
        </div>
      </section>

      <!-- ── Live Standings ────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('standings')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <div>
            <h3 class="text-lg font-semibold text-white">Live Timing</h3>
            <p class="text-xs text-gray-500 mt-0.5">SpeedHive event code shown in the Live Timing tab</p>
          </div>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0"
            :class="openSections.standings ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.standings" class="px-6 pb-6 border-t border-neutral-700 pt-4 space-y-3">
          <input v-model="settings.standingsCode" type="text"
            placeholder="e.g. UYRPNDLQ-2147486040"
            :disabled="!isLocal"
            class="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white font-mono
                   focus:border-primary focus:ring-1 focus:ring-primary outline-none transition
                   disabled:opacity-50 disabled:cursor-not-allowed" />
          <div class="flex gap-2 items-start">
            <p v-if="!isLocal" class="flex-1 text-xs text-gray-500 italic">
              Live Timing can only be configured from the host computer.
            </p>
            <p v-else class="flex-1 text-xs text-gray-600">
              The event code from the SpeedHive URL — the part after <span class="text-gray-500 font-mono">/livetiming/</span>.
              The app will always load the active session automatically.
            </p>
            <button v-if="settings.standingsCode && isLocal" @click="settings.standingsCode = ''"
              class="text-xs text-gray-600 hover:text-red-400 transition flex-shrink-0">
              Clear
            </button>
          </div>
        </div>
      </section>

      <!-- ── Units ───────────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('units')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white">Units</h3>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="openSections.units ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.units" class="px-6 pb-6 border-t border-neutral-700 pt-4 space-y-5">

          <!-- Speed -->
          <div class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-neutral-700/30 transition">
            <span class="text-sm text-gray-300">Speed Unit</span>
            <div class="flex w-44 flex-shrink-0 gap-1">
              <button v-for="opt in [{ v:'mph', l:'mph' }, { v:'kph', l:'km/h' }, { v:'ms', l:'m/s' }]" :key="opt.v"
                @click="settings.unitSettings.speedUnit = opt.v"
                class="flex-1 py-0.5 rounded text-xs font-mono font-semibold transition"
                :class="settings.unitSettings.speedUnit === opt.v
                  ? 'bg-primary text-white'
                  : 'bg-neutral-700 text-gray-400 hover:bg-neutral-600 hover:text-white'">
                {{ opt.l }}
              </button>
            </div>
          </div>

          <!-- Temperature -->
          <div class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-neutral-700/30 transition">
            <span class="text-sm text-gray-300">Temperature Unit</span>
            <div class="flex w-44 flex-shrink-0 gap-1">
              <button v-for="opt in [{ v:'c', l:'°C' }, { v:'f', l:'°F' }]" :key="opt.v"
                @click="settings.unitSettings.tempUnit = opt.v"
                class="flex-1 py-0.5 rounded text-xs font-mono font-semibold transition"
                :class="settings.unitSettings.tempUnit === opt.v
                  ? 'bg-primary text-white'
                  : 'bg-neutral-700 text-gray-400 hover:bg-neutral-600 hover:text-white'">
                {{ opt.l }}
              </button>
            </div>
          </div>

          <!-- Metric Precision -->
          <div>
            <label class="block text-xs font-bold uppercase text-gray-500 mb-2">Metric Precision</label>
            <p class="text-xs text-gray-600 mb-3">Override decimal places per metric. Auto uses the default.</p>
            <div class="space-y-1">
              <div v-for="key in [...settings.metricKeys].sort((a, b) => telemetry.getDisplayName(a).localeCompare(telemetry.getDisplayName(b)))"
                :key="key"
                class="flex items-center justify-between py-1.5 px-2 rounded hover:bg-neutral-700/30 transition">
                <span class="text-sm text-gray-300 truncate flex-1">{{ telemetry.getDisplayName(key) }}</span>
                <div class="flex w-44 flex-shrink-0 gap-1">
                  <button v-for="opt in [null, 0, 1, 2, 3]" :key="String(opt)"
                    @click="setMetricPrecision(key, opt)"
                    class="flex-1 py-0.5 rounded text-xs font-mono font-semibold transition"
                    :class="(settings.metricPrecision[key] ?? null) === opt
                      ? 'bg-primary text-white'
                      : 'bg-neutral-700 text-gray-400 hover:bg-neutral-600 hover:text-white'">
                    {{ opt === null ? 'Auto' : opt }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Performance and Visuals ─────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('performance')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white">Performance and Visuals</h3>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="openSections.performance ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.performance" class="px-6 pb-6 border-t border-neutral-700 pt-4 space-y-6">
          <div>
            <div class="flex justify-between mb-2">
              <label class="text-sm font-medium text-gray-300">Max History Points</label>
              <span class="text-sm font-mono text-primary">{{ settings.maxHistoryPoints.toLocaleString() }}</span>
            </div>
            <input type="range" v-model.number="settings.maxHistoryPoints" min="5000" max="50000" step="1000"
              class="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary" />
            <p class="text-xs text-gray-500 mt-1">Lower values improve performance on slower devices. (Default: 50,000)</p>
          </div>

          <div>
            <div class="flex justify-between mb-2">
              <label class="text-sm font-medium text-gray-300">Graph Height</label>
              <span class="text-sm font-mono text-primary">{{ settings.graphSettings.graphHeight }}px</span>
            </div>
            <input type="range" v-model.number="settings.graphSettings.graphHeight" min="200" max="800" step="10"
              class="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary" />
          </div>

          <div>
            <div class="flex justify-between mb-2">
              <label class="text-sm font-medium text-gray-300">Rolling Average</label>
              <span class="text-sm font-mono text-primary">
                {{ settings.graphSettings.rollingAverage === 0 ? 'Off' : settings.graphSettings.rollingAverage + ' pts' }}
              </span>
            </div>
            <div class="flex gap-1.5">
              <button v-for="opt in [{ label: 'Off', value: 0 }, { label: '5', value: 5 }, { label: '10', value: 10 }, { label: '25', value: 25 }, { label: '50', value: 50 }]"
                :key="opt.value" @click="settings.graphSettings.rollingAverage = opt.value"
                class="flex-1 py-1.5 rounded-lg text-xs font-bold transition border"
                :class="settings.graphSettings.rollingAverage === opt.value
                  ? 'bg-primary border-primary text-white'
                  : 'border-neutral-700 text-gray-500 hover:text-white hover:border-neutral-500'">
                {{ opt.label }}
              </button>
            </div>
            <p class="text-xs text-gray-600 mt-1.5">Smooths lines by averaging over the last N data points.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <SwitchGroup>
              <div class="flex items-center">
                <SwitchLabel class="mr-4 text-sm font-medium text-gray-300 w-32">Graph Animations</SwitchLabel>
                <Switch v-model="settings.graphSettings.showAnimations"
                  :class="settings.graphSettings.showAnimations ? 'bg-primary' : 'bg-neutral-600'"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-neutral-900">
                  <span :class="settings.graphSettings.showAnimations ? 'translate-x-6' : 'translate-x-1'"
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition" />
                </Switch>
              </div>
            </SwitchGroup>

            <SwitchGroup>
              <div class="flex items-center">
                <SwitchLabel class="mr-4 text-sm font-medium text-gray-300 w-32">Lap Highlights</SwitchLabel>
                <Switch v-model="settings.graphSettings.showLapHighlights"
                  :class="settings.graphSettings.showLapHighlights ? 'bg-primary' : 'bg-neutral-600'"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-neutral-900">
                  <span :class="settings.graphSettings.showLapHighlights ? 'translate-x-6' : 'translate-x-1'"
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition" />
                </Switch>
              </div>
            </SwitchGroup>

            <SwitchGroup>
              <div class="flex items-center">
                <SwitchLabel class="mr-4 text-sm font-medium text-gray-300 w-32">Show Grid</SwitchLabel>
                <Switch v-model="settings.graphSettings.showGrid"
                  :class="settings.graphSettings.showGrid ? 'bg-primary' : 'bg-neutral-600'"
                  class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-neutral-900">
                  <span :class="settings.graphSettings.showGrid ? 'translate-x-6' : 'translate-x-1'"
                    class="inline-block h-4 w-4 transform rounded-full bg-white transition" />
                </Switch>
              </div>
            </SwitchGroup>
          </div>
        </div>
      </section>

      <!-- ── Raw Data ──────────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('rawData')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <div>
            <h3 class="text-lg font-semibold text-white">Raw Live Data</h3>
            <p class="text-xs text-gray-500 mt-0.5">Decoded packet as received — no unit scaling or filtering</p>
          </div>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0"
            :class="openSections.rawData ? 'rotate-180' : ''" />
        </button>

        <div v-if="openSections.rawData" class="border-t border-neutral-700">
          <div v-if="Object.keys(telemetry.rawLiveData).length === 0"
            class="px-6 py-8 text-center text-gray-500 text-sm italic">
            No data received yet.
          </div>
          <table v-else class="w-full text-sm">
            <thead class="bg-neutral-900">
              <tr>
                <th class="px-6 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-500 w-1/2">Key</th>
                <th class="px-6 py-2 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Value</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-700/50">
              <tr v-for="(value, key) in telemetry.rawLiveData" :key="key"
                class="hover:bg-neutral-700/30 transition font-mono">
                <td class="px-6 py-1.5 text-primary text-xs">{{ key }}</td>
                <td class="px-6 py-1.5 text-gray-200 text-xs">{{ value }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

    </div>
  </div>
</template>
