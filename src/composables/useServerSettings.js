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
const isFetching  = ref(false)
const isPushing   = ref(false)
const lastSyncedAt = ref(null)
const fetchError  = ref(null)
const pushError   = ref(null)

export function useServerSettings() {
  const settings = useSettingsStore()

  // Images are now stored as server files and referenced by URL.
  // Strip any legacy base64 data URLs so they never bloat the settings JSON.
  const stripBase64 = (v) =>
    typeof v === 'string' && v.startsWith('data:') ? null : v

  /** Extract all shareable settings. */
  const extractSettings = () => ({
    teamName:               settings.teamName,
    teamBadge:              settings.teamBadge,
    loginBackground:        settings.loginBackground,
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
    isFetching.value = true
    fetchError.value = null
    try {
      const res  = await fetch(API)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      if (data && Object.keys(data).length > 0) {
        settings.importSettings(data)
      }
      lastSyncedAt.value = new Date()
    } catch (err) {
      fetchError.value = err.message || 'Could not reach settings server'
      console.warn('[useServerSettings] fetch failed:', err.message)
    } finally {
      isFetching.value = false
    }
  }

  /**
   * Lightweight extract — same as full now that images are server URLs.
   * Used for automatic pushes triggered by watchers.
   */
  const extractSettingsLight = () => extractSettings()

  /** Push current store state to server — becomes new shared baseline. */
  const pushToServer = async (full = false) => {
    isPushing.value = true
    pushError.value = null
    try {
      const payload = full ? extractSettings() : extractSettingsLight()
      const body    = JSON.stringify(payload)
      const sizeMB  = (new Blob([body]).size / 1024 / 1024).toFixed(1)
      if (Number(sizeMB) > 45) {
        throw new Error(`Payload too large (${sizeMB}MB). Try a smaller background image.`)
      }
      const res = await fetch(API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      lastSyncedAt.value = new Date()
    } catch (err) {
      pushError.value = err.message || 'Could not reach settings server'
      console.warn('[useServerSettings] push failed:', err.message)
    } finally {
      isPushing.value = false
    }
  }

  /** Re-fetch from server, overwriting all device-local overrides. */
  const resetToServer = () => fetchFromServer()

  /**
   * Delete the server settings file and reset this device's store to
   * factory defaults. Admin-only action.
   */
  const resetAllToDefaults = async () => {
    try {
      await fetch(API, { method: 'DELETE' })
    } catch { /* ignore — server may not have a file yet */ }
    // Clear localStorage entirely for settings
    const key = Object.keys(localStorage).find(k => k.includes('settings'))
    if (key) localStorage.removeItem(key)
    // Reload to re-initialise store from defaults
    window.location.reload()
  }

  return {
    isFetching, isPushing, fetchError, pushError, lastSyncedAt,
    fetchFromServer, pushToServer, resetToServer, resetAllToDefaults,
  }
}
