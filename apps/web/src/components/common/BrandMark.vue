<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 })
</script>

<template>
  <svg
    class="brand-mark"
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    aria-hidden="true"
  >
    <rect width="32" height="32" rx="9" fill="var(--nd-accent)" />
    <path
      d="M10.5 8h7.2L23 13.3v10.2A1.5 1.5 0 0 1 21.5 25h-11A1.5 1.5 0 0 1 9 23.5V9.5A1.5 1.5 0 0 1 10.5 8Z"
      fill="var(--nd-accent-contrast)"
      fill-opacity="0.96"
    />
    <path
      d="M17.5 8.4v5.1h5"
      stroke="var(--nd-accent)"
      stroke-opacity="0.55"
      stroke-width="1.3"
      stroke-linejoin="round"
    />
    <path
      d="M16 13.6v6.6m0 0-2.9-2.9m2.9 2.9 2.9-2.9"
      stroke="var(--nd-accent)"
      stroke-width="1.9"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.brand-mark {
  display: block;
  flex: 0 0 auto;
}
</style>
