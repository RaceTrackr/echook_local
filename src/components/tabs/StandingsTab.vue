<!--
  @file components/tabs/StandingsTab.vue
  @brief Live timing via embedded SpeedHive iframe.
-->
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '../../stores/settings'

const settings = useSettingsStore()
const url = computed(() => {
  const code = settings.standingsCode?.trim()
  return code ? `https://speedhive.mylaps.com/livetiming/${code}/active` : ''
})

// Scale the iframe to fit the container width with no horizontal scroll.
// SpeedHive is built for a ~1280px desktop viewport — on narrower screens
// we shrink it proportionally via CSS transform.
const DESKTOP_W = 1280
const containerRef = ref(null)
const containerWidth = ref(DESKTOP_W)

let ro
onMounted(() => {
  ro = new ResizeObserver(entries => {
    containerWidth.value = entries[0].contentRect.width
  })
  if (containerRef.value) ro.observe(containerRef.value)
})
onUnmounted(() => ro?.disconnect())

const scale = computed(() => Math.min(1, containerWidth.value / DESKTOP_W))

const iframeStyle = computed(() => {
  const s = scale.value
  return {
    width:           `${DESKTOP_W}px`,
    height:          `${100 / s}%`,
    transform:       `scale(${s})`,
    transformOrigin: 'top left',
    border:          'none',
  }
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

    <!-- Scaled iframe wrapper -->
    <div v-else ref="containerRef" class="flex-1 relative overflow-hidden">
      <iframe
        :src="url"
        :style="iframeStyle"
        class="absolute top-0 left-0"
        allow="fullscreen"
        referrerpolicy="no-referrer"
      />
    </div>
  </div>
</template>
