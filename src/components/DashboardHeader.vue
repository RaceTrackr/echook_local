<!--
  @file components/DashboardHeader.vue
  @brief Main dashboard navigation header.
-->
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useTelemetryStore } from '../stores/telemetry'
import { useSettingsStore } from '../stores/settings'
import { useRouter } from 'vue-router'
import {
  ArrowRightOnRectangleIcon,
  ServerIcon,
  TruckIcon,
} from '@heroicons/vue/24/outline'

const auth     = useAuthStore()
const telemetry = useTelemetryStore()
const settings  = useSettingsStore()
const router    = useRouter()

const now = ref(Date.now())
let timer = null

onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

const lastUpdatedText = computed(() => {
  if (telemetry.isPaused) return ''
  if (!telemetry.lastPacketTime) return 'No Data'
  const diff = Math.floor((now.value - telemetry.lastPacketTime) / 1000)
  if (diff < 10) return ''
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return '>1h ago'
})

const carStatusColor = computed(() => {
  if (telemetry.isPaused) return 'bg-orange-500'
  if (!telemetry.lastPacketTime || !telemetry.isConnected) return 'bg-red-500'
  const diff = (now.value - telemetry.lastPacketTime) / 1000
  if (diff > 10) return 'bg-red-500'
  if (diff > 5) return 'bg-orange-500'
  return 'bg-green-500 animate-pulse'
})

const displayedCar = computed(() => {
  if (telemetry.viewingCar) {
    return {
      carName: telemetry.viewingCar.carName || telemetry.viewingCar.car || 'Unknown Car',
      teamName: telemetry.viewingCar.teamName || telemetry.viewingCar.team || 'Unknown Team',
    }
  }
  if (auth.user) {
    return {
      carName: auth.user.carName || auth.user.car,
      teamName: auth.user.teamName || auth.user.team,
    }
  }
  return null
})

const handleLogout = () => {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header
    class="h-14 md:h-16 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-3 md:px-6 sticky top-0 z-50">

    <!-- Brand / Left -->
    <div class="flex items-center gap-2 md:gap-4 min-w-0">
      <!-- Mobile: badge/initial + car name (or team name if no car) -->
      <div class="flex lg:hidden items-center gap-2 min-w-0">
        <img v-if="settings.teamBadge" :src="settings.teamBadge"
          class="h-7 w-auto object-contain flex-shrink-0" alt="Team badge" />
        <span v-if="displayedCar?.carName" class="text-sm font-bold truncate" style="color: var(--accent, #cb1557)">
          {{ displayedCar.carName }}
        </span>
        <span v-else class="text-sm font-bold text-white truncate">{{ settings.teamName }}</span>
      </div>
      <!-- Desktop: badge + team name + car name -->
      <div class="hidden lg:flex items-baseline gap-3">
        <img v-if="settings.teamBadge" :src="settings.teamBadge"
          class="h-8 w-auto object-contain self-center" alt="Team badge" />
        <span class="app-display-font tracking-normal text-2xl font-bold text-white">{{ settings.teamName }}</span>
        <span v-if="displayedCar" class="text-sm font-semibold" style="color: var(--accent, #cb1557)">
          {{ displayedCar.carName }}
        </span>
      </div>
    </div>

    <!-- Right -->
    <div class="flex items-center space-x-2 md:space-x-4 flex-shrink-0">

      <!-- Server status -->
      <div class="flex items-center px-2 lg:px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700"
        title="Server Status">
        <div class="w-2 h-2 rounded-full mr-1.5"
          :class="telemetry.isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'" />
        <ServerIcon class="w-4 h-4 text-gray-400 lg:hidden" />
        <span class="text-xs font-medium text-gray-300 hidden lg:inline">SERVER</span>
      </div>

      <!-- Car status -->
      <div class="flex items-center px-2 lg:px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700"
        title="Car Status">
        <div class="w-2 h-2 rounded-full mr-1.5 transition-colors duration-300" :class="carStatusColor" />
        <TruckIcon class="w-4 h-4 text-gray-400 lg:hidden" />
        <span class="text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:inline">Car</span>
        <span class="text-[10px] font-bold text-white whitespace-nowrap hidden lg:inline ml-1">
          {{ lastUpdatedText }}
        </span>
      </div>

      <!-- Logout -->
      <button @click="handleLogout" class="text-gray-400 hover:text-white transition cursor-pointer" title="Logout">
        <ArrowRightOnRectangleIcon class="w-5 h-5" />
      </button>

    </div>
  </header>
</template>
