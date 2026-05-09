/**
 * @file settings-server.js
 * @brief Tiny local settings server for echook_live.
 * @description Stores and serves shared settings as a JSON file so all
 *              devices on the local network share the same base configuration.
 *
 * Usage:
 *   node settings-server.js
 *
 * Runs on port 3001. Vite proxies /api to this server.
 * Settings are stored in settings-data.json next to this file.
 */

import express  from 'express'
import cors     from 'cors'
import fs       from 'fs'
import os       from 'os'
import path     from 'path'
import { fileURLToPath } from 'url'

const __dirname     = path.dirname(fileURLToPath(import.meta.url))
const app           = express()
const PORT          = 3001
const SETTINGS_FILE = path.join(__dirname, 'settings-data.json')
const HISTORY_DIR   = path.join(__dirname, 'telemetry-history')
const ASSETS_DIR    = path.join(__dirname, 'server-assets')

// Ensure directories exist
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR)
if (!fs.existsSync(ASSETS_DIR))  fs.mkdirSync(ASSETS_DIR)

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))
app.use(express.raw({ limit: '50mb' }))

// ── Asset storage (badge + login background) ──────────────────────────────────
// Images are saved as files so every device on the network can load them by URL
// rather than having large base64 blobs travelling through the settings JSON.

const ASSET_EXT = { badge: 'png', background: 'jpg' }
const ASSET_MIME = { badge: 'image/png', background: 'image/jpeg' }
const assetPath = (name) => path.join(ASSETS_DIR, `${name}.${ASSET_EXT[name]}`)

app.post('/api/assets/:name', (req, res) => {
  const { name } = req.params
  if (!ASSET_EXT[name]) return res.status(400).json({ error: 'Unknown asset' })
  const { data } = req.body
  if (typeof data !== 'string' || !data.startsWith('data:'))
    return res.status(400).json({ error: 'Expected base64 data URL' })
  const match = data.match(/^data:[^;]+;base64,(.+)$/)
  if (!match) return res.status(400).json({ error: 'Invalid data URL' })
  fs.writeFileSync(assetPath(name), Buffer.from(match[1], 'base64'))
  console.log(`[settings-server] Asset '${name}' saved`)
  res.json({ ok: true })
})

app.get('/api/assets/:name', (req, res) => {
  const { name } = req.params
  if (!ASSET_EXT[name]) return res.status(400).json({ error: 'Unknown asset' })
  const file = assetPath(name)
  if (!fs.existsSync(file)) return res.status(404).end()
  try {
    const buffer = fs.readFileSync(file)
    res.setHeader('Content-Type', ASSET_MIME[name])
    res.setHeader('Cache-Control', 'no-cache')
    res.end(buffer)
  } catch (err) {
    console.error('[settings-server] Failed to read asset:', name, err.message)
    res.status(500).end()
  }
})

app.delete('/api/assets/:name', (req, res) => {
  const { name } = req.params
  if (!ASSET_EXT[name]) return res.status(400).json({ error: 'Unknown asset' })
  const file = assetPath(name)
  if (fs.existsSync(file)) fs.unlinkSync(file)
  res.json({ ok: true })
})

// ── GET /api/settings ─────────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return res.json({})
    const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'))
    res.json(data)
  } catch (err) {
    console.error('[settings-server] Failed to read settings:', err.message)
    res.status(500).json({ error: 'Failed to read settings' })
  }
})

// ── POST /api/settings ────────────────────────────────────────────────────────
app.post('/api/settings', (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object')
      return res.status(400).json({ error: 'Invalid payload' })
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(req.body, null, 2), 'utf-8')
    console.log('[settings-server] Settings saved at', new Date().toLocaleTimeString())
    res.json({ ok: true })
  } catch (err) {
    console.error('[settings-server] Failed to save settings:', err.message)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

// ── DELETE /api/settings ──────────────────────────────────────────────────────
app.delete('/api/settings', (req, res) => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) fs.unlinkSync(SETTINGS_FILE)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear settings' })
  }
})

// ── Telemetry history storage ─────────────────────────────────────────────────
// Packets are stored per-car in NDJSON files (one JSON object per line).
// This matches the format useHistory.js expects from GET /api/history/:carId.

const historyFile = (carId) =>
  path.join(HISTORY_DIR, `${carId.replace(/[^a-zA-Z0-9_-]/g, '_')}.ndjson`)

// POST /api/telemetry/:carId — append a batch of packets
// Called by the frontend as each packet arrives from Socket.IO
app.post('/api/telemetry/:carId', (req, res) => {
  try {
    const { carId } = req.params
    const packets   = Array.isArray(req.body) ? req.body : [req.body]
    if (!packets.length) return res.json({ ok: true })

    const file   = historyFile(carId)
    const lines  = packets.map(p => JSON.stringify(p)).join('\n') + '\n'
    fs.appendFileSync(file, lines, 'utf-8')
    res.json({ ok: true, stored: packets.length })
  } catch (err) {
    console.error('[settings-server] Failed to store telemetry:', err.message)
    res.status(500).json({ error: 'Failed to store telemetry' })
  }
})

// GET /api/history/:carId — serve stored history
// Supports ?start=ms&end=ms&page=N&limit=N (mirrors the real eChook API)
// GET /api/history/days/:carId — list days that have stored data
// MUST be before /api/history/:carId or Express matches 'days' as the carId
app.get('/api/history/days/:carId', (req, res) => {
  try {
    const { carId } = req.params
    const file      = historyFile(carId)

    if (!fs.existsSync(file)) return res.json([])

    const raw   = fs.readFileSync(file, 'utf-8')
    const days  = new Set()
    raw.split('\n').filter(Boolean).forEach(line => {
      try {
        const p  = JSON.parse(line)
        const ts = p.timestamp ?? p.updated
        if (ts) days.add(new Date(ts).toISOString().slice(0, 10))
      } catch {}
    })
    res.json([...days].sort())
  } catch (err) {
    res.status(500).json({ error: 'Failed to read history days' })
  }
})

// GET /api/history/:carId — serve stored history
// Supports ?start=ms&end=ms&page=N&limit=N (mirrors the real eChook API)
app.get('/api/history/:carId', (req, res) => {
  try {
    const { carId }    = req.params
    const file         = historyFile(carId)

    if (!fs.existsSync(file)) return res.json([])

    const start  = req.query.start ? Number(req.query.start) : null
    const end    = req.query.end   ? Number(req.query.end)   : null
    const page   = Math.max(1, parseInt(req.query.page  ?? 1))
    const limit  = Math.min(10000, parseInt(req.query.limit ?? 5000))

    const raw    = fs.readFileSync(file, 'utf-8')
    let packets  = raw.split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line) } catch { return null } })
      .filter(Boolean)

    // Filter by time range
    if (start) packets = packets.filter(p => (p.timestamp ?? p.updated ?? 0) >= start)
    if (end)   packets = packets.filter(p => (p.timestamp ?? p.updated ?? 0) <= end)

    // Paginate
    const offset = (page - 1) * limit
    const page_  = packets.slice(offset, offset + limit)

    res.json(page_)
  } catch (err) {
    console.error('[settings-server] Failed to read history:', err.message)
    res.status(500).json({ error: 'Failed to read history' })
  }
})

// GET /api/network-info — returns the server's local-network IP addresses and Vite port
// so the frontend can build a QR code pointing at the correct network URL.
app.get('/api/network-info', (req, res) => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address)
  res.json({ ips, port: VITE_PORT })
})

// GET /api/is-local — returns true only if the browser is on the host machine.
// Vite proxy forwards requests from all devices, so req.ip is always 127.0.0.1.
// The proxy sets X-Real-IP to the actual browser's IP so we can distinguish.
app.get('/api/is-local', (req, res) => {
  const realIp = req.headers['x-real-ip'] || req.ip || ''
  const isLocal = realIp === '127.0.0.1' || realIp === '::1' || realIp === '::ffff:127.0.0.1'
  res.json({ isLocal })
})

const VITE_PORT = 5173

app.listen(PORT, () => {
  const hostname = os.hostname()
  const networkIps = Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address)

  console.log('\n  eChook Live\n')
  console.log(`  Local:    http://localhost:${VITE_PORT}`)
  console.log(`  Host:     http://${hostname}:${VITE_PORT}`)
  networkIps.forEach(ip => {
    console.log(`  Network:  http://${ip}:${VITE_PORT}`)
  })
  console.log()
})
