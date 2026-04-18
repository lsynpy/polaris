<template>
  <div class="flex flex-col gap-4">
    <h2 class="text-2xl font-semibold text-ls-900 dark:text-ds-200" v-text="title" />
    <p class="mb-4 text-ls-500 dark:text-ds-400" v-text="description" />
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>
