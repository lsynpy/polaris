<template>
  <ScreenFade>
    <ScreenDarkening
      v-if="props.modelValue"
      class="z-10"
      @click="emit('update:modelValue', false)"
    />
  </ScreenFade>

  <Transition appear name="slide">
    <div
      v-if="props.modelValue"
      class="z-10 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 rounded-md bg-ls-0 dark:bg-ds-950 shadow-lg shadow-accent-600/20 dark:shadow-none dark:border dark:border-ds-800 p-6 flex flex-col gap-4"
    >
      <h3 v-if="props.title" class="font-medium text-ls-600 dark:text-ds-300">{{ props.title }}</h3>
      <slot></slot>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import ScreenDarkening from './ScreenDarkening.vue';
import ScreenFade from './ScreenFade.vue';

const props = defineProps<{
  modelValue: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<style lang="css" scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  translate: 0 -20px;
  opacity: 0;
}
</style>
