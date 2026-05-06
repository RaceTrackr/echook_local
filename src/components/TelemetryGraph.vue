<!--
  @file components/TelemetryGraph.vue
  @brief ECharts-based telemetry graph component.
  @description Renders a time-series graph for a single telemetry data key.
               Supports zoom controls, lap highlighting, and synced charts via
               ECharts grouping. Handles keyboard and mouse zoom requests.
-->
<script setup>
/**
 * @description TelemetryGraph component for visualizing telemetry data.
 * 
 * Features:
 * - Time-series line chart with auto-scaling
 * - Zoom controls: Ctrl+Scroll for zoom, Shift+Scroll for pan
 * - Lap highlighting via markArea (alternating colors)
 * - Chart grouping for synchronized zoom across multiple graphs
 * - Programmatic zoom via chartZoomRequest from store
 * - Configurable height, color, and display options
 * 
 * Props:
 * - data: Array of telemetry data points with timestamp
 * - dataKey: Which data key to display (e.g., 'speed', 'voltage')
 * - color: Line color (defaults to primary theme color)
 * - group: ECharts group name for synchronized charts
 * - showLaps: Whether to show lap highlight areas
 * - showTitle: Whether to show the data key title
 * - height: Custom height (number or string)
 */
import { computed, defineProps, ref, watch, onMounted } from 'vue'
import { useTelemetryStore } from '../stores/telemetry'
import { use } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  MarkAreaComponent
} from "echarts/components";
import VChart from "vue-echarts";

// Register ECharts components
use([
  CanvasRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  LegendComponent,
  TitleComponent,
  DatasetComponent,
  MarkAreaComponent
]);

import { formatValue, getUnit } from '../utils/formatting'
import { useTheme } from '../composables/useTheme'

/**
 * @brief Component props definition.
 */
const props = defineProps({
  /** @brief Array of telemetry data points */
  data: {
    type: Array,
    required: true
  },
  /** @brief Custom chart height (px or CSS string) */
  height: {
    type: [String, Number],
    default: null
  },
  /** @brief Telemetry key to display */
  dataKey: {
    type: String,
    required: true
  },
  /** @brief Line color */
  color: {
    type: String,
    default: '#cb1557'
  },
  /** @brief ECharts group for synchronized zoom */
  group: {
    type: String,
    default: 'telemetry'
  },
  /** @brief Whether to show lap highlight areas */
  showLaps: {
    type: Boolean,
    default: true
  },
  /** @brief Whether to show the data key title */
  showTitle: {
    type: Boolean,
    default: true
  },
  /**
   * @brief Rolling average window in data points (0 = off).
   * Overrides graphSettings.rollingAverage when set to a positive number.
   */
  rollingAverage: {
    type: Number,
    default: null
  }
})

const telemetry = useTelemetryStore()
const { font } = useTheme()

// Resolve the active font-family string for ECharts options
const chartFont = computed(() => {
  const families = {
    system:          'system-ui, -apple-system, sans-serif',
    formula:         "'Formula', sans-serif",
    inter:           "'Inter', sans-serif",
    roboto:          "'Roboto', sans-serif",
    'space-grotesk': "'Space Grotesk', sans-serif",
    rajdhani:        "'Rajdhani', sans-serif",
    nunito:          "'Nunito', sans-serif",
    oxanium:         "'Oxanium', sans-serif",
    jetbrains:       "'JetBrains Mono', monospace",
    custom:          "'AppCustomFont', sans-serif",
  }
  return families[font.value] || families.system
})
const chart = ref(null)

/**
 * @brief Apply an O(n) sliding-window rolling average to the data.
 * Window size comes from the prop (per-chart override) or graphSettings (global).
 */
// Rolling average helper — called directly inside option computed
const applyRollingAverage = (data, key, w) => {
  if (!w || w < 2 || !data.length) return data
  const result = []
  let sum = 0, count = 0
  for (let i = 0; i < data.length; i++) {
    const val = data[i][key]
    if (val !== null && val !== undefined && !isNaN(Number(val))) { sum += Number(val); count++ }
    if (i >= w) {
      const old = data[i - w][key]
      if (old !== null && old !== undefined && !isNaN(Number(old))) { sum -= Number(old); count-- }
    }
    result.push(count > 0 ? { ...data[i], [key]: sum / count } : data[i])
  }
  return result
}

/**
 * @brief Process zoom requests from the telemetry store.
 * @description Handles: 'reset' (unlock to live), 'absolute' (specific range),
 *              'pan' (offset by time), 'scale' (zoom in/out).
 * @param {Object|null} payload - Zoom request or null to use store value
 */
const processZoom = (payload) => {
  const req = payload || telemetry.chartZoomRequest
  if (req && chart.value) {
    if (req.type === 'reset') {
      // Unlock: Show latest data but maintain current window size
      try {
        const currentOption = chart.value.getOption()
        const axis = currentOption.dataZoom && currentOption.dataZoom[0]

        let sizePercent = 10 // Default fallback

        if (axis) {
          const startVal = axis.startValue
          const endVal = axis.endValue

          if (startVal !== undefined && endVal !== undefined && typeof startVal === 'number' && typeof endVal === 'number') {
            const duration = endVal - startVal
            const totalDuration = (telemetry.latestTime || Date.now()) - (telemetry.earliestTime || 0)
            if (totalDuration > 0) {
              sizePercent = (duration / totalDuration) * 100
            }
          } else if (axis.start !== undefined && axis.end !== undefined) {
            sizePercent = axis.end - axis.start
          }
        }

        // Clamp
        if (isNaN(sizePercent) || sizePercent <= 0) sizePercent = 10
        if (sizePercent > 100) sizePercent = 100
        if (sizePercent < 0.1) sizePercent = 0.1

        chart.value.dispatchAction({
          type: 'dataZoom',
          start: 100 - sizePercent,
          end: 100
        })

      } catch (e) {
        console.error('Zoom calc failed, using fallback', e)
        chart.value.dispatchAction({
          type: 'dataZoom',
          start: 90,
          end: 100
        })
      }
    } else if (req.type === 'absolute') {
      chart.value.dispatchAction({
        type: 'dataZoom',
        startValue: req.start,
        endValue: req.end
      })
    } else if (req.type === 'pan' || req.type === 'scale') {
      try {
        const currentOption = chart.value.getOption()
        const axis = currentOption.dataZoom && currentOption.dataZoom[0]

        if (axis && axis.startValue !== undefined && axis.endValue !== undefined) {
          let start = axis.startValue
          let end = axis.endValue

          if (req.type === 'pan') {
            start += req.offsetMs
            end += req.offsetMs
          } else if (req.type === 'scale') {
            const duration = end - start
            const center = start + (duration / 2)
            const newDuration = duration * req.factor

            start = center - (newDuration / 2)
            end = center + (newDuration / 2)
          }

          chart.value.dispatchAction({
            type: 'dataZoom',
            startValue: start,
            endValue: end
          })
        } else {
          // Fallback: percentage mode
          const totalDuration = (telemetry.latestTime || Date.now()) - (telemetry.earliestTime || 0)

          if (totalDuration > 0) {
            let startP = axis.start !== undefined ? axis.start : 0
            let endP = axis.end !== undefined ? axis.end : 100

            if (req.type === 'pan') {
              const offsetP = (req.offsetMs / totalDuration) * 100
              startP += offsetP
              endP += offsetP
            } else if (req.type === 'scale') {
              const durationP = endP - startP
              const centerP = startP + (durationP / 2)
              const newDurationP = durationP * req.factor

              startP = centerP - (newDurationP / 2)
              endP = centerP + (newDurationP / 2)
            }

            // Clamp
            if (startP < 0) startP = 0
            if (endP > 100) endP = 100
            if (endP - startP < 0.1) {
              const center = (startP + endP) / 2
              startP = center - 0.05
              endP = center + 0.05
            }

            chart.value.dispatchAction({
              type: 'dataZoom',
              start: startP,
              end: endP
            })
          }
        }
      } catch (e) {
        console.error('Pan/Scale failed', e)
      }
      telemetry.chartZoomRequest = null
    }

    if (req.type === 'reset') {
      telemetry.chartZoomRequest = null
    }
  }
}

// Watch for zoom requests
watch(() => telemetry.chartZoomRequest, (req) => {
  if (req) {
    requestAnimationFrame(() => processZoom(req))
  }
})

onMounted(() => {
  if (telemetry.chartZoomRequest) {
    processZoom()
  }
})

/**
 * @brief Get display unit for a telemetry key.
 * @param {string} key - Telemetry key
 * @returns {string} Unit string
 */
const getDisplayUnit = (key) => {
  if (key === 'speed') return telemetry.unitSettings.speedUnit
  if (key === 'temp1' || key === 'temp2') return telemetry.unitSettings.tempUnit === 'f' ? '°F' : '°C'
  return getUnit(key)
}

/**
 * @brief ECharts option configuration.
 * @type {ComputedRef<Object>}
 */
const option = computed(() => {
  const showGrid       = telemetry.graphSettings.showGrid
  const showHighlights = props.showLaps && telemetry.graphSettings.showLapHighlights

  const unit        = getDisplayUnit(props.dataKey)
  const displayName = telemetry.getDisplayName(props.dataKey)
  const yAxisName   = unit ? `${displayName} (${unit})` : displayName

  return {
    animation: telemetry.graphSettings.showAnimations,
    color: [props.color],

    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(23, 23, 23, 0.95)',
      borderColor: '#3f3f46',
      borderWidth: 1,
      textStyle: { color: '#f4f4f5', fontSize: 12, fontFamily: chartFont.value },
      formatter: (params) => {
        if (!params.length) return ''
        const date  = new Date(params[0].axisValue)
        const timeStr = date.toLocaleTimeString()
        const ff = chartFont.value
        let result = `<div style="font-weight:700;margin-bottom:4px;color:#a1a1aa;font-family:${ff}">${timeStr}</div>`
        params.forEach(item => {
          const val       = item.data[props.dataKey]
          const formatted = formatValue(props.dataKey, val)
          const u         = getDisplayUnit(props.dataKey)
          result += `
            <div style="display:flex;justify-content:space-between;gap:16px;align-items:center;font-family:${ff}">
              <span style="color:${item.color}">● ${item.seriesName}</span>
              <span style="font-weight:700">
                ${formatted}<span style="font-size:11px;color:#71717a;margin-left:3px">${u}</span>
              </span>
            </div>`
        })
        return result
      }
    },

    grid: {
      top:    28,
      bottom: 36,
      left:   72,
      right:  24,
      containLabel: false,
    },

    xAxis: {
      type: 'time',
      boundaryGap: false,
      name: 'Time',
      nameLocation: 'end',
      nameTextStyle: {
        color: '#71717a',
        fontSize: 11,
        fontFamily: chartFont.value,
        padding: [0, 0, 0, 8],
      },
      axisLine: {
        show: true,
        lineStyle: { color: '#52525b', width: 1 },
      },
      axisTick: {
        show: true,
        lineStyle: { color: '#52525b' },
      },
      axisLabel: {
        color: '#a1a1aa',
        fontSize: 11,
        fontFamily: chartFont.value,
        hideOverlap: true,
        rotate: 0,
        formatter: (val) => {
          const d = new Date(val)
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
      },
      splitLine: {
        show: showGrid,
        lineStyle: { color: 'rgba(255,255,255,0.06)', width: 1, type: 'solid' },
      },
    },

    yAxis: {
      type: 'value',
      scale: true,
      name: yAxisName,
      nameLocation: 'middle',
      nameRotate: 90,
      nameGap: 56,
      nameTextStyle: {
        color: '#71717a',
        fontSize: 11,
        fontFamily: chartFont.value,
      },
      axisLine: {
        show: true,
        lineStyle: { color: '#52525b', width: 1 },
      },
      axisTick: {
        show: true,
        lineStyle: { color: '#52525b' },
      },
      axisLabel: {
        color: '#a1a1aa',
        fontSize: 11,
        fontFamily: chartFont.value,
        formatter: (val) => formatValue(props.dataKey, val),
      },
      splitLine: {
        show: showGrid,
        lineStyle: { color: 'rgba(255,255,255,0.06)', width: 1, type: 'solid' },
      },
    },

    large: true,
    largeThreshold: 10000,
    progressive: 500,
    progressiveThreshold: 1000,

    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        zoomOnMouseWheel: 'ctrl',
        moveOnMouseWheel: 'shift',
      }
    ],

    dataset: [
      { source: props.data },
      ...(((props.rollingAverage != null ? props.rollingAverage : telemetry.graphSettings.rollingAverage) || 0) >= 2
        ? [{ source: applyRollingAverage(
              props.data,
              props.dataKey,
              (props.rollingAverage != null ? props.rollingAverage : telemetry.graphSettings.rollingAverage) || 0
            ) }]
        : []),
    ],

    series: [
      {
        name: displayName,
        type: 'line',
        datasetIndex: 0,
        showSymbol: false,
        sampling: 'average',
        encode: { x: 'timestamp', y: props.dataKey },
        lineStyle: { width: 3, cap: 'round', join: 'round' },
        markArea: {
          silent: true,
          itemStyle: { opacity: 0.08 },
          label: {
            show: true,
            position: 'insideTop',
            align: 'center',
            verticalAlign: 'top',
            distance: 4,
            color: '#71717a',
            fontFamily: chartFont.value,
            fontSize: 10,
          },
          data: showHighlights ? telemetry.lapMarkAreas : [],
        },
      },
      // Rolling average overlay — only added when window >= 2
      ...((((props.rollingAverage != null ? props.rollingAverage : telemetry.graphSettings.rollingAverage) || 0) >= 2) ? [{
        name: `${displayName} (avg)`,
        type: 'line',
        datasetIndex: 1,
        showSymbol: false,
        sampling: 'average',
        encode: { x: 'timestamp', y: props.dataKey },
        lineStyle: {
          width: 2,
          type: 'dashed',
          cap: 'round',
          opacity: 0.9,
        },
        // Slightly lighter colour — mix toward white/black
        itemStyle: { color: props.color },
      }] : []),
    ],
  }
})

/**
 * @brief Handle wheel events to allow page scroll without modifiers.
 * @param {WheelEvent} e - Wheel event
 */
const handleWheel = (e) => {
  if (!e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
    e.stopPropagation()
  }
}
</script>

<template>
  <div class="relative overflow-hidden" @wheel.capture="handleWheel"
    :style="{ height: height ? (typeof height === 'number' ? height + 'px' : height) : telemetry.graphSettings.graphHeight + 'px' }">
    <h3 v-if="showTitle" class="absolute top-2 left-0 right-0 text-xs font-bold uppercase tracking-wider text-gray-500 z-10 text-center pointer-events-none">{{
      telemetry.getDisplayName(dataKey) }}</h3>
    <VChart ref="chart" class="w-full h-full" :option="option" autoresize :group="group" />
  </div>
</template>

<style scoped>
/* Ensure chart takes full space */
</style>
