/**
 * @file composables/useServerSettings.js
 * @brief Syncs the settings store with the local settings server.
 *
 * How it works:
 *   - On app load, fetches shared settings from GET /api/settings
 *   - Merges them into the Pinia settings store (which then persists
 *     device-local overrides on top via localStorage as normal)
 *   - "Push to server" saves the current store state to the server,
 *     making it the new shared baseline for all devices
 *   - "Reset to server" re-fetches and re-applies the server settings,
 *     discarding any device-local overrides
 *
 * Usage:
 *   const { fetchFromServer, pushToServer, resetToServer,
 *           isSyncing, lastSync, syncError } = useServerSettings()
 */

import { ref } from 'vue'
import { useSettingsStore } from '../stores/settings'

const API = '/api/settings'

// Singleton state shared across all callers
const isSyncing = ref(false)
const lastSync  = ref(null)
const syncError = ref(null)

export function useServerSettings() {
  const settings = useSettingsStore()

  /**
   * Extract all shareable settings from the store.
   * Transient device-local state (activeTabId, ribbonCollapsed etc.) is excluded.
   */
  const extractSettings = () => ({
    unitSettings:           settings.unitSettings,
    graphSettings:          settings.graphSettings,
    ribbonOverflow:         settings.ribbonOverflow,
    ribbonHiddenKeys:       settings.ribbonHiddenKeys,
    dataCardOrder:          settings.dataCardOrder,
    dashboardTabHiddenKeys: settings.dashboardTabHiddenKeys,
    graphGridCols:          settings.graphGridCols,
    alarmThresholds:        settings.alarmThresholds,
    panelLayout:            settings.panelLayout,
    panelPresets:           settings.panelPresets,
    panelGridCols:          settings.panelGridCols,
    panelRowH:              settings.panelRowH,
    keyBindings:            settings.keyBindings,
    maxHistoryPoints:       settings.maxHistoryPoints,
    adminPassword:          settings.adminPassword,
    savedCars:              settings.savedCars,
  })

  /** Fetch server settings and merge into store, overwriting local overrides. */
  const fetchFromServer = async () => {
    isSyncing.value = true
    syncError.value = null
    try {
      const res  = await fetch(API)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      if (data && Object.keys(data).length > 0) {
        settings.importSettings(data)
      }
      lastSync.value = new Date()
    } catch (err) {
      syncError.value = err.message || 'Could not reach settings server'
      console.warn('[useServerSettings] fetch failed:', err.message)
    } finally {
      isSyncing.value = false
    }
  }

  /** Push current store state to server — becomes new shared baseline. */
  const pushToServer = async () => {
    isSyncing.value = true
    syncError.value = null
    try {
      const res = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(extractSettings()),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      lastSync.value = new Date()
    } catch (err) {
      syncError.value = err.message || 'Could not reach settings server'
      console.warn('[useServerSettings] push failed:', err.message)
    } finally {
      isSyncing.value = false
    }
  }

  /** Re-fetch from server, overwriting all device-local overrides. */
  const resetToServer = () => fetchFromServer()

  return { isSyncing, lastSync, syncError, fetchFromServer, pushToServer, resetToServer }
}
