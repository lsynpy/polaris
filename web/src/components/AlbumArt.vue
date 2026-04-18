<template>
  <div :data-pw="testID || 'album-art'" class="w-full h-full">
    <UseImage :src="url || ''" class="w-full h-full object-cover" :class="rounding">
      <template #loading>
        <div
          class="bg-ls-200 text-ls-400 dark:bg-ds-950/30 dark:text-ds-600 w-full h-full aspect-square flex items-center justify-center"
          :class="rounding"
        >
          <Spinner />
        </div>
      </template>

      <template #error>
        <div
          class="bg-ls-200 dark:bg-ds-950/30 w-full h-full aspect-square flex items-center justify-center"
          :class="rounding"
        >
          <span class="material-icons-round text-ls-400 dark:text-ds-700">image_not_supported</span>
        </div>
      </template>
    </UseImage>
  </div>
</template>

<script setup lang="ts">
import { UseImage } from '@vueuse/components';

import Spinner from '@/components/basic/Spinner.vue';

const { rounding = 'rounded-md', testID = '' } = defineProps<{
  url: string | undefined;
  rounding?: string;
  testID?: string;
}>();
</script>
