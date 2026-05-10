<!--
  @file App.vue
  @brief Root application component.
  @description The main Vue application wrapper that provides the router outlet
               and global UI elements. Handles authentication state changes to
               reset telemetry on logout.

  Theme system is initialised here so it applies before any view renders,
  preventing a flash of the wrong theme on page load.
-->
<script setup>
/**
 * @description Root application component setup.
 *
 * Features:
 * - Provides RouterView for page routing
 * - Includes global ToastNotification component
 * - Watches auth state to reset telemetry on logout
 * - Initialises theme system (dark/light mode + accent colour)
 */
import { RouterView } from 'vue-router'
import { watch, watchEffect } from 'vue'
import { useAuthStore } from './stores/auth'
import { useTelemetryStore } from './stores/telemetry'
import ToastNotification from './components/ui/ToastNotification.vue'

// ── Theme initialisation ──────────────────────────────────────────────────────
// Importing useTheme here ensures the composable runs its module-level setup
// code (CSS injection, data-theme attribute) before the first render, so there
// is no flash of the wrong colours on load.
import { useTheme } from './composables/useTheme'
import { useServerSettings } from './composables/useServerSettings'
useTheme()

// ── Server settings ───────────────────────────────────────────────────────────
// Fetch shared settings from the server on every page load.
// These are merged into the local store — local device overrides (if any) win.
import { useSettingsStore } from './stores/settings'
import { useIsLocalHost } from './composables/useIsLocalHost'
const { fetchFromServer, pushToServer } = useServerSettings()
fetchFromServer()

// Auto-push certain settings to server when they change so all devices stay in sync
const settingsStore = useSettingsStore()
watch(() => settingsStore.savedCars, () => { pushToServer() }, { deep: true })
watch(() => settingsStore.panelLayout, () => { pushToServer() }, { deep: true })
watch(() => settingsStore.panelPresets, () => { pushToServer() }, { deep: true })
watch(() => settingsStore.teamBadge, () => { pushToServer() })
watch(() => settingsStore.loginBackground, () => { pushToServer() })

// ── Admin mode — auto-enabled for host PC, disabled for remote devices ────────
const { isLocalHost, isLoading: isLocalLoading } = useIsLocalHost()
watch([isLocalHost, isLocalLoading], ([local, loading]) => {
  if (!loading) {
    settingsStore.isAdminMode = local
  }
}, { immediate: true })

// ── Auth / Telemetry ──────────────────────────────────────────────────────────
const auth = useAuthStore()
const telemetry = useTelemetryStore()

/**
 * @brief Watch for user logout and reset telemetry state.
 * @description Clears all telemetry data when user is logged out to prevent
 *              data leakage between sessions.
 */
watch(() => auth.user, (newUser) => {
  if (!newUser) {
    telemetry.resetState()
  }
})

// ── Document title ────────────────────────────────────────────────────────────
watchEffect(() => {
  const teamName = settingsStore.teamName || 'eChook Live'
  const car = telemetry.viewingCar || auth.user
  const carName = car?.carName || car?.car || ''
  document.title = carName ? `${teamName} - ${carName}` : teamName
})

// ── Favicon ───────────────────────────────────────────────────────────────────
const defaultFavicon = document.querySelector("link[rel~='icon']")?.href ?? ''

const setFavicon = (src) => {
  const link = document.querySelector("link[rel~='icon']")
  if (!link) return
  if (!src) { link.href = defaultFavicon; return }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const SIZE = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = SIZE
    const ctx = canvas.getContext('2d')
    const scale = Math.min(SIZE / img.width, SIZE / img.height)
    const w = img.width  * scale
    const h = img.height * scale
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h)
    link.href = canvas.toDataURL()
  }
  img.src = src
}

watchEffect(() => setFavicon(settingsStore.teamBadge))
</script>

<template>
  <div class="min-h-screen bg-neutral-900 text-white antialiased">
    <RouterView />
    <ToastNotification />
  </div>
</template>

<style>
/* ── Custom scrollbars ────────────────────────────────────────────────────────
   Applied globally. Webkit (Chrome, Edge, Safari) gets the full styled
   scrollbar; Firefox gets the minimal two-value version.
   Colours auto-adapt to light/dark mode via data-theme on <html>.           */

/* Firefox */
* {
  scrollbar-width: thin;
  scrollbar-color: #3f3f46 transparent;
}

[data-theme="light"] * {
  scrollbar-color: #cbd5e1 transparent;
}

/* Webkit — track */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-corner {
  background: transparent;
}

/* Webkit — thumb */
::-webkit-scrollbar-thumb {
  background-color: #3f3f46;
  border-radius: 9999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

::-webkit-scrollbar-thumb:hover {
  background-color: #52525b;
}

[data-theme="light"] ::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
}

[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

/* Accent colour on active scroll */
::-webkit-scrollbar-thumb:active {
  background-color: var(--accent, #cb1557);
}
</style>
