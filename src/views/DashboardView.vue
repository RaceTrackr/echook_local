<!--
  @file views/DashboardView.vue
  @brief Main dashboard view for authenticated users.
  @description The primary interface for viewing telemetry data. Features a
               data ribbon with draggable cards, tabbed content area (Graph,
               Map, Laps, Settings, Admin), and keyboard shortcuts for navigation.
-->
<script setup>
/**
 * @description Dashboard view component setup.
 * 
 * Features:
 * - Real-time telemetry data display via data cards
 * - Draggable data card reordering (persisted to settings)
 * - Multiple tabs: Graph, Map, Laps, Settings, Admin (if admin)
 * - Lazy-loaded tab components for performance
 * - Keyboard shortcuts for navigation and chart control
 * - Responsive layout (mobile bottom tabs, desktop side tabs)
 */
import { onMounted, onUnmounted, ref, computed, watch, provide, shallowRef, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTelemetryStore } from '../stores/telemetry'
import { useAuthStore } from '../stores/auth'
import { useSettingsStore } from '../stores/settings'
import { useDirectConnect } from '../composables/useDirectConnect'
import { useAlarmState } from '../composables/useAlarmState'
import DashboardHeader from '../components/DashboardHeader.vue'
import DataCard from '../components/DataCard.vue'
import GraphHelpModal from '../components/GraphHelpModal.vue'
import draggable from 'vuedraggable'

// Lazy-loaded tab components for code splitting
const GraphTab     = defineAsyncComponent(() => import('../components/tabs/GraphTab.vue'))
const MapTab       = defineAsyncComponent(() => import('../components/tabs/MapTab.vue'))
const LapsTab      = defineAsyncComponent(() => import('../components/tabs/LapsTab.vue'))
const SettingsTab  = defineAsyncComponent(() => import('../components/tabs/SettingsTab.vue'))
const AdminTab     = defineAsyncComponent(() => import('../components/tabs/AdminTab.vue'))
const DashboardTab = defineAsyncComponent(() => import('../components/tabs/DashboardTab.vue'))
const GrafanaTab      = defineAsyncComponent(() => import('../components/tabs/GrafanaTab.vue'))
const StandingsTab    = defineAsyncComponent(() => import('../components/tabs/StandingsTab.vue'))

// Heroicons for tab navigation
import { ChartBarIcon, MapIcon, FlagIcon, CogIcon, ShieldCheckIcon, Squares2X2Icon, RectangleGroupIcon, TrophyIcon } from '@heroicons/vue/24/outline'

const telemetry = useTelemetryStore()
const auth = useAuthStore()
const settings = useSettingsStore()
const directConnect = useDirectConnect()
const route = useRoute()
const router = useRouter()

/** @brief Focus mode — hides header, ribbon, and sidebar so the tab fills the window */
const focusMode = ref(false)

// ── Focus-mode overlay controls ───────────────────────────────────────────────
// Controls (exit button, preset picker) are hidden when focus mode is entered
// and revealed by a tap anywhere on the content area (except alarm taps).
// Auto-hide 4 s after the last reveal tap.
const _focusControlsVisible = ref(false)
let _focusControlsTimer = null

const showFocusControls = computed(() => !focusMode.value || _focusControlsVisible.value)

const revealFocusControls = () => {
  if (!focusMode.value) return
  _focusControlsVisible.value = true
  clearTimeout(_focusControlsTimer)
  _focusControlsTimer = setTimeout(() => { _focusControlsVisible.value = false }, 4000)
}

watch(focusMode, (val) => {
  if (val) {
    _focusControlsVisible.value = false
    clearTimeout(_focusControlsTimer)
  }
})

provide('showFocusControls', showFocusControls)
provide('revealFocusControls', revealFocusControls)

/**
 * @brief Get display unit for a telemetry key.
 * @param {string} key - Telemetry key
 * @returns {string|undefined} Unit string or undefined
 */
const getDisplayUnit = (key) => {
  if (key === 'speed') return telemetry.unitSettings.speedUnit
  if (key === 'temp1' || key === 'temp2' || key === 'tempDiff') return telemetry.unitSettings.tempUnit === 'f' ? '°F' : '°C'
  return undefined
}

/**
 * @brief Ordered keys with hidden cards filtered out (for normal display).
 * @description Merges user's saved order with available telemetry keys,
 *              excluding any keys the user has hidden via Settings.
 */
const visibleOrderedKeys = computed({
  get: () => {
    const available = new Set(telemetry.availableKeys)
    const userOrder = settings.dataCardOrder.filter(k => available.has(k))
    const newKeys = telemetry.availableKeys.filter(k => !settings.dataCardOrder.includes(k))
    const ordered = [...userOrder, ...newKeys]
    return ordered.filter(k => !settings.ribbonHiddenKeys.includes(k))
  },
  set: (newOrder) => {
    settings.dataCardOrder = newOrder
  }
})

/**
 * @brief Whether a card's current value is outside its alarm thresholds.
 * @param {string} key - Telemetry key
 * @returns {boolean} True if an alarm condition is active
 */
const { getCardState, acknowledgeAlarm } = useAlarmState()

// ============================================
// Tab Configuration
// ============================================

/**
 * @brief Currently active tab ID (persisted to settings).
 */
const activeTabId = computed({
  get: () => settings.activeTabId,
  set: (val) => { settings.activeTabId = val }
})

/**
 * @brief Tab definitions with conditional admin tab.
 * @type {ComputedRef<Array<Object>>}
 */
const tabs = computed(() => {
  // NOTE: graph, dashboard, map and laps are intentionally hidden from the tab bar
  // but their components are fully intact and can be re-enabled by adding them back here.
  const baseTabs = [
    { id: 'panels',    label: 'Panels',    icon: RectangleGroupIcon, component: GrafanaTab    },
    { id: 'graph',     label: 'Graph',     icon: ChartBarIcon,       component: GraphTab      },
    { id: 'laps',      label: 'Laps',      icon: FlagIcon,           component: LapsTab       },
    { id: 'standings', label: 'Live Timing', icon: TrophyIcon,        component: StandingsTab  },
  ]

  if (settings.isAdminMode) {
    baseTabs.push({ id: 'admin', label: 'Admin', icon: ShieldCheckIcon, component: AdminTab })
  }

  return baseTabs
})

/**
 * @brief Get the component for the currently active tab.
 * @type {ComputedRef<Component>}
 */
const activeComponent = computed(() => {
  if (activeTabId.value === 'settings') return SettingsTab
  const tab = tabs.value.find(t => t.id === activeTabId.value)
  return tab ? tab.component : GraphTab
})

// URL → tab: handles address-bar navigation and initial load
watch(() => route.query.tab, (tabFromUrl) => {
  const allTabIds = ['settings', ...tabs.value.map(t => t.id)]
  const id = String(tabFromUrl ?? '')
  if (id && allTabIds.includes(id) && settings.activeTabId !== id) {
    settings.activeTabId = id
  }
}, { immediate: true })

// tab → URL: keeps the address bar in sync when tabs are clicked
watch(activeTabId, (val) => {
  if (route.query.tab !== val) {
    router.replace({ query: { tab: val } })
  }
})

// ============================================
// Lifecycle Hooks
// ============================================

// Unsubscribe handle for the direct-connect data listener
let _unsubDirectData = null

onMounted(async () => {
  if (directConnect.isDirectMode.value) {
    // ── Direct-connect mode (Car ID login) ──────────────────────────────────
    try {
      await directConnect.reconnect()
    } catch (err) {
      console.error('[Dashboard] direct reconnect failed:', err)
    }
    // Pipe each incoming packet to local history storage
    // Buffer packets and flush every 5s to avoid hammering the server
    let _packetBuffer = []
    let _flushTimer   = null

    const flushPackets = async (carId) => {
      if (!_packetBuffer.length) return
      const batch     = _packetBuffer.splice(0)
      _flushTimer     = null
      try {
        await fetch(`/api/telemetry/${encodeURIComponent(carId)}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(batch),
        })
      } catch { /* silently ignore — live data still works */ }
    }

    _unsubDirectData = directConnect.onData((packet) => {
      telemetry.ingestDirectPacket?.(packet)
      _packetBuffer.push(packet)
      if (!_flushTimer) {
        _flushTimer = setTimeout(() => flushPackets(directConnect.carId.value), 5000)
      }
    })

    // Fetch stored history from local server
    const carId = directConnect.carId.value
    if (carId) {
      // Look up the saved car name so the header can display it
      const savedCar = settings.savedCars?.find(c => c.id === carId)
      telemetry.viewingCar = {
        id:       carId,
        carName:  savedCar?.name || savedCar?.label || carId,
        teamName: '',
        number:   null,
      }
      telemetry.fetchAvailableDays?.(carId)
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      telemetry.fetchHistory?.(carId, sevenDaysAgo)
    }
  } else {
    // ── Normal authenticated mode ────────────────────────────────────────────
    telemetry.connect()
  }

  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('touchstart', handleTouchStart, { passive: true })

  // Show help modal for first-time users
  if (settings.showGraphHelp) {
    settings.showShortcutsModal = true
  }
})

onUnmounted(() => {
  if (directConnect.isDirectMode.value) {
    _unsubDirectData?.()
  } else {
    telemetry.disconnect()
  }
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('touchstart', handleTouchStart)
  clearTimeout(_focusControlsTimer)
})

// ============================================
// Keyboard Shortcuts
// ============================================

/**
 * @brief Handle keyboard shortcuts for dashboard navigation and chart control.
 * @param {KeyboardEvent} e - Keyboard event
 * 
 * Shortcuts:
 * - Tab: Cycle through Graph → Map → Laps tabs
 * - Space: Pause/Resume live data
 * - R: Zoom chart to full current race
 * - 1-9: Zoom chart to last N laps
 * - L: Unlock chart zoom (return to live scroll)
 * - Arrow keys: Pan (left/right) and zoom (up/down) chart
 */
/**
 * @brief Check if a key event matches a configured binding.
 * Comparison is case-insensitive for letter keys.
 */
const matchesBinding = (e, action) => {
  const bound = settings.keyBindings[action]
  if (!bound) return false
  return e.key === bound || e.key.toLowerCase() === bound.toLowerCase()
}

let _focusExitTime = 0

const handleTouchStart = (e) => {
  if (e.touches.length === 3 && focusMode.value) {
    focusMode.value = false
    _focusExitTime = Date.now()
  }
}

const enterFocusMode = () => {
  if (Date.now() - _focusExitTime < 600) return
  focusMode.value = true
  _focusControlsVisible.value = false
  clearTimeout(_focusControlsTimer)
}

const handleKeydown = (e) => {
  // Escape: always exits focus mode (not remappable)
  if (e.key === 'Escape' && focusMode.value) {
    focusMode.value = false
    return
  }

  // Focus mode toggle
  if (matchesBinding(e, 'focusMode') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    focusMode.value = !focusMode.value
    return
  }

  // 1. Tab Cycling — cycles through currently visible tabs only
  if (matchesBinding(e, 'cycleTab')) {
    e.preventDefault()
    const cycle = tabs.value.map(t => t.id)
    const currentIndex = cycle.indexOf(activeTabId.value)
    activeTabId.value = currentIndex === -1 ? cycle[0] : cycle[(currentIndex + 1) % cycle.length]
  }

  // 2. Pause/Resume
  if (matchesBinding(e, 'pauseResume') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    e.preventDefault()
    telemetry.togglePause()
  }

  // 3. Zoom to Full Race
  if (matchesBinding(e, 'zoomRace') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    const races = Object.values(telemetry.races).sort((a, b) => b.startTimeMs - a.startTimeMs)
    if (races.length > 0) {
      const race = races[0]
      const end = telemetry.latestTime || Date.now()
      telemetry.requestChartZoom(race.startTimeMs, end)
    }
  }

  // 4. Number Keys (1-9): Zoom to Last N Laps
  if (!isNaN(parseInt(e.key)) && parseInt(e.key) > 0 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    const n = parseInt(e.key)
    const laps = telemetry.lapHistory
    if (laps.length > 0) {
      const lapsToShow = laps.slice(-n)
      if (lapsToShow.length > 0) {
        const start = lapsToShow[0].startTime
        let end = lapsToShow[lapsToShow.length - 1].finishTime
        if (!end || end < start) end = telemetry.latestTime || Date.now()
        telemetry.requestChartZoom(start, end)
      }
    }
  }

  // 5. Unlock Zoom
  if (matchesBinding(e, 'unlockZoom') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    telemetry.requestChartUnlock()
  }

  // 6. Arrow pan/zoom — only on Graph Tab
  if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && activeTabId.value === 'graph') {
    if (matchesBinding(e, 'panLeft'))  { e.preventDefault(); telemetry.requestChartPan(-1 * 60 * 1000) }
    if (matchesBinding(e, 'panRight')) { e.preventDefault(); telemetry.requestChartPan(1 * 60 * 1000) }
    if (matchesBinding(e, 'zoomIn'))   { e.preventDefault(); telemetry.requestChartScale(0.8) }
    if (matchesBinding(e, 'zoomOut'))  { e.preventDefault(); telemetry.requestChartScale(1.2) }
  }
}
</script>

<template>
  <div class="h-[100svh] overflow-hidden bg-neutral-900 flex flex-col">
    <DashboardHeader v-show="!focusMode" />
    <GraphHelpModal :isOpen="settings.showShortcutsModal" @close="settings.showShortcutsModal = false" />

    <!-- Data Ribbon + collapse pill — desktop only, not needed on mobile -->
    <div class="hidden md:block">
      <!-- Data Ribbon — hidden on the Dashboard/Panels tab and in focus mode -->
      <div v-show="activeTabId !== 'dashboard' && activeTabId !== 'panels' && !focusMode"
        class="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur no-scrollbar transition-all duration-300 relative"
        :class="settings.ribbonCollapsed
          ? 'h-8 flex items-center justify-center cursor-pointer'
          : settings.ribbonOverflow === 'wrap'
            ? 'flex flex-col justify-center px-3 md:px-6 py-3 min-h-[5rem] md:min-h-[7rem]'
            : 'h-20 md:h-28 overflow-x-auto flex items-center px-3 md:px-6'">

        <!-- Collapsed state: plain thin strip, clickable via pill -->
        <div v-if="settings.ribbonCollapsed" />

        <!-- Expanded state: cards -->
        <template v-else>
          <draggable
            v-model="visibleOrderedKeys"
            item-key="key"
            :animation="200"
            :class="settings.ribbonOverflow === 'wrap'
              ? 'flex flex-wrap gap-2 md:gap-4 justify-center w-full'
              : 'flex flex-nowrap gap-2 md:gap-4 justify-center min-w-max mx-auto'">
            <template #item="{ element: key }">
              <div class="relative flex-shrink-0 rounded-lg transition-shadow duration-300"
                :class="{
                  'ring-2 ring-red-500 shadow-lg shadow-red-500/40': getCardState(key) === 'alert',
                  'ring-2 ring-red-500 cursor-pointer':              getCardState(key) === 'alarm',
                }"
                @click.stop="acknowledgeAlarm(key)">
                <DataCard :label="telemetry.getDisplayName(key)" :value="telemetry.displayLiveData[key]"
                  :unit="getDisplayUnit(key)" :stale="telemetry.isDataStale" />
                <div v-if="getCardState(key) === 'alert'"
                  class="absolute inset-0 rounded-lg ring-2 ring-red-400 animate-pulse pointer-events-none" />
                <div v-if="getCardState(key) === 'alarm'"
                  class="absolute inset-0 rounded-lg alarm-blink pointer-events-none" />
              </div>
            </template>
          </draggable>
          <div v-if="visibleOrderedKeys.length === 0" class="text-gray-500 text-sm italic mx-auto">
            Waiting for telemetry data...
          </div>
        </template>
      </div>

      <!-- Collapse/expand pill — hidden on Dashboard tab and in focus mode -->
      <div v-show="activeTabId !== 'dashboard' && activeTabId !== 'panels' && !focusMode" class="relative h-0 z-20 flex justify-center">
        <button
          @click="settings.ribbonCollapsed = !settings.ribbonCollapsed"
          class="absolute top-0 w-10 h-4 rounded-b-lg bg-neutral-800 border border-t-0 border-neutral-700
                 flex items-center justify-center
                 hover:bg-neutral-700 transition-colors duration-150 group"
          :title="settings.ribbonCollapsed ? 'Expand ribbon' : 'Collapse ribbon'">
          <svg class="w-3 h-3 text-gray-500 group-hover:text-gray-300 transition-transform duration-300"
            :class="settings.ribbonCollapsed ? 'rotate-180' : ''"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden">
      <!-- Desktop: Vertical Tab Sidebar (hidden on mobile, hidden in focus mode) -->
      <aside v-show="!focusMode"
        class="hidden md:flex w-16 bg-neutral-900 border-r border-neutral-800 flex-col items-center py-4 space-y-4 z-40">
        <button v-for="tab in tabs" :key="tab.id" @click="activeTabId = tab.id"
          class="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 group relative"
          :class="activeTabId === tab.id ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-neutral-800 hover:text-gray-300'"
          :title="tab.label">
          <component :is="tab.icon" class="w-6 h-6" />
          <div v-if="activeTabId === tab.id" class="absolute left-0 w-1 h-6 bg-primary rounded-r-full"></div>
        </button>

        <div class="flex-1"></div>

        <button @click="activeTabId = 'settings'"
          class="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 group"
          :class="activeTabId === 'settings' ? 'bg-primary/10 text-primary' : 'text-gray-500 hover:bg-neutral-800 hover:text-gray-300'"
          title="Settings">
          <CogIcon class="w-6 h-6" />
        </button>

        <!-- Focus mode toggle in sidebar -->
        <button
          @click="enterFocusMode"
          class="w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 text-gray-500 hover:bg-neutral-800 hover:text-gray-300"
          title="Focus mode">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2" />
          </svg>
        </button>
      </aside>

      <!-- Tab Content Area — bottom padding on mobile reserves space for the fixed nav + safe area -->
      <main class="flex-1 overflow-hidden relative md:pb-0 mobile-content-pb" @click="revealFocusControls">
        <KeepAlive>
          <component :is="activeComponent" />
        </KeepAlive>

        <!-- Iframe focus-mode intercept — captures the first tap when controls are hidden -->
        <div
          v-if="focusMode && !showFocusControls"
          class="absolute inset-0 z-30 cursor-pointer"
          @click="revealFocusControls"
        />

        <!-- Floating exit button — revealed by tapping the screen in focus mode -->
        <button
          v-if="focusMode && showFocusControls"
          @click.stop="focusMode = false"
          class="absolute top-2 left-2 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                 bg-neutral-900 border border-neutral-600
                 opacity-20 hover:opacity-100 transition-all duration-200 text-white text-xs font-medium"
          title="Exit focus mode (Esc)">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit
        </button>

        <!-- Connection Overlay -->
        <Transition enter-active-class="transition duration-500 ease-out" enter-from-class="opacity-0 translate-y-4"
          enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-300 ease-in"
          leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-4">
          <div v-if="!telemetry.isConnected"
            class="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 md:px-6 py-2 md:py-3 bg-red-900/90 backdrop-blur-md border border-red-500/50 rounded-full shadow-2xl flex items-center space-x-2 md:space-x-3 z-50 pointer-events-none">
            <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span class="text-red-100 font-bold text-xs md:text-sm tracking-wide">Reconnecting...</span>
          </div>
        </Transition>
      </main>

      <!-- Mobile: Bottom Tab Bar — fixed so it's always visible regardless of content height -->
      <nav v-show="!focusMode"
        class="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t border-neutral-800 flex items-stretch justify-around px-1 z-50 mobile-nav">
        <button v-for="tab in tabs" :key="tab.id" @click="activeTabId = tab.id"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
          :class="activeTabId === tab.id ? 'text-primary' : 'text-gray-500 hover:text-gray-300'">
          <component :is="tab.icon" class="w-5 h-5 flex-shrink-0" />
          <span class="text-[10px] font-semibold leading-none">{{ tab.label }}</span>
        </button>
        <button @click="activeTabId = 'settings'"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
          :class="activeTabId === 'settings' ? 'text-primary' : 'text-gray-500 hover:text-gray-300'">
          <CogIcon class="w-5 h-5 flex-shrink-0" />
          <span class="text-[10px] font-semibold leading-none">Settings</span>
        </button>
        <button @click="enterFocusMode"
          class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-500 hover:text-gray-300 transition-colors">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round"
              d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2" />
          </svg>
          <span class="text-[10px] font-semibold leading-none">Focus</span>
        </button>
      </nav>

    </div>
  </div>
</template>

<style>
/* Hide scrollbar for data ribbon */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Mobile nav — fixed height + safe area inset for notched phones */
.mobile-nav {
  height: calc(3.5rem + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

/* Main content bottom padding matches nav height + safe area on mobile */
@media (max-width: 767px) {
  .mobile-content-pb {
    padding-bottom: calc(3.5rem + env(safe-area-inset-bottom, 0px));
  }
}

/* Hard on/off blink for unacknowledged alarms */
@keyframes alarm-blink {
  0%, 100% {
    background-color: rgba(239, 68, 68, 0.18);
    box-shadow: 0 0 16px 2px rgba(239, 68, 68, 0.55);
  }
  50% {
    background-color: transparent;
    box-shadow: none;
  }
}
.alarm-blink {
  animation: alarm-blink 0.55s step-end infinite;
  border-radius: inherit;
}
</style>
