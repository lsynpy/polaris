<template>
    <div>
        <span v-text="icon" class="material-icons-round text-5xl text-ls-400 dark:text-ds-600" />
        <p class="mt-1 text-sm leading-6 text-ls-500 dark:text-ds-400">
            <slot />
            <span v-if="_user.isAdmin && suggestion == 'collectionSettings'">Please verify<br />your
                <a @click="_router.push('/settings/collection')" class="cursor-pointer text-accent-600 underline">
                    Collection settings</a>.
            </span>
        </p>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

import { useUserStore } from "@/stores/user";

export type Suggestion = "collectionSettings";

const _router = useRouter();
const _user = useUserStore();

defineProps<{
  icon: string;
  suggestion?: Suggestion;
}>();
</script>
