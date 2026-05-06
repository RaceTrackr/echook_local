<!--
  @file components/panels/BarPanel.vue
  @brief Horizontal bar gauge with threshold-driven colour and min/max labels.
-->
<script setup>
import { computed } from 'vue'
import { formatValue, getUnit } from '../../utils/formatting'
import { getThresholdColor } from '../../composables/useThresholdColor'
import { useTheme } from '../../composables/useTheme'

const props = defineProps({
  panel:       { type: Object,           required: true },
  value:       { type: [Number, String], default: null  },
  displayName: { type: String,           default: ''    },
  isStale:     { type: Boolean,          default: false },
})

const { mode } = useTheme()
const isLight = computed(() => mode.value === 'light')

const min    = computed(() => props.panel.min ?? 0)
const max    = computed(() => props.panel.max ?? 100)
const color  = computed(() => getThresholdColor(props.value, props.panel.thresholds, mode.value))

const pct = computed(() => {
  if (props.value === null || props.value === undefined) return 0
  return Math.max(0, Math.min(1, (Number(props.value) - min.value) / (max.value - min.value)))
})

const fmtValue = computed(() => formatValue(props.panel.key, props.value))
const unit     = computed(() => props.panel.unit || getUnit(props.panel.key) || '')
</script>

<template>
  <div class="flex flex-col justify-center h-full px-4 gap-2 select-none">

    <!-- Title + value row -->
    <div class="flex items-baseline justify-between gap-2">
      <p class="text-xs font-bold uppercase tracking-widest text-gray-500 truncate flex-1">
        {{ panel.title || displayName }}
      </p>
      <span class="font-mono font-bold text-lg tabular-nums flex-shrink-0"
        :class="isStale ? 'text-gray-600' : ''"
        :style="isStale ? {} : { color }">
        {{ fmtValue }}<span v-if="unit" class="text-xs text-gray-500 ml-1 font-normal">{{ unit }}</span>
      </span>
    </div>

    <!-- Bar track -->
    <div class="w-full rounded-full overflow-hidden" style="height: 10px"
      :class="isLight ? 'bg-slate-200' : 'bg-neutral-700'">
      <div
        class="h-full rounded-full transition-all duration-300"
        :style="{
          width: (pct * 100).toFixed(1) + '%',
          backgroundColor: isStale ? (isLight ? '#94a3b8' : '#52525b') : color,
        }" />
    </div>

    <!-- Min / Max labels -->
    <div class="flex justify-between text-[10px] text-neutral-600 font-mono">
      <span>{{ min }}</span>
      <span>{{ max }}</span>
    </div>

  </div>
</template>
