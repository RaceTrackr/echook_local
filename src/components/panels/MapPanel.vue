<!--
  @file components/panels/MapPanel.vue
  @brief Map panel — renders MapTab inside a Grafana dashboard tile.
-->
<script setup>
import { computed } from 'vue'
import MapTab from '../tabs/MapTab.vue'

const props = defineProps({
  panel:       { type: Object, required: true },
  displayName: { type: String, default: ''    },
  isStale:     { type: Boolean, default: false },
})

const ms = computed(() => props.panel.mapSettings ?? {})
</script>

<template>
  <div class="w-full h-full overflow-hidden">
    <MapTab
      :initial-satellite="ms.satellite ?? null"
      :initial-trail-seconds="ms.trailSeconds ?? null"
      :initial-metric="ms.metric ?? null"
    />
  </div>
</template>
