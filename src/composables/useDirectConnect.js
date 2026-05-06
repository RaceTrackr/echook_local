/**
 * @file composables/useDirectConnect.js
 * @brief Manages a direct Socket.IO connection to data.echook.uk using a Car ID.
 *
 * Protocol:
 *   1. socket = io('https://data.echook.uk')
 *   2. socket.emit('join', carId)
 *   3. socket.on('data', (packet) => { ... })
 *
 * Singleton — all callers share the same socket instance and state.
 *
 * Key addition vs v1: `isDirectMode` — a persistent boolean (localStorage)
 * that the router guard can read to allow navigation to the dashboard
 * without a normal auth session.
 *
 * Usage:
 *   const { connect, disconnect, reconnect, onData,
 *           isConnected, isDirectMode, carId } = useDirectConnect()
 */

import { ref, readonly } from 'vue'
import { io } from 'socket.io-client'

// ─── Constants ────────────────────────────────────────────────────────────────

const SOCKET_URL         = 'https://data.echook.uk'
const STORAGE_CAR_ID     = 'direct-connect-car-id'
const STORAGE_MODE_FLAG  = 'direct-connect-active'   // ← key the router guard reads
const CONNECT_TIMEOUT_MS = 8000

// ─── Singleton state ──────────────────────────────────────────────────────────

const isConnected   = ref(false)
const isConnecting  = ref(false)
const carId         = ref(null)
const latestPacket  = ref(null)

/**
 * True when the user logged in via Car ID (not via normal account auth).
 * Persisted to localStorage so it survives page reloads.
 * The router guard reads this to allow access to protected routes.
 */
const isDirectMode = ref(localStorage.getItem(STORAGE_MODE_FLAG) === 'true')

/** @type {import('socket.io-client').Socket | null} */
let _socket = null
let _dataListeners = []

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _teardown() {
  if (_socket) {
    _socket.removeAllListeners()
    _socket.disconnect()
    _socket = null
  }
  isConnected.value  = false
  isConnecting.value = false
}

function _dispatch(packet) {
  latestPacket.value = packet
  for (const cb of _dataListeners) {
    try { cb(packet) } catch (e) { console.error('[DirectConnect] listener error', e) }
  }
}

function _persist(id) {
  try {
    localStorage.setItem(STORAGE_CAR_ID,    id)
    localStorage.setItem(STORAGE_MODE_FLAG, 'true')
  } catch {}
  isDirectMode.value = true
}

function _clear() {
  try {
    localStorage.removeItem(STORAGE_CAR_ID)
    localStorage.removeItem(STORAGE_MODE_FLAG)
  } catch {}
  isDirectMode.value = false
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Connect to data.echook.uk and join the car room.
 * Sets isDirectMode = true on success so the router guard lets the user
 * navigate to the dashboard.
 *
 * @param   {string}       id   24-char Car ObjectId
 * @returns {Promise<void>}     Resolves when connected; rejects on failure.
 */
function connect(id) {
  return new Promise((resolve, reject) => {
    const trimmed = (id || '').trim()
    if (!trimmed) return reject(new Error('Please enter a Car ID.'))

    _teardown()
    isConnecting.value = true

    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
    })

    _socket = socket

    const timer = setTimeout(() => {
      _teardown()
      reject(new Error('Connection timed out. Please check your Car ID.'))
    }, CONNECT_TIMEOUT_MS)

    socket.on('connect', () => {
      socket.emit('join', trimmed)
      clearTimeout(timer)

      carId.value        = trimmed
      isConnected.value  = true
      isConnecting.value = false

      _persist(trimmed)   // ← sets isDirectMode = true
      resolve()
    })

    socket.on('connect_error', (err) => {
      clearTimeout(timer)
      _teardown()
      reject(new Error(`Could not reach server: ${err.message}`))
    })

    socket.on('disconnect', (reason) => {
      isConnected.value = false
      console.warn('[DirectConnect] disconnected:', reason)
    })

    socket.on('reconnect', () => {
      if (carId.value) socket.emit('join', carId.value)
      isConnected.value = true
    })

    socket.on('data', _dispatch)
  })
}

/**
 * Disconnect and fully clear the direct-connect session.
 * After calling this the router guard will no longer allow dashboard access
 * via the Car ID path.
 */
function disconnect() {
  _teardown()
  carId.value        = null
  latestPacket.value = null
  _dataListeners     = []
  _clear()            // ← sets isDirectMode = false
}

/**
 * Re-establish the connection using the stored Car ID (used on page reload).
 * Safe to call unconditionally — does nothing if no ID was stored.
 *
 * @returns {Promise<void>}
 */
function reconnect() {
  let stored = null
  try { stored = localStorage.getItem(STORAGE_CAR_ID) } catch {}
  if (stored && !isConnected.value && !isConnecting.value) {
    return connect(stored)
  }
  return Promise.resolve()
}

/**
 * Subscribe to incoming `data` packets.
 *
 * @param   {(packet: object) => void} cb
 * @returns {() => void}  Unsubscribe — call from onUnmounted().
 */
function onData(cb) {
  _dataListeners.push(cb)
  return () => { _dataListeners = _dataListeners.filter(fn => fn !== cb) }
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function useDirectConnect() {
  return {
    isConnected:  readonly(isConnected),
    isConnecting: readonly(isConnecting),
    isDirectMode: readonly(isDirectMode),  // ← read this in your router guard
    carId:        readonly(carId),
    latestPacket: readonly(latestPacket),
    connect,
    disconnect,
    reconnect,
    onData,
  }
}

// ─── Static helper (for router guard — no Vue reactivity needed there) ────────

/**
 * Reads directly from localStorage. Import this into your router file.
 *
 * @example  In router/index.js:
 *   import { isDirectModeActive } from '@/composables/useDirectConnect'
 *
 *   router.beforeEach((to) => {
 *     const authed = authStore.isAuthenticated || isDirectModeActive()
 *     if (to.meta.requiresAuth && !authed) return '/login'
 *   })
 */
export function isDirectModeActive() {
  try { return localStorage.getItem(STORAGE_MODE_FLAG) === 'true' } catch { return false }
}
