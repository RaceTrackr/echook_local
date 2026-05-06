<!--
  @file components/ui/ThemePicker.vue
  @brief Theme picker UI — drop this anywhere in your settings panel.
  @description Provides controls for:
               - Dark / Light mode toggle (animated sun/moon)
               - Preset accent colour swatches
               - Custom hex colour input
               All state is managed by the useTheme composable and
               persisted to localStorage automatically.

  Usage:
    <ThemePicker />   (no props needed)
-->
<script setup>
import { computed, ref } from 'vue'
import { useTheme, resolveAccent } from '../../composables/useTheme'

const { mode, accent, font, customFont, customFontName, displayFont, displayFontName,
        presets, fontOptions, setMode, setAccent, setFont,
        setCustomFont, clearCustomFont, setDisplayFont, clearDisplayFont } = useTheme()

const onFontUpload = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => setCustomFont(reader.result, file.name)
  reader.readAsDataURL(file)
  e.target.value = ''
}

const onDisplayFontUpload = (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => setDisplayFont(reader.result, file.name)
  reader.readAsDataURL(file)
  e.target.value = ''
}

const isLight = computed(() => mode.value === 'light')

/** Local copy of the custom hex input field */
const customHex = ref(accent.value)

/** Apply the typed custom hex if it's valid */
const applyCustomHex = () => {
  const val = customHex.value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(val)) {
    setAccent(val)
  }
}

/** Keep input in sync when a preset is selected */
const selectPreset = (val) => {
  setAccent(val)
  if (val !== 'adaptive') customHex.value = val
}
</script>

<template>
  <div class="space-y-8">

    <!-- ── Section: Appearance Mode ─────────────────────────────────────── -->
    <div>
      <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
        Appearance
      </h3>

      <!-- Mode toggle cards -->
      <div class="grid grid-cols-2 gap-3">

        <!-- Dark mode card -->
        <button
          @click="setMode('dark')"
          class="group relative rounded-xl border-2 p-4 transition-all duration-200 text-left overflow-hidden"
          :class="!isLight
            ? 'border-primary bg-primary/10'
            : 'border-neutral-700 hover:border-neutral-600 bg-neutral-900'"
        >
          <!-- Mini preview -->
          <div class="mb-3 rounded-lg overflow-hidden h-16 bg-neutral-900 border border-neutral-700 flex flex-col">
            <div class="h-3 bg-neutral-800 border-b border-neutral-700 flex items-center px-1.5 gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-neutral-600"></span>
              <span class="flex-1 mx-1 h-1 rounded bg-neutral-700"></span>
            </div>
            <div class="flex-1 flex items-center gap-1.5 px-2">
              <span class="w-6 h-full bg-neutral-800 border-r border-neutral-700"></span>
              <div class="flex-1 space-y-1">
                <div class="h-1.5 w-3/4 bg-neutral-700 rounded"></div>
                <div class="h-1.5 w-1/2 bg-neutral-800 rounded"></div>
              </div>
            </div>
          </div>

          <!-- Label row -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-white">Dark</span>
            <!-- Moon icon -->
            <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          </div>

          <!-- Selected tick -->
          <div v-if="!isLight"
            class="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </button>

        <!-- Light mode card -->
        <button
          @click="setMode('light')"
          class="group relative rounded-xl border-2 p-4 transition-all duration-200 text-left overflow-hidden"
          :class="isLight
            ? 'border-primary bg-primary/10'
            : 'border-neutral-700 hover:border-neutral-600 bg-neutral-900'"
        >
          <!-- Mini preview -->
          <div class="mb-3 rounded-lg overflow-hidden h-16 bg-slate-100 border border-slate-200 flex flex-col">
            <div class="h-3 bg-white border-b border-slate-200 flex items-center px-1.5 gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
              <span class="flex-1 mx-1 h-1 rounded bg-slate-200"></span>
            </div>
            <div class="flex-1 flex items-center gap-1.5 px-2">
              <span class="w-6 h-full bg-white border-r border-slate-200"></span>
              <div class="flex-1 space-y-1">
                <div class="h-1.5 w-3/4 bg-slate-200 rounded"></div>
                <div class="h-1.5 w-1/2 bg-slate-100 rounded"></div>
              </div>
            </div>
          </div>

          <!-- Label row -->
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-white">Light</span>
            <!-- Sun icon -->
            <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="4" />
              <path stroke-linecap="round" stroke-linejoin="round"
                d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </div>

          <!-- Selected tick -->
          <div v-if="isLight"
            class="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </button>

      </div>
    </div>

    <!-- ── Section: Accent Colour ────────────────────────────────────────── -->
    <div>
      <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
        Accent Colour
      </h3>

      <!-- Preset swatches -->
      <div class="grid grid-cols-5 gap-2 mb-4">
        <button
          v-for="preset in presets"
          :key="preset.value"
          @click="selectPreset(preset.value)"
          :title="preset.name"
          class="group relative h-9 rounded-lg transition-all duration-150 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-800 border border-neutral-600"
          :style="preset.value === 'adaptive'
            ? 'background: linear-gradient(135deg, #000 50%, #fff 50%)'
            : { backgroundColor: preset.value }"
          :class="accent === preset.value ? 'ring-2 ring-offset-2 ring-offset-neutral-800 scale-110 ring-gray-400' : ''"
        >
          <!-- Tick when selected -->
          <span v-if="accent === preset.value"
            class="absolute inset-0 flex items-center justify-center">
            <svg class="w-4 h-4 drop-shadow" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" stroke-width="3"
              :style="{ color: preset.value === 'adaptive' ? '#888' : resolveAccent(preset.value, mode) === '#ffffff' ? '#000' : '#fff' }">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </button>
      </div>

      <!-- Custom hex input -->
      <div class="flex items-center gap-3">
        <!-- Live colour preview swatch -->
        <div
          class="w-10 h-10 rounded-lg border-2 border-neutral-600 flex-shrink-0 transition-colors duration-200 cursor-pointer relative overflow-hidden"
          :style="{ backgroundColor: customHex }"
          title="Click to open colour picker"
        >
          <!-- Hidden native color picker overlaid for click -->
          <input
            type="color"
            :value="customHex"
            @input="e => { customHex = e.target.value; selectPreset(e.target.value) }"
            class="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            title="Pick a colour"
          />
        </div>

        <!-- Hex text input -->
        <div class="flex-1 relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono select-none">#</span>
          <input
            v-model="customHex"
            @blur="applyCustomHex"
            @keydown.enter="applyCustomHex"
            type="text"
            maxlength="7"
            placeholder="cb1557"
            class="w-full bg-neutral-900 border border-neutral-600 rounded-lg pl-7 pr-3 py-2.5 text-white text-sm font-mono
                   focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
          />
        </div>

        <!-- Apply button -->
        <button
          @click="applyCustomHex"
          class="px-4 py-2.5 bg-primary hover:opacity-90 text-white text-sm font-semibold rounded-lg transition active:scale-95"
        >
          Apply
        </button>
      </div>

      <p class="text-xs text-gray-500 mt-2">
        Enter any 6-digit hex code, or click the swatch to open the colour picker.
      </p>
    </div>

    <!-- ── Section: Team Name Font ──────────────────────────────────────── -->
    <div>
      <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
        Team Name Font
      </h3>

      <div class="relative rounded-xl border-2 p-3 transition-all duration-150"
        :class="displayFont ? 'border-primary bg-primary/10' : 'border-neutral-700 bg-neutral-900'">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-white truncate"
              :style="displayFont ? 'font-family: AppDisplayFontCustom, AppDisplayFont, sans-serif' : 'font-family: AppDisplayFont, sans-serif'">
              Team Name
            </p>
            <p class="text-xs text-gray-400 truncate leading-tight">
              {{ displayFontName || '911 Porscha (built-in default)' }}
            </p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button v-if="displayFont" @click="clearDisplayFont"
              class="text-xs text-gray-500 hover:text-red-400 transition px-2 py-1 rounded border border-neutral-700 hover:border-red-700">
              Remove
            </button>
            <label class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700
                          hover:border-primary cursor-pointer transition text-xs text-gray-300 hover:text-white">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {{ displayFont ? 'Replace' : 'Upload' }}
              <input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" class="hidden" @change="onDisplayFontUpload" />
            </label>
          </div>
        </div>
      </div>

      <p class="text-xs text-gray-500 mt-2">
        Applies only to the team name in the header and login page. Defaults to 911 Porscha. Upload to override; stored locally on this device.
      </p>
    </div>

    <!-- ── Section: Font ────────────────────────────────────────────────── -->
    <div>
      <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
        Font
      </h3>

      <!-- Custom font upload card -->
      <div class="relative mb-3 rounded-xl border-2 p-3 transition-all duration-150 overflow-hidden"
        :class="font === 'custom'
          ? 'border-primary bg-primary/10'
          : 'border-neutral-700 bg-neutral-900'">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-white truncate"
              :style="customFont ? 'font-family: AppCustomFont, sans-serif' : ''">
              Aa
            </p>
            <p class="text-xs text-gray-400 truncate leading-tight">
              {{ customFontName || 'Upload a TTF, OTF, WOFF or WOFF2 file' }}
            </p>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button v-if="customFont" @click="clearCustomFont"
              class="text-xs text-gray-500 hover:text-red-400 transition px-2 py-1 rounded border border-neutral-700 hover:border-red-700">
              Remove
            </button>
            <label class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700
                          hover:border-primary cursor-pointer transition text-xs text-gray-300 hover:text-white">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {{ customFont ? 'Replace' : 'Upload' }}
              <input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" class="hidden" @change="onFontUpload" />
            </label>
          </div>
        </div>
        <!-- Selected tick -->
        <div v-if="font === 'custom'"
          class="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
          <svg class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <!-- Preset font grid (excludes the 'custom' entry) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          v-for="opt in fontOptions.filter(o => o.value !== 'custom')"
          :key="opt.value"
          @click="setFont(opt.value)"
          class="relative rounded-xl border-2 p-3 text-left transition-all duration-150 overflow-hidden"
          :class="font === opt.value
            ? 'border-primary bg-primary/10'
            : 'border-neutral-700 hover:border-neutral-600 bg-neutral-900'"
        >
          <p class="text-base font-semibold text-white mb-0.5 truncate"
            :style="opt.google ? `font-family: '${opt.name}', sans-serif` : 'font-family: system-ui, sans-serif'">
            Aa
          </p>
          <p class="text-xs text-gray-400 truncate leading-tight">{{ opt.name }}</p>

          <div v-if="font === opt.value"
            class="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
            <svg class="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </button>
      </div>

      <p class="text-xs text-gray-500 mt-2">
        Applies to all UI text. Preset fonts require internet. Custom fonts are stored locally on this device.
      </p>
    </div>

    <!-- ── Section: Current theme preview ───────────────────────────────── -->
    <div>
      <h3 class="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
        Preview
      </h3>

      <div class="rounded-xl border border-neutral-700 overflow-hidden text-sm">
        <!-- Simulated header bar -->
        <div class="px-4 py-2.5 bg-neutral-800 border-b border-neutral-700 flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: accent }"></div>
          <span class="font-semibold text-white text-xs">Dashboard</span>
          <div class="flex-1"></div>
          <span class="text-xs px-2 py-0.5 rounded-full font-bold text-white"
            :style="{ backgroundColor: accent }">LIVE</span>
        </div>
        <!-- Simulated content -->
        <div class="px-4 py-4 bg-neutral-900 space-y-3">
          <!-- Data card row -->
          <div class="flex gap-3">
            <div v-for="label in ['Speed', 'Temp', 'Lap']" :key="label"
              class="flex-1 bg-neutral-800 rounded-lg p-2.5 border border-neutral-700">
              <div class="text-xs text-gray-400 mb-1">{{ label }}</div>
              <div class="text-sm font-bold" :style="{ color: accent }">—</div>
            </div>
          </div>
          <!-- Simulated chart placeholder -->
          <div class="h-12 bg-neutral-800 rounded-lg border border-neutral-700 flex items-center justify-center">
            <span class="text-xs text-gray-500">Graph area</span>
          </div>
          <!-- Simulated button -->
          <button
            class="w-full py-2 rounded-lg text-white font-bold text-xs transition"
            :style="{ backgroundColor: accent }">
            Primary Action
          </button>
        </div>
      </div>
    </div>

  </div>
</template>
