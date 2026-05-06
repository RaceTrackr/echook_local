/**
 * @file composables/useIsLocalHost.js
 * @brief Detects whether the current browser is running on the host PC.
 * @description Calls GET /api/is-local on the settings server. Returns true
 *              only for the machine running settings-server.js (127.0.0.1).
 *              All other devices on the network get false.
 *
 * Usage:
 *   const { isLocalHost, isLoading } = useIsLocalHost()
 */

import { ref, onMounted } from 'vue'

const isLocalHost = ref(false)
const isLoading   = ref(true)

let fetched = false

export function useIsLocalHost() {
  onMounted(async () => {
    if (fetched) { isLoading.value = false; return }
    fetched = true
    try {
      // Call the settings server DIRECTLY on port 3001 — bypasses the Vite
      // proxy so Express sees the real client IP, not 127.0.0.1 from the proxy.
      const res  = await fetch('http://localhost:3001/api/is-local')
      const data = await res.json()
      isLocalHost.value = data.isLocal === true
    } catch {
      // If the server is unreachable (e.g. on a remote device that can't
      // reach localhost:3001 of the host), treat as non-local.
      isLocalHost.value = false
    } finally {
      isLoading.value = false
    }
  })

  return { isLocalHost, isLoading }
}
