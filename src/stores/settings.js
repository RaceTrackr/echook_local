/**
 * @file stores/settings.js
 * @brief User settings and preferences store.
 * @description Pinia store for managing persistent user preferences including
 *              unit settings, graph configuration, dashboard layout, and
 *              historical race data. All settings persist to localStorage.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

export const DEFAULT_METRIC_KEYS = [
    'voltage', 'current', 'ampH', 'speed', 'rpm', 'throttle',
    'voltageLower', 'voltageHigh', 'voltageDiff',
    'temp1', 'temp2', 'tempDiff',
    'gear', 'brake', 'currLap', 'lastLapTime',
]

/**
 * @brief Settings store for user preferences and race history.
 * @description Centralizes all user-configurable settings with automatic
 *              persistence. Separates UI preferences from telemetry data.
 */
export const useSettingsStore = defineStore('settings', () => {
    // ============================================
    // Performance & Retention Settings
    // ============================================

    /**
     * @brief Maximum number of telemetry history points to retain.
     * @description Limits memory usage by capping stored data points.
     *              Older points are discarded when limit is exceeded.
     * @type {Ref<number>}
     */
    const maxHistoryPoints = ref(50000)

    // ============================================
    // Unit Settings
    // ============================================

    /**
     * @brief Unit preferences for value display.
     * @property {string} speedUnit - Speed unit: 'mph', 'kph', or 'ms'
     * @property {string} tempUnit - Temperature unit: 'c' or 'f'
     * @type {Ref<Object>}
     */
    const unitSettings = ref({
        speedUnit: 'mph',
        tempUnit: 'c'
    })

    // ============================================
    // Graph/Visual Settings
    // ============================================

    /**
     * @brief Graph display configuration.
     * @property {boolean} showLapHighlights - Show colored lap regions on graph
     * @property {boolean} showAnimations - Enable chart animations
     * @property {boolean} showGrid - Show grid lines
     * @property {number} graphHeight - Graph height in pixels (legacy single-graph mode)
     * @type {Ref<Object>}
     */
    const graphSettings = ref({
        showLapHighlights: true,
        showAnimations: false,
        showGrid: true,
        graphHeight: 320,
        rollingAverage: 0,  // 0 = off; otherwise number of data points to average over
    })

    // ============================================
    // Dashboard Persistence
    // ============================================

    /** @brief Currently active tab ID (graph, map, laps, etc.) */
    const activeTabId = ref('panels')

    /** @brief List of data keys shown in dashboard cards */
    const selectedDashboardKeys = ref(['voltage', 'current', 'speed', 'rpm'])

    /** @brief Whether to show the metric cards above the graph */
    const showDashboardMetrics = ref(true)

    /** @brief Whether user has dismissed the laps disclaimer */
    const hideLapsDisclaimer = ref(false)

    /** @brief Whether user has dismissed the history clear confirmation */
    const hideHistoryClearConfirmation = ref(false)

    /** @brief Whether to show the graph help modal on first load */
    /** @brief Team name shown in the header and login page (replaces "eChook Live") */
    const teamName = ref('eChook Live')

    /** @brief Custom login background image as a base64 data URL (null = default) */
    const loginBackground = ref(null)

    /** @brief Team badge / logo as a base64 data URL (null = none) */
    const teamBadge = ref(null)

    const showGraphHelp = ref(true)

    /**
     * @brief Customisable keyboard bindings for dashboard actions.
     * Values are KeyboardEvent.key strings (e.g. 'Tab', ' ', 'r', 'l').
     * Set to null to disable a binding.
     */
    const keyBindings = ref({
      cycleTab:    'Tab',
      pauseResume: ' ',
      zoomRace:    'r',
      unlockZoom:  'l',
      panLeft:     'ArrowLeft',
      panRight:    'ArrowRight',
      zoomIn:      'ArrowUp',
      zoomOut:     'ArrowDown',
      focusMode:   'f',
    })

    /** @brief Whether admin mode is currently unlocked */
    const isAdminMode = ref(false)

    /**
     * @brief Password required to enable admin mode.
     */
    const adminPassword = ref('echook')

    /**
     * @brief Locally saved car connections.
     * @description Array of { id: string, name: string, savedAt: number }
     *              Persisted so cars don't need to be re-entered each session.
     * @type {Ref<Array>}
     */
    const savedCars = ref([])

    /**
     * @brief Transient state for shortcuts modal visibility.
     * @description Not persisted - resets to false on page load.
     */
    const showShortcutsModal = ref(false)

    /** @brief Custom ordering of data cards set by user */
    const dataCardOrder = ref([])

    /** @brief Keys explicitly hidden from the data ribbon by the user */
    const ribbonHiddenKeys = ref([])

    /** @brief Overflow mode for the data ribbon: 'scroll' | 'wrap' */
    const ribbonOverflow = ref('scroll')

    /** @brief Whether the data ribbon is collapsed */
    const ribbonCollapsed = ref(false)

    /** @brief Keys hidden from the standalone dashboard tab (independent of ribbon) */
    const dashboardTabHiddenKeys = ref([])

    /**
     * @brief Grafana-style modular panel layout.
     * @description Array of panel config objects:
     *              { id, type, key, title, w, h, min, max, unit, thresholds }
     * @type {Ref<Array>}
     */
    const panelLayout = ref([])
    const panelGridCols = ref(8)
    const panelRowH = ref(80)
    /**
     * @brief Named layout presets: [{ id, name, panels, cols, rowH }]
     * @type {Ref<Array>}
     */
    const panelPresets = ref([])

    /**
     * @brief Per-key alarm thresholds for the data ribbon.
     * @description Structure: { [key]: { alert: { lower, upper }, alarm: { lower, upper } } }
     *              alert — red glow when breached
     *              alarm — flashing blink (more severe); click the card to acknowledge
     *              Values are in the user's current display units. null = disabled.
     * @type {Ref<Object>}
     */
    const alarmThresholds = ref({})

    // ============================================
    // Race Records (Historical Lap Data)
    // ============================================

    /**
     * @brief Historical race session data.
     * @description Stores lap data organized by race start time:
     *              { [raceStartTime]: { startTimeMs, laps: { [lapNum]: data } } }
     * @type {Ref<Object>}
     */
    const races = ref({})

    /** @brief Ordered list of telemetry metric keys available for panels and graphs */
    const metricKeys = ref([...DEFAULT_METRIC_KEYS])

    /** @brief Keys explicitly hidden from metric selectors in graph/grafana/panel UIs */
    const hiddenMetricKeys = ref([])

    /** @brief Visible column keys in the Laps tab table */
    const lapsVisibleCols = ref([
        'startTime', 'finishTime', 'LL_Time',
        'LL_VA_avg', 'LL_VB_avg', 'LL_VA_min', 'LL_VB_min',
        'LL_I', 'LL_I_max', 'LL_RPM_min', 'LL_RPM', 'LL_Ah', 'LL_Spd',
    ])

    // ============================================
    // Utility Actions
    // ============================================

    /**
     * @brief Import settings from an external source.
     * @description Merges provided settings into current state. Used for
     *              settings import/export functionality.
     * @param {Object} newData - Settings object to import
     */
    function importSettings(newData) {
        if (!newData) return

        if (newData.maxHistoryPoints !== undefined) maxHistoryPoints.value = newData.maxHistoryPoints
        if (newData.unitSettings) unitSettings.value = { ...unitSettings.value, ...newData.unitSettings }
        if (newData.graphSettings) graphSettings.value = { ...graphSettings.value, ...newData.graphSettings }
        if (newData.activeTabId) activeTabId.value = newData.activeTabId
        if (newData.selectedDashboardKeys) selectedDashboardKeys.value = newData.selectedDashboardKeys
        if (newData.showDashboardMetrics !== undefined) showDashboardMetrics.value = newData.showDashboardMetrics
        if (newData.hideLapsDisclaimer !== undefined) hideLapsDisclaimer.value = newData.hideLapsDisclaimer
        if (newData.hideHistoryClearConfirmation !== undefined) hideHistoryClearConfirmation.value = newData.hideHistoryClearConfirmation
        if (newData.teamName !== undefined) teamName.value = newData.teamName
        if (newData.loginBackground !== undefined) {
            const v = newData.loginBackground
            loginBackground.value = (typeof v === 'string' && v.startsWith('/api/assets/')) ? null : v
        }
        if (newData.teamBadge !== undefined) {
            // Discard legacy server-asset URLs (previous storage scheme)
            const v = newData.teamBadge
            teamBadge.value = (typeof v === 'string' && v.startsWith('/api/assets/')) ? null : v
        }
        if (newData.showGraphHelp !== undefined) showGraphHelp.value = newData.showGraphHelp
        if (newData.keyBindings) keyBindings.value = { ...keyBindings.value, ...newData.keyBindings }
        if (newData.isAdminMode !== undefined) isAdminMode.value = newData.isAdminMode
        if (newData.adminPassword !== undefined) adminPassword.value = newData.adminPassword
        if (newData.savedCars) savedCars.value = newData.savedCars
        if (newData.dataCardOrder) dataCardOrder.value = newData.dataCardOrder
        if (newData.ribbonHiddenKeys) ribbonHiddenKeys.value = newData.ribbonHiddenKeys
        if (newData.ribbonOverflow) ribbonOverflow.value = newData.ribbonOverflow
        if (newData.ribbonCollapsed !== undefined) ribbonCollapsed.value = newData.ribbonCollapsed
        if (newData.dashboardTabHiddenKeys) dashboardTabHiddenKeys.value = newData.dashboardTabHiddenKeys
        if (newData.panelLayout) panelLayout.value = newData.panelLayout
        if (newData.panelGridCols !== undefined) panelGridCols.value = newData.panelGridCols
        if (newData.panelRowH !== undefined) panelRowH.value = newData.panelRowH
        if (newData.panelPresets) panelPresets.value = newData.panelPresets
        if (newData.alarmThresholds) alarmThresholds.value = { ...alarmThresholds.value, ...newData.alarmThresholds }
        if (newData.races) races.value = { ...races.value, ...newData.races }
        if (newData.hiddenMetricKeys) hiddenMetricKeys.value = newData.hiddenMetricKeys
    }

    return {
        // Performance
        maxHistoryPoints,

        // Units
        unitSettings,

        // Graph
        graphSettings,

        // Dashboard
        activeTabId,
        selectedDashboardKeys,
        showDashboardMetrics,
        hideLapsDisclaimer,
        hideHistoryClearConfirmation,
        teamName,
        loginBackground,
        teamBadge,
        showGraphHelp,
        keyBindings,
        isAdminMode,
        adminPassword,
        savedCars,
        showShortcutsModal,
        dataCardOrder,
        ribbonHiddenKeys,
        ribbonOverflow,
        ribbonCollapsed,
        dashboardTabHiddenKeys,
        panelLayout,
        panelGridCols,
        panelRowH,
        panelPresets,
        alarmThresholds,

        // Race Data
        races,
        lapsVisibleCols,
        metricKeys,
        hiddenMetricKeys,

        // Actions
        importSettings
    }
}, {
    persist: {
        afterRestore: (ctx) => {
            // Strip legacy server-asset URLs persisted by a previous storage scheme
            for (const key of ['teamBadge', 'loginBackground']) {
                const v = ctx.store[key]
                if (typeof v === 'string' && v.startsWith('/api/assets/')) {
                    ctx.store[key] = null
                }
            }
        }
    }
})
