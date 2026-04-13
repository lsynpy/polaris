<template>
    <div ref="viewport" class="overflow-y-auto -m-4 p-4 mb-0 pb-0" tabindex="-1" :style="{
        gap: `${gapSize}px`,
    }">
        <div class="relative" :style="{ height: `${contentHeight}px` }">
            <ArtistGridCell ref="sampleCell" :artist="sampleArtist" :size="cellSize"
                class="absolute opacity-0" :style="{ width: `${itemWidth}px` }" />
            <ArtistGridCell v-for="(artist, index) of virtualArtists" :key="artist.name"
                :artist="artist" :size="cellSize" data-pw="artist" class="absolute" :style="{
                    width: `${itemWidth}px`,
                    left: `${((index + firstVirtual) % numColumns) * (itemWidth + gapSize)}px`,
                    top: `${Math.floor((index + firstVirtual) / numColumns) * (itemHeight + gapSize)}px`,
                }" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import { useElementSize, useMediaQuery, useScroll } from '@vueuse/core';

import { ArtistHeader } from '@/api/dto';
import ArtistGridCell from '@/components/library/ArtistGridCell.vue';

const props = defineProps<{
    artists: ArtistHeader[],
    maxRows?: number,
}>();

const gapSize = ref(32);

const isTinyScreen = useMediaQuery("(width < 80rem)");
const isSmallScreen = useMediaQuery("(width < 96rem)");
const numColumns = computed(() => isTinyScreen.value ? 2 : isSmallScreen.value ? 3 : 5);
const cellSize = computed(() =>
    numColumns.value <= 3 ? "lg" : "md",
);

const viewport = useTemplateRef("viewport");
const { width: viewportWidth, height: viewportHeight } = useElementSize(viewport);
const { y: scrollY } = useScroll(viewport);

const sampleCell = useTemplateRef("sampleCell");
const itemWidth = computed(() =>
    (viewportWidth.value - (numColumns.value - 1) * gapSize.value) / numColumns.value
);
const { height: itemHeight } = useElementSize(sampleCell);

const trimmedArtists = computed(() => {
    if (props.maxRows) {
        return props.artists.slice(0, props.maxRows * numColumns.value);
    } else {
        return props.artists;
    }
});
const contentHeight = computed(() => Math.ceil(trimmedArtists.value.length / numColumns.value) * (itemHeight.value + gapSize.value));

const firstVirtual = computed(() => Math.floor(scrollY.value / (itemHeight.value + gapSize.value)) * numColumns.value);
const numVirtualItems = computed(() => Math.ceil(1 + viewportHeight.value / (itemHeight.value + gapSize.value)) * numColumns.value);

const virtualArtists = computed(() => {
    return trimmedArtists.value.slice(firstVirtual.value, firstVirtual.value + numVirtualItems.value);
});

const sampleArtist = {
    name: "WWWW ".repeat(10),
    num_songs: 100,
    num_albums: 10,
    num_albums_as_performer: 5,
    num_albums_as_composer: 3,
    num_albums_as_lyricist: 2,
    num_albums_as_additional_performer: 1,
};

defineExpose({ contentHeight, numColumns });
</script>
