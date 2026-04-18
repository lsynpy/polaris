<template>
  <div>
    <span class="material-icons-round text-5xl text-ls-400 dark:text-ds-600" v-text="icon" />
    <p class="mt-1 text-sm leading-6 text-ls-500 dark:text-ds-400">
      <slot />
      <span v-if="user.isAdmin && suggestion == 'collectionSettings'"
        >Please verify<br />your
        <a
          class="cursor-pointer text-accent-600 underline"
          @click="router.push('/settings/collection')"
        >
          Collection settings</a
        >.
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

import { useUserStore } from '@/stores/user';

export type Suggestion = 'collectionSettings';

const router = useRouter();
const user = useUserStore();

defineProps<{
  icon: string;
  suggestion?: Suggestion;
}>();
</script>
