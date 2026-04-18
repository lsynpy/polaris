<template>
  <div class="w-full h-full">
    <div class="w-full h-full" :data-pw="testId" :draggable="!disabled">
      <div class="w-full h-full" :class="{ 'pointer-events-none': !allowPointerEventsInside }">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const {
  allowPointerEventsInside = false,
  disabled = false,
  testId = '',
} = defineProps<{
  allowPointerEventsInside?: boolean;
  disabled?: boolean;
  testId?: string;
}>();

defineEmits<(event: 'draggableStart', mouseEvent: DragEvent) => void>();
</script>
