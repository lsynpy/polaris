<template>
    <div class="flex flex-col gap-2">
        <ContextMenu :items="contextMenuItems">
            <div @click="router.push(makeArtistURL(artist.name))"
                class="hover:scale-105 cursor-pointer aspect-square w-full min-h-0 origin-center
                transition-all ease-out duration-100
                hover:opacity-90
                flex items-center justify-center
                bg-ls-200 dark:bg-ds-700
                rounded-lg
                ">
                <span class="material-icons-round text-6xl text-ls-500 dark:text-ds-400">
                    person
                </span>
            </div>
        </ContextMenu>
        <div class="font-medium text-sm whitespace-normal">
            <span v-text="artist.name" class="line-clamp-2 text-ls-900 dark:text-ds-200 cursor-pointer hover:text-accent-600 hover:underline" />
            <span class="block text-ls-500 dark:text-ds-400">
                {{ `${artist.num_songs} ${pluralize('song', artist.num_songs)}` }}
            </span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

import type { ArtistHeader } from "@/api/dto";
import ContextMenu from "@/components/basic/ContextMenu.vue";
import { pluralize } from "@/format";
import { makeArtistURL } from "@/router";

const router = useRouter();

const props = defineProps<{
  artist: ArtistHeader;
  size: "md" | "lg";
}>();

const contextMenuItems = [
  {
    label: "View Artist",
    action: () => {
      router.push(makeArtistURL(props.artist.name));
    }
  }
];
</script>
