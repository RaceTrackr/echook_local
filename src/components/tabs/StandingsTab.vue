<!--
  @file components/tabs/StandingsTab.vue
  @brief Live race standings via embedded SpeedHive iframe.
-->
<script setup>
import { computed } from 'vue'
import { useSettingsStore } from '../../stores/settings'

const settings = useSettingsStore()
const url = computed(() => {
  const code = settings.standingsCode?.trim()
  return code ? `https://speedhive.mylaps.com/livetiming/${code}/active` : ''
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- No URL configured -->
    <div v-if="!url"
      class="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
      <svg class="w-12 h-12 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <p class="text-sm font-medium">No live timing URL configured</p>
      <p class="text-xs text-gray-600 text-center max-w-xs">
        Paste a SpeedHive event code in <span class="text-gray-400 font-semibold">Settings → Live Timing</span>.
      </p>
    </div>

    <!-- Iframe -->
    <iframe
      v-else
      :src="url"
      class="flex-1 w-full border-0"
      allow="fullscreen"
      referrerpolicy="no-referrer"
    />
  </div>
</template>
