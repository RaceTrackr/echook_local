<!--
  @file views/LoginView.vue
  @brief Login page — Car ID direct connect only.
-->
<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDirectConnect } from '../composables/useDirectConnect'
import { useSettingsStore } from '../stores/settings'
import bgImage from '../assets/background.jpg'

const router        = useRouter()
const directConnect = useDirectConnect()
const settings      = useSettingsStore()

const carIdInput = ref('')
const error      = ref('')
const isLoading  = ref(false)

const savedCars = computed(() => settings.savedCars ?? [])

const handleCarIdConnect = async (id = carIdInput.value) => {
  error.value = ''
  const trimmed = (id || '').trim()
  if (!trimmed) { error.value = 'Please enter a Car ID.'; return }
  isLoading.value = true
  try {
    await directConnect.connect(trimmed)
    router.push('/')
  } catch (err) {
    error.value = err?.message || 'Could not connect. Check the Car ID and try again.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-neutral-900 overflow-hidden" :style="{
    backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${settings.loginBackground || bgImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  }">
    <div class="flex-1 flex items-center justify-center px-4">
      <div class="w-full max-w-sm">

        <div class="rounded-2xl shadow-2xl p-8"
          style="background: rgba(255,255,255,0.08); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255,255,255,0.18);">

          <!-- Badge + team name -->
          <div v-if="settings.teamBadge" class="flex justify-center mb-4">
            <img :src="settings.teamBadge" class="h-16 w-auto object-contain drop-shadow" alt="Team badge" />
          </div>
          <h1 class="app-display-font text-2xl font-bold text-center mb-1" style="color: #ffffff; text-shadow: 0 1px 4px rgba(0,0,0,0.5)">
            {{ settings.teamName }}
          </h1>
          <p class="text-sm text-center mb-7" style="color: rgba(255,255,255,0.55)">
            {{ savedCars.length > 0 ? 'Select your car to connect' : 'Enter your Car ID to connect' }}
          </p>

          <!-- Error -->
          <div v-if="error"
            class="mb-4 px-3 py-2 rounded-lg text-sm text-center"
            style="background: rgba(153,27,27,0.5); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5">
            {{ error }}
          </div>

          <!-- Saved cars — primary UI when cars exist -->
          <div v-if="savedCars.length > 0" class="space-y-2">
            <button v-for="car in savedCars" :key="car.id"
              @click="handleCarIdConnect(car.id)"
              :disabled="isLoading"
              class="w-full text-left px-5 py-3.5 rounded-xl text-sm font-semibold transition disabled:opacity-50"
              style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.15); color: #ffffff;"
              @mouseenter="e => { if (!isLoading) e.currentTarget.style.background='rgba(255,255,255,0.12)' }"
              @mouseleave="e => e.currentTarget.style.background='rgba(0,0,0,0.25)'">
              <span class="flex items-center justify-between">
                <span>{{ car.name || car.label || car.id }}</span>
                <svg v-if="!isLoading" class="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <svg v-else class="w-4 h-4 animate-spin opacity-50" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              </span>
            </button>
          </div>

          <!-- Manual Car ID input — only shown when no saved cars -->
          <div v-else class="space-y-3">
            <input
              v-model="carIdInput"
              type="text"
              placeholder="Car ID"
              autofocus
              @keydown.enter="handleCarIdConnect()"
              class="w-full rounded-xl px-4 py-3 outline-none transition text-sm focus:ring-1 focus:ring-primary"
              style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.15); color: #ffffff;" />

            <button
              @click="handleCarIdConnect()"
              :disabled="isLoading || !carIdInput.trim()"
              class="w-full bg-primary hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed
                     font-bold py-3 rounded-xl transition active:scale-95 text-sm"
              style="color: #ffffff">
              {{ isLoading ? 'Connecting…' : 'Connect' }}
            </button>
          </div>

        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
input::placeholder {
  color: rgba(255, 255, 255, 0.35);
}
</style>
