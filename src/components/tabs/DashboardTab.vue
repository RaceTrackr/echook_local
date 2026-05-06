<!--
  @file components/tabs/DashboardTab.vue
  @brief Full-screen metric dashboard with large data cards.
  @description Displays all (or a user-selected subset of) telemetry metrics as
               large readable cards in a responsive grid. Alarm states and
               acknowledgments are inherited from the ribbon via useAlarmState.
               Metric visibility is independently configurable via a sidebar,
               stored in settings.dashboardTabHiddenKeys.
-->
<script setup>
import { ref, computed } from 'vue'
import { useTelemetryStore } from '../../stores/telemetry'
import { useSettingsStore } from '../../stores/settings'
import { useAlarmState } from '../../composables/useAlarmState'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/24/outline'
import DataCard from '../DataCard.vue'

const telemetry = useTelemetryStore()
const settings  = useSettingsStore()
const { getCardState, acknowledgeAlarm } = useAlarmState()

// ── Metric visibility (independent from ribbon) ───────────────────────────────

const showSidebar = ref(true)

const isVisible = (key) => !settings.dashboardTabHiddenKeys.includes(key)

const toggleKey = (key) => {
    if (settings.dashboardTabHiddenKeys.includes(key)) {
        settings.dashboardTabHiddenKeys = settings.dashboardTabHiddenKeys.filter(k => k !== key)
    } else {
        settings.dashboardTabHiddenKeys = [...settings.dashboardTabHiddenKeys, key]
    }
}

const visibleKeys = computed(() =>
    telemetry.availableKeys.filter(k => isVisible(k))
)

// ── Unit helper — matches DashboardView ──────────────────────────────────────

const getDisplayUnit = (key) => {
    if (key === 'speed') return telemetry.unitSettings.speedUnit
    if (['temp1', 'temp2', 'tempDiff'].includes(key)) {
        return telemetry.unitSettings.tempUnit === 'f' ? '°F' : '°C'
    }
    return undefined
}
</script>

<template>
    <div class="flex h-full overflow-hidden">

        <!-- ── Metric Sidebar ──────────────────────────────────────────────── -->
        <aside
            class="bg-neutral-900 border-r border-neutral-800 transition-all duration-300 overflow-hidden flex flex-col"
            :class="showSidebar ? 'w-44 opacity-100' : 'w-0 opacity-0 border-r-0'">
            <div class="w-44 p-4 overflow-y-auto h-full">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-gray-400 uppercase text-xs font-bold tracking-wider">Metrics</h3>
                    <button @click="showSidebar = false" class="text-gray-500 hover:text-white transition">
                        <ChevronLeftIcon class="w-5 h-5" />
                    </button>
                </div>

                <div class="space-y-1">
                    <div v-for="key in telemetry.availableKeys" :key="key"
                        class="flex items-center gap-3 cursor-pointer hover:bg-neutral-800 p-2 rounded transition"
                        @click="toggleKey(key)">
                        <div class="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition"
                            :class="isVisible(key) ? 'bg-primary border-primary' : 'border-neutral-600'">
                            <svg v-if="isVisible(key)" class="w-3 h-3 text-white" fill="none"
                                stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3"
                                    d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <span class="text-sm truncate"
                            :class="isVisible(key) ? 'text-white' : 'text-gray-500'">
                            {{ telemetry.getDisplayName(key) }}
                        </span>
                    </div>
                </div>

                <!-- Select all / none -->
                <div class="mt-4 pt-4 border-t border-neutral-800 flex gap-3 text-xs">
                    <button @click="settings.dashboardTabHiddenKeys = []"
                        class="text-gray-500 hover:text-white transition">All</button>
                    <button @click="settings.dashboardTabHiddenKeys = [...telemetry.availableKeys]"
                        class="text-gray-500 hover:text-white transition">None</button>
                </div>
            </div>
        </aside>

        <!-- Sidebar toggle when collapsed -->
        <div v-if="!showSidebar" class="absolute top-3 left-1 z-20">
            <button @click="showSidebar = true" class="p-1 text-gray-500 hover:text-white transition">
                <ChevronRightIcon class="w-5 h-5" />
            </button>
        </div>

        <!-- ── Main Card Grid ──────────────────────────────────────────────── -->
        <main class="flex-1 overflow-y-auto bg-neutral-900 p-4">

            <!-- Empty state -->
            <div v-if="telemetry.availableKeys.length === 0"
                class="h-full flex items-center justify-center text-gray-500 text-sm">
                Waiting for telemetry data…
            </div>

            <div v-else-if="visibleKeys.length === 0"
                class="h-full flex items-center justify-center text-gray-500 text-sm">
                No metrics selected — use the sidebar to add some.
            </div>

            <div v-else class="grid gap-3"
                style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))">

                <div v-for="key in visibleKeys" :key="key"
                    class="relative rounded-lg transition-shadow duration-300"
                    :class="{
                        'ring-2 ring-red-500 shadow-lg shadow-red-500/30': getCardState(key) === 'alert',
                        'ring-2 ring-red-500 cursor-pointer':              getCardState(key) === 'alarm',
                    }"
                    @click="acknowledgeAlarm(key)">

                    <DataCard
                        :label="telemetry.getDisplayName(key)"
                        :value="telemetry.displayLiveData[key]"
                        :unit="getDisplayUnit(key)"
                        :stale="telemetry.isDataStale"
                        class="w-full !cursor-default"
                    />

                    <!-- Alert pulse overlay -->
                    <div v-if="getCardState(key) === 'alert'"
                        class="absolute inset-0 ring-2 ring-red-400 rounded-lg animate-pulse pointer-events-none" />
                    <!-- Alarm blink overlay -->
                    <div v-if="getCardState(key) === 'alarm'"
                        class="absolute inset-0 rounded-lg alarm-blink pointer-events-none" />
                </div>

            </div>
        </main>
    </div>
</template>
