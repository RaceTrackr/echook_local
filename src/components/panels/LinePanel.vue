<!--
  @file components/panels/LinePanel.vue
  @brief Line graph panel. Wraps TelemetryGraph with panel height and colour.
-->
<script setup>
import { computed } from 'vue'
import TelemetryGraph from '../TelemetryGraph.vue'
import { getThresholdColor } from '../../composables/useThresholdColor'
import { useTheme, resolveAccent } from '../../composables/useTheme'

const CHART_GROUP = 'grafana-panel-group'

const props = defineProps({
  panel:          { type: Object,  required: true },
  data:           { type: Array,   required: true },
  chartHeight:    { type: Number,  required: true },
  lineColor:      { type: String,  default: null  },
  rollingAverage: { type: Number,  default: 0     },
  displayName:    { type: String,  default: ''    },
  isStale:        { type: Boolean, default: false },
  yMin:           { type: Number,  default: null  },
  yMax:           { type: Number,  default: null  },
})

const { mode, accent } = useTheme()

// Resolve line colour — 'accent', 'adaptive', explicit hex, or base threshold colour
const lineColor = computed(() => {
  const raw = props.lineColor
  if (raw === 'accent')   return resolveAccent(accent.value, mode.value)
  if (raw === 'adaptive') return mode.value === 'light' ? '#1e293b' : '#ffffff'
  if (raw) return raw
  const base = props.panel.thresholds?.find(t => t.value === null || t.value === undefined || t.value === '')
  return base?.color ?? resolveAccent(accent.value, mode.value)
})

// Filter data to the last N seconds when timeScope is set
const filteredData = computed(() => {
  const scope = props.panel.timeScope
  if (!scope) return props.data
  const cutoff = Date.now() - scope * 1000
  return props.data.filter(p => (p.timestamp ?? 0) >= cutoff)
})
</script>

<template>
  <div class="w-full h-full overflow-hidden relative">
    <!-- Custom title overlay — shown when panel has a title or displayName -->
    <p v-if="panel.title || displayName"
      class="absolute top-2 left-0 right-0 text-xs font-bold uppercase tracking-wider text-gray-500 z-10 text-center pointer-events-none truncate px-3">
      {{ panel.title || displayName }}
    </p>
    <TelemetryGraph
      :data="filteredData"
      :data-key="panel.key"
      :group="CHART_GROUP"
      :color="lineColor"
      :height="chartHeight"
      :rolling-average="rollingAverage"
      :show-title="false"
      :y-min="yMin"
      :y-max="yMax"
    />
  </div>
</template>
