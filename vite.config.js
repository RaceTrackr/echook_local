import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Forward the browser's real IP to settings-server so /api/is-local works
// correctly for devices on the network (Vite proxy otherwise always appears
// as 127.0.0.1 to the backend).
function forwardRealIp(proxy) {
  proxy.on('proxyReq', (proxyReq, req) => {
    const ip = req.socket?.remoteAddress || req.headers['x-forwarded-for'] || ''
    proxyReq.setHeader('x-real-ip', ip)
  })
}

export default defineConfig({
  plugins: [vue()],

  server: {
    host: true,

    proxy: {
      '/api/settings': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: false,
        configure: forwardRealIp,
      },
      '/api/assets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: false,
        configure: forwardRealIp,
      },
      '/api/history': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: false,
        configure: forwardRealIp,
      },
      '/api/telemetry': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: false,
        configure: forwardRealIp,
      },
      '/api/network-info': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: false,
      },
      '/api/is-local': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: false,
        configure: forwardRealIp,
      },
      '/api': {
        target: 'https://data.echook.uk',
        changeOrigin: true,
        secure: true,
        ws: false,
      },
      '/auth': {
        target: 'https://data.echook.uk',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: 'localhost',
        ws: false,
      },
    },
  },
})
