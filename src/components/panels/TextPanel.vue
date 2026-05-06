<!--
  @file components/panels/TextPanel.vue
  @brief Free-text panel with basic markdown rendering.
  @description Renders custom text content with support for:
               # Headings (h1–h3)
               **bold**, *italic*, `code`
               Blank lines → paragraph breaks
               No external dependencies — inline parser only.
-->
<script setup>
import { computed } from 'vue'
import { useTheme } from '../../composables/useTheme'

const props = defineProps({
  panel:       { type: Object,  required: true },
  displayName: { type: String,  default: ''    },
  isStale:     { type: Boolean, default: false },
})

const { mode } = useTheme()
const isLight = computed(() => mode.value === 'light')

/**
 * Tiny markdown → HTML converter.
 * Supports: # headings, **bold**, *italic*, `code`, paragraph breaks.
 */
const rendered = computed(() => {
  const raw = props.panel.content ?? ''
  if (!raw.trim()) return '<p class="opacity-40 italic">No content</p>'

  // Split into blocks on blank lines
  const blocks = raw.split(/\n{2,}/)

  return blocks.map(block => {
    const trimmed = block.trim()

    // Headings
    if (/^### /.test(trimmed))
      return `<h3 class="text-sm font-bold mb-1 mt-2">${inline(trimmed.slice(4))}</h3>`
    if (/^## /.test(trimmed))
      return `<h2 class="text-base font-bold mb-1 mt-2">${inline(trimmed.slice(3))}</h2>`
    if (/^# /.test(trimmed))
      return `<h1 class="text-lg font-bold mb-1 mt-2">${inline(trimmed.slice(2))}</h1>`

    // Unordered list
    if (/^[-*] /m.test(trimmed)) {
      const items = trimmed.split('\n')
        .map(l => l.replace(/^[-*] /, ''))
        .filter(Boolean)
        .map(l => `<li class="ml-4 list-disc">${inline(l)}</li>`)
        .join('')
      return `<ul class="mb-1">${items}</ul>`
    }

    // Paragraph — preserve single line-breaks within a block
    const lines = trimmed.split('\n').map(l => inline(l)).join('<br/>')
    return `<p class="mb-1 leading-snug">${lines}</p>`
  }).join('')
})

/** Inline markdown: bold, italic, code */
function inline(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code class="px-1 rounded text-xs font-mono bg-black/10 dark:bg-white/10">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g,   '<em>$1</em>')
}

const textSizeClass = computed(() => ({
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
}[props.panel.fontSize ?? 'md'] ?? 'text-sm'))
</script>

<template>
  <div
    class="h-full w-full overflow-hidden flex flex-col px-3 py-2 select-none"
    :class="textSizeClass">

    <!-- Optional title -->
    <p v-if="panel.title"
      class="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2 flex-shrink-0">
      {{ panel.title }}
    </p>

    <!-- Rendered markdown -->
    <div
      class="flex-1 overflow-hidden prose-sm leading-snug"
      :class="isLight ? 'text-gray-800' : 'text-gray-200'"
      v-html="rendered" />

  </div>
</template>
