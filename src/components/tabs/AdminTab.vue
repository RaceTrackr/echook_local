<!--
  @file components/tabs/AdminTab.vue
  @brief Admin panel — server settings, saved cars, and team settings.
-->
<script setup>
import { ref, reactive } from 'vue'
import { useSettingsStore, DEFAULT_METRIC_KEYS } from '../../stores/settings'
import { useServerSettings } from '../../composables/useServerSettings'
import { useTelemetryStore } from '../../stores/telemetry'
import { getDisplayName } from '../../utils/telemetryKeys'
import { ChevronDownIcon, XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'

const settings = useSettingsStore()
const telemetry = useTelemetryStore()
const {
  isFetching, isPushing, fetchError, pushError, lastSyncedAt,
  pushToServer, resetToServer, resetAllToDefaults,
} = useServerSettings()

// ── Collapsible sections ──────────────────────────────────────────────────────

const openSections = reactive({ server: false, savedCars: false, teamSettings: false, metrics: false })
const toggleSection = (key) => { openSections[key] = !openSections[key] }

// ── Metrics ───────────────────────────────────────────────────────────────────

const newMetricKey = ref('')
const metricError  = ref('')

const isHidden = (key) => settings.hiddenMetricKeys.includes(key)

const hideMetric = (key) => {
  if (!settings.hiddenMetricKeys.includes(key))
    settings.hiddenMetricKeys = [...settings.hiddenMetricKeys, key]
}

const unhideMetric = (key) => {
  settings.hiddenMetricKeys = settings.hiddenMetricKeys.filter(k => k !== key)
}

const addMetric = () => {
  const key = newMetricKey.value.trim()
  if (!key) return
  if (settings.metricKeys.includes(key)) {
    // If it exists but is hidden, just unhide it
    if (isHidden(key)) { unhideMetric(key); newMetricKey.value = ''; metricError.value = ''; return }
    metricError.value = 'Already in the list.'
    return
  }
  settings.metricKeys = [...settings.metricKeys, key]
  newMetricKey.value = ''
  metricError.value  = ''
}

const resetMetrics = () => {
  settings.metricKeys       = [...DEFAULT_METRIC_KEYS]
  settings.hiddenMetricKeys = []
}

// ── Server settings ───────────────────────────────────────────────────────────

const confirmReset = ref(false)

// ── Saved Cars ────────────────────────────────────────────────────────────────

const editingCarId    = ref(null)
const editingCarDraft = ref({ name: '', id: '' })
const isAddingCar     = ref(false)
const newCar          = ref({ name: '', id: '' })
const carError        = ref('')

const startEdit = (car) => {
  editingCarId.value    = car.id
  editingCarDraft.value = { name: car.name, id: car.id }
  carError.value        = ''
}
const cancelEdit = () => { editingCarId.value = null; carError.value = '' }
const saveEdit = () => {
  const name = editingCarDraft.value.name.trim()
  const id   = editingCarDraft.value.id.trim()
  if (!name || !id) { carError.value = 'Name and ID are required.'; return }
  settings.savedCars = settings.savedCars.map(c =>
    c.id === editingCarId.value ? { ...c, name, id } : c
  )
  editingCarId.value = null
  carError.value     = ''
}
const deleteCar = (id) => {
  settings.savedCars = settings.savedCars.filter(c => c.id !== id)
  if (editingCarId.value === id) editingCarId.value = null
}
const startAdd  = () => { newCar.value = { name: '', id: '' }; isAddingCar.value = true; carError.value = '' }
const cancelAdd = () => { isAddingCar.value = false; carError.value = '' }
const saveNewCar = () => {
  const name = newCar.value.name.trim()
  const id   = newCar.value.id.trim()
  if (!name || !id) { carError.value = 'Name and ID are required.'; return }
  if (settings.savedCars.some(c => c.id === id)) { carError.value = 'A car with this ID is already saved.'; return }
  settings.savedCars = [{ name, id, savedAt: Date.now() }, ...settings.savedCars]
  isAddingCar.value  = false
  carError.value     = ''
}

// ── Team Settings ─────────────────────────────────────────────────────────────

const onBadgeUpload = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const img = new Image()
  const url = URL.createObjectURL(file)
  img.onload = () => {
    const MAX = 256
    const scale = Math.min(1, MAX / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(img.width  * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    settings.teamBadge = canvas.toDataURL('image/png')
  }
  img.src = url
}

const onBgUpload = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const img = new Image()
  const url = URL.createObjectURL(file)
  img.onload = () => {
    const MAX = 1920
    const scale = Math.min(1, MAX / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width  = Math.round(img.width  * scale)
    canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    settings.loginBackground = canvas.toDataURL('image/jpeg', 0.82)
  }
  img.src = url
}
</script>

<template>
  <div class="h-full overflow-y-auto bg-neutral-900 text-gray-300 p-6">
    <div class="max-w-4xl mx-auto space-y-4">

      <h2 class="text-2xl font-bold text-white mb-4">Admin</h2>

      <!-- ── Server Settings ───────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('server')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white">Server Settings</h3>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="openSections.server ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.server" class="px-6 pb-6 border-t border-neutral-700">
          <p class="text-xs text-gray-500 mt-4 mb-5">
            Settings are loaded from the server when any device connects.
            Save to Server makes your current settings the shared baseline for all devices.
            Reset to Server discards any local changes and reverts to the shared baseline.
          </p>

          <div v-if="lastSyncedAt" class="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Last synced {{ lastSyncedAt.toLocaleTimeString() }}
          </div>

          <div v-if="fetchError || pushError"
            class="mb-4 p-3 bg-red-900/30 border border-red-700/50 text-red-300 rounded-lg text-xs">
            {{ fetchError || pushError }}
          </div>

          <div class="flex gap-3">
            <button @click="pushToServer(true)" :disabled="isPushing"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:opacity-90
                     disabled:opacity-50 text-white text-sm font-bold rounded-lg transition active:scale-95">
              <svg v-if="isPushing" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {{ isPushing ? 'Saving…' : 'Save to Server' }}
            </button>

            <button @click="resetToServer" :disabled="isFetching"
              class="flex-1 flex items-center justify-center gap-2 py-2.5 bg-neutral-700 hover:bg-neutral-600
                     disabled:opacity-50 text-gray-200 text-sm font-semibold rounded-lg transition active:scale-95">
              <svg v-if="isFetching" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l4 4m0 0l4-4m-4 4V4" />
              </svg>
              {{ isFetching ? 'Loading…' : 'Reset to Server' }}
            </button>
          </div>

          <div v-if="settings.isAdminMode" class="mt-4 pt-4 border-t border-neutral-700">
            <p class="text-xs text-gray-500 mb-3">
              <span class="text-red-400 font-semibold">Admin only.</span>
              Clears all settings on the server and reloads every device to factory defaults.
            </p>
            <div v-if="!confirmReset">
              <button @click="confirmReset = true"
                class="w-full py-2.5 rounded-lg border border-red-700/50 text-red-400 text-sm font-semibold
                       hover:bg-red-900/20 transition">
                Reset All to Factory Defaults…
              </button>
            </div>
            <div v-else class="flex gap-2">
              <button @click="resetAllToDefaults"
                class="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition">
                Yes, reset everything
              </button>
              <button @click="confirmReset = false"
                class="flex-1 py-2.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-gray-300 text-sm font-semibold transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Saved Cars ────────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('savedCars')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white">Saved Cars</h3>
          <div class="flex items-center gap-3">
            <button @click.stop="startAdd"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg transition active:scale-95">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Car
            </button>
            <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
              :class="openSections.savedCars ? 'rotate-180' : ''" />
          </div>
        </button>

        <div v-show="openSections.savedCars" class="px-6 pb-6 border-t border-neutral-700 pt-4">
          <p v-if="carError" class="text-xs text-red-400 mb-3">{{ carError }}</p>

          <div v-if="isAddingCar" class="mb-3 p-3 rounded-lg border border-primary/30 bg-neutral-900 space-y-2">
            <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">New Car</p>
            <input v-model="newCar.name" type="text" placeholder="Name (e.g. Car 42)" @keydown.enter="saveNewCar"
              class="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white
                     focus:border-primary focus:ring-1 focus:ring-primary outline-none transition" />
            <input v-model="newCar.id" type="text" placeholder="Car ID (24-char hex)" @keydown.enter="saveNewCar"
              class="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono
                     focus:border-primary focus:ring-1 focus:ring-primary outline-none transition" />
            <div class="flex gap-2 pt-1">
              <button @click="saveNewCar"
                class="flex-1 py-1.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg transition">Save</button>
              <button @click="cancelAdd"
                class="flex-1 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-gray-300 text-xs font-semibold rounded-lg transition">Cancel</button>
            </div>
          </div>

          <div v-if="settings.savedCars.length === 0 && !isAddingCar"
            class="text-center py-8 border-2 border-dashed border-neutral-700 rounded-lg text-gray-500 text-sm">
            No saved cars yet — connect with a Car ID on the login page to add one.
          </div>

          <div class="space-y-2">
            <div v-for="car in settings.savedCars" :key="car.id"
              class="rounded-lg border transition-colors"
              :class="editingCarId === car.id ? 'border-primary/40 bg-neutral-900' : 'border-neutral-700 bg-neutral-900/40'">

              <div v-if="editingCarId !== car.id" class="flex items-center gap-3 px-3 py-2.5">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-white truncate">{{ car.name }}</p>
                  <p class="text-xs text-gray-500 font-mono truncate">{{ car.id }}</p>
                </div>
                <button @click="startEdit(car)" class="text-gray-500 hover:text-primary transition p-1 rounded flex-shrink-0">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button @click="deleteCar(car.id)" class="text-gray-500 hover:text-red-400 transition p-1 rounded flex-shrink-0">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <div v-else class="p-3 space-y-2">
                <input v-model="editingCarDraft.name" type="text" placeholder="Name" @keydown.enter="saveEdit"
                  class="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white
                         focus:border-primary focus:ring-1 focus:ring-primary outline-none transition" />
                <input v-model="editingCarDraft.id" type="text" placeholder="Car ID" @keydown.enter="saveEdit"
                  class="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white font-mono
                         focus:border-primary focus:ring-1 focus:ring-primary outline-none transition" />
                <div class="flex gap-2 pt-1">
                  <button @click="saveEdit"
                    class="flex-1 py-1.5 bg-primary hover:opacity-90 text-white text-xs font-bold rounded-lg transition">Save</button>
                  <button @click="cancelEdit"
                    class="flex-1 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-gray-300 text-xs font-semibold rounded-lg transition">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Team Settings ─────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('teamSettings')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <h3 class="text-lg font-semibold text-white">Team Settings</h3>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200"
            :class="openSections.teamSettings ? 'rotate-180' : ''" />
        </button>

        <div v-show="openSections.teamSettings" class="px-6 pb-6 border-t border-neutral-700 pt-4 space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Team Name</label>
            <input v-model="settings.teamName" type="text" placeholder="eChook Live"
              class="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white
                     focus:border-primary focus:ring-1 focus:ring-primary outline-none transition" />
            <p class="text-xs text-gray-500 mt-1">Shown in the header and login page.</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Team Badge</label>
            <div class="flex items-start gap-3">
              <div class="w-16 h-16 rounded-lg overflow-hidden border border-neutral-700 flex-shrink-0 bg-neutral-900 flex items-center justify-center">
                <img v-if="settings.teamBadge" :src="settings.teamBadge" class="w-full h-full object-contain p-1" />
                <div v-else class="text-gray-600 text-xs text-center leading-tight px-1">No badge</div>
              </div>
              <div class="flex-1 space-y-2">
                <label class="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700
                              hover:border-primary cursor-pointer transition text-sm text-gray-300 hover:text-white">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload badge
                  <input type="file" accept="image/*" class="hidden" @change="onBadgeUpload" />
                </label>
                <button v-if="settings.teamBadge" @click="settings.teamBadge = null"
                  class="text-xs text-gray-600 hover:text-red-400 transition">Remove badge</button>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">Shown in the header and login page. PNG with transparency recommended. Resized to 256px.</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">Login Background Image</label>
            <div class="flex items-start gap-3">
              <div class="w-24 h-16 rounded-lg overflow-hidden border border-neutral-700 flex-shrink-0 bg-neutral-900">
                <img v-if="settings.loginBackground" :src="settings.loginBackground" class="w-full h-full object-cover" />
                <div v-else class="w-full h-full flex items-center justify-center text-gray-600 text-xs">Default</div>
              </div>
              <div class="flex-1 space-y-2">
                <label class="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700
                              hover:border-primary cursor-pointer transition text-sm text-gray-300 hover:text-white">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload image
                  <input type="file" accept="image/*" class="hidden" @change="onBgUpload" />
                </label>
                <button v-if="settings.loginBackground" @click="settings.loginBackground = null"
                  class="text-xs text-gray-600 hover:text-red-400 transition">Remove — use default</button>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1">Stored as base64 — keep images under ~2MB for best performance.</p>
          </div>
        </div>
      </section>

      <!-- ── Metrics ──────────────────────────────────────────────────────────── -->
      <section class="bg-neutral-800/50 rounded-lg border border-neutral-700 overflow-hidden">
        <button @click="toggleSection('metrics')"
          class="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-700/30 transition">
          <div>
            <h3 class="text-lg font-semibold text-white">Metrics</h3>
            <p class="text-xs text-gray-500 mt-0.5">Keys available for panels, graphs, and the data ribbon</p>
          </div>
          <ChevronDownIcon class="w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0"
            :class="openSections.metrics ? 'rotate-180' : ''" />
        </button>

        <div v-if="openSections.metrics" class="px-6 pb-6 space-y-5 border-t border-neutral-700 pt-4">

          <!-- Visible metrics -->
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Visible</p>
            <div class="flex flex-wrap gap-2">
              <div v-for="key in settings.metricKeys.filter(k => !isHidden(k))" :key="key"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-700 border border-neutral-600 text-sm">
                <span class="text-white font-medium">{{ getDisplayName(key) }}</span>
                <span class="text-gray-500 text-xs font-mono">({{ key }})</span>
                <button @click="hideMetric(key)" title="Hide from selectors"
                  class="text-gray-600 hover:text-yellow-400 transition ml-0.5">
                  <EyeSlashIcon class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Hidden metrics -->
          <div v-if="settings.hiddenMetricKeys.length > 0">
            <p class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Hidden</p>
            <div class="flex flex-wrap gap-2">
              <div v-for="key in settings.hiddenMetricKeys" :key="key"
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 border border-neutral-700 text-sm opacity-60">
                <span class="text-gray-400 font-medium">{{ getDisplayName(key) }}</span>
                <span class="text-gray-600 text-xs font-mono">({{ key }})</span>
                <button @click="unhideMetric(key)" title="Show in selectors"
                  class="text-gray-600 hover:text-green-400 transition ml-0.5">
                  <EyeIcon class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- Add custom key -->
          <div class="flex gap-2 items-start">
            <div class="flex-1">
              <input v-model="newMetricKey" type="text" placeholder="Add custom key name…"
                @keydown.enter="addMetric"
                class="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white
                       font-mono focus:border-primary focus:ring-1 focus:ring-primary outline-none" />
              <p v-if="metricError" class="text-xs text-red-400 mt-1">{{ metricError }}</p>
            </div>
            <button @click="addMetric"
              class="px-3 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm font-semibold transition flex-shrink-0">
              Add
            </button>
          </div>

          <button @click="resetMetrics"
            class="text-xs text-gray-600 hover:text-gray-400 transition">
            Reset to defaults (shows all)
          </button>
        </div>
      </section>

    </div>
  </div>
</template>
