/**
 * @file composables/useChartTheme.js
 * @brief Reactive ECharts theme options that follow the app's dark/light mode.
 *
 * ECharts renders to a <canvas> so CSS overrides cannot reach inside it.
 * This composable provides a `chartThemeOptions` computed object that must
 * be passed to `chart.setOption()` whenever the theme mode changes.
 *
 * Usage in a component that holds an ECharts instance:
 *
 *   import { useChartTheme } from '../../composables/useChartTheme'
 *
 *   const { chartThemeOptions, applyToChart } = useChartTheme()
 *   const chartRef = ref(null)   // your echarts instance ref
 *
 *   // Apply once on mount:
 *   onMounted(() => applyToChart(chartRef.value))
 *
 *   // Re-apply whenever the theme changes:
 *   watch(chartThemeOptions, () => applyToChart(chartRef.value))
 */

import { computed, watch } from 'vue'
import { useTheme } from './useTheme'

export function useChartTheme() {
  const { mode, accent } = useTheme()

  const isLight = computed(() => mode.value === 'light')

  // ── Axis / grid options ────────────────────────────────────────────────────

  const axisTheme = computed(() => {
    if (isLight.value) {
      return {
        axisLine:  { show: true, lineStyle: { color: '#cbd5e1', width: 1 } },
        axisTick:  { show: true, lineStyle: { color: '#cbd5e1' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(0,0,0,0.07)', width: 1, type: 'solid' } },
      }
    }
    return {
      axisLine:  { show: true, lineStyle: { color: '#52525b', width: 1 } },
      axisTick:  { show: true, lineStyle: { color: '#52525b' } },
      axisLabel: { color: '#a1a1aa', fontSize: 11 },
      nameTextStyle: { color: '#71717a', fontSize: 11 },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)', width: 1, type: 'solid' } },
    }
  })

  // ── Full option patch — spread or pass directly to setOption() ─────────────

  /**
   * Merge this into every setOption() call, or watch it and call
   * chart.setOption(chartThemeOptions.value) when it changes.
   *
   * ECharts' `setOption` is additive by default so it is safe to call with
   * only the keys you want to update — existing series data is preserved.
   */
  const chartThemeOptions = computed(() => ({
    // Transparent lets the parent div colour show through cleanly in both modes
    backgroundColor: 'transparent',

    textStyle: {
      color: isLight.value ? '#475569' : '#a1a1aa',
    },

    // Applies to all x-axes (ECharts merges array entries)
    xAxis: axisTheme.value,

    // Applies to all y-axes
    yAxis: axisTheme.value,

    tooltip: {
      backgroundColor: isLight.value ? '#ffffff'  : 'rgba(23,23,23,0.95)',
      borderColor:     isLight.value ? '#e2e8f0'  : '#3f3f46',
      borderWidth: 1,
      textStyle: {
        color: isLight.value ? '#0f172a' : '#f4f4f5',
        fontSize: 12,
      },
    },

    // DataZoom (scroll/slider) styling
    dataZoom: [
      {
        textStyle:       { color: isLight.value ? '#64748b' : '#71717a' },
        borderColor:     isLight.value ? '#e2e8f0' : '#3f3f46',
        fillerColor:     isLight.value ? 'rgba(100,116,139,0.1)' : 'rgba(113,113,122,0.15)',
        handleStyle:     { color: isLight.value ? '#94a3b8' : '#52525b', borderColor: isLight.value ? '#cbd5e1' : '#3f3f46' },
        moveHandleStyle: { color: isLight.value ? '#cbd5e1' : '#3f3f46' },
        emphasis: {
          handleStyle:     { color: accent.value },
          moveHandleStyle: { color: accent.value },
        },
      },
    ],

    // Legend
    legend: {
      textStyle: { color: isLight.value ? '#475569' : '#a1a1aa' },
      inactiveColor: isLight.value ? '#cbd5e1' : '#52525b',
    },
  }))

  // ── Helper ─────────────────────────────────────────────────────────────────

  /**
   * Apply the current theme options to an ECharts instance.
   * @param {import('echarts').ECharts | null} instance
   */
  function applyToChart(instance) {
    if (!instance || instance.isDisposed()) return
    // notMerge: false → preserves existing series/data while updating styles
    instance.setOption(chartThemeOptions.value, { notMerge: false, lazyUpdate: true })
  }

  return {
    /** Reactive ECharts option object — watch this to detect theme changes */
    chartThemeOptions,
    /** Current mode ref ('dark' | 'light') — useful for conditional logic */
    isLight,
    /** Convenience helper: calls setOption on an ECharts instance */
    applyToChart,
  }
}
