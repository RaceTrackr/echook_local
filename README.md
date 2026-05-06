# eChook Live

Real-time telemetry dashboard for Greenpower electric racing cars using the eChook telemetry boards. Built with Vue 3 and designed for teams to monitor car performance during races and analyse lap-by-lap data afterwards.

![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js)
![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-010101?logo=socket.io)
![License](https://img.shields.io/badge/License-AGPL--3.0-blue)

---

## Quick Start

The simplest way to run eChook Live locally is with the provided launch scripts. They will install dependencies automatically on first run.

**Windows:**
```
start.bat
```

**macOS / Linux:**
```bash
bash start.sh
```

Once running, open the URL shown in the terminal. Share the **Network** URL with other devices on the same network to give them access.

---

## Features

### Live Telemetry
- Real-time data streaming via WebSocket (MessagePack encoded)
- Configurable data retention (up to 50 000 points)
- Auto-reconnection and gap-filling on resume

### Customisable Dashboard
- Modular panel layout — stat, graph, map, battery, and lap chart panels
- Drag-and-drop panel arrangement with resizable grid
- Per-panel alarm thresholds with visual alerts
- Data ribbon with scrollable live metrics

### Interactive Graphs
- Synchronized time-series charts with ECharts
- Lap highlighting with alternating region colours
- Zoom, pan, and keyboard shortcuts

### Live Map
- Real-time car position on OpenStreetMap
- Historical trail with speed-based colour gradient

### Race & Lap Analytics
- Automatic race and lap detection from live telemetry
- Lap-by-lap comparison table with configurable columns and delta highlighting
- Lap chart panel for visualising per-lap metrics across recent laps
- Battery state-of-charge and predicted time-to-empty panel
- CSV export for external analysis

### Admin Panel
- Team name and branding (badge, login background)
- Metric visibility management — hide/show keys from selectors
- Saved car management
- Settings sync to/from server

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Cycle between tabs |
| `Space` | Pause / Resume live data |
| `R` | Zoom to current race |
| `L` | Unlock chart zoom (return to live) |
| `←` `→` | Pan chart left / right |
| `↑` `↓` | Zoom in / out |
| `F` | Focus mode |
| `?` | Show shortcuts help |

Shortcuts are configurable in Settings.

---

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Vue 3 (Composition API) |
| Build Tool | Vite 7 |
| State | Pinia with persistence |
| Routing | Vue Router 4 |
| Charts | ECharts 6 |
| Maps | Leaflet + OpenStreetMap |
| WebSocket | Socket.IO Client 4.x |
| UI | Tailwind CSS + HeadlessUI + Heroicons |
| Local Server | Express.js |
| Testing | Vitest |

---

## Project Structure

```
echook_live/
├── settings-server.js       # Local Express server (settings + history storage)
├── settings-data.json       # Runtime settings store — gitignored
├── telemetry-history/       # On-disk telemetry history — gitignored
├── .env.development         # Dev environment (localhost)
├── .env.production          # Prod environment — gitignored, create manually
└── src/
    ├── assets/              # Fonts, images
    ├── components/
    │   ├── panels/          # Dashboard panel types (stat, battery, lap chart, …)
    │   ├── tabs/            # Tab views (graph, map, laps, grafana, settings, …)
    │   └── ui/              # Shared UI components
    ├── composables/         # Reusable logic (socket, history, alarms, theme, …)
    ├── router/              # Vue Router config
    ├── stores/              # Pinia stores (telemetry, settings, auth, admin)
    ├── utils/               # Helpers (formatting, race analytics, telemetry keys)
    └── views/               # Page-level views (Dashboard, Login, Spectator)
```

---

## License

AGPL-3.0 — see [LICENSE](LICENSE) for details.
