<template>
    <div data-pw="song" class="relative grow min-w-0 rounded-sm flex items-start py-1"
        :class="rowClass">
        <!-- Album Art -->
        <div v-if="!compact" class="basis-10 h-10 mr-3 shrink-0 flex items-center">
            <AlbumArt :url="artworkURL" />
        </div>
        <!-- Title + Artist (2 lines) -->
        <div v-if="!compact" class="grow basis-0 pr-0 flex flex-col justify-center min-w-0 -mr-4">
            <div class="truncate" v-if="song">
                {{ formatTitle(song) }}
            </div>
            <div v-else class="space-y-1.5">
                <div class="bg-black/5 dark:bg-white/5 h-3 rounded-full w-3/4" />
                <div class="bg-black/5 dark:bg-white/5 h-2.5 rounded-full w-1/2" />
            </div>
            <div class="truncate text-[11px] opacity-70" v-if="song">
                {{ formatArtists(song.artists || []) }}
            </div>
        </div>
        <!-- Compact: single line with title + artist -->
        <div v-if="compact" class="grow basis-0 text-ellipsis overflow-hidden" :class="{ 'overflow-hidden': song }">
            <span v-if="song" v-text="formatTrackShort(song)" />
            <div v-else class="bg-black/5 dark:bg-white/5 h-3 rounded-full" />
        </div>
        <!-- Album -->
        <div v-if="!compact" class="basis-72 shrink-0 pr-2 -ml-6 truncate self-center">
            <span v-if="song" v-text="song.album || 'Unknown Album'" />
            <div v-else class="bg-black/5 dark:bg-white/5 h-3 rounded-full" />
        </div>
        <!-- Duration -->
        <div v-if="!compact" class="basis-16 shrink-0 text-right self-center">
            <span v-if="song">{{ formatTrackDuration(song) }}</span>
            <div v-else class="bg-black/5 dark:bg-white/5 h-3 rounded-full" />
        </div>
        <!-- Compact: duration only -->
        <div v-if="compact" class="basis-16 shrink-0 text-right">
            <span v-if="song">{{ formatTrackDuration(song) }}</span>
            <div v-else class="bg-black/5 dark:bg-white/5 h-3 rounded-full" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { Song } from "@/api/dto";
import { makeThumbnailURL } from "@/api/endpoints";
import AlbumArt from '@/components/AlbumArt.vue';
import { formatArtists, formatDuration, formatTitle } from '@/format';
import { useSongsStore } from '@/stores/songs';

const songs = useSongsStore();

const props = defineProps<{
    path: string,
    index: number,
    compact: boolean,
    selected: boolean,
    focused: boolean,
    isCurrent?: boolean,
}>();

const song = computed(() => songs.cache.get(props.path));

const artworkURL = computed(() => song.value?.artwork ? makeThumbnailURL(song.value.artwork, "tiny") : undefined);

const rowClass = computed(() => {

    const isOdd = props.index % 2 == 1;

    let background;
    if (props.selected) {
        background = "bg-accent-100 dark:bg-accent-900";
    } else if (props.compact) {
        background = isOdd ? "bg-ls-50 hover:bg-ls-100 dark:bg-ds-800/30 dark:hover:bg-ds-700/30" : "bg-ls-0 hover:bg-ls-100 dark:bg-ds-900/30 dark:hover:bg-ds-700/30";
    } else {
        background = [
            "bg-gradient-to-r from-ls-0/0 dark:from-ds-900/0 to-[50px] hover:to-ls-100 dark:hover:to-ds-700/20",
            isOdd ? "to-ls-50 dark:to-ds-800/20" : "to-ls-0 dark:to-ds-900/20",
        ];
    }

    let text;
    if (props.isCurrent && props.selected) {
        text = "text-accent-700 dark:text-accent-100";
    } else if (props.selected) {
        text = "text-accent-700 dark:text-accent-200";
    } else if (props.isCurrent) {
        text = "text-ls-700 dark:text-ds-0";
    } else {
        text = "text-ls-700 dark:text-ds-400";
    }

    return [
        text,
        background,
        props.isCurrent ? "font-semibold" : "",
        props.compact ? "px-3" : "pr-2",
        !props.compact && props.selected ? "-ml-2 pl-2" : "",
        props.focused ? "outline-1 outline-dotted outline-accent-500 -outline-offset-1" : "",
    ];

});

function formatTrackDuration(song: Song) {
    if (!song.duration || isNaN(song.duration)) {
        return "??:??";
    }
    return formatDuration(song.duration);
}

function formatTrackShort(song: Song) {
    let formatted = "";
    if (song.album_artists) {
        formatted += formatArtists(song.album_artists);
    } else if (song.artists) {
        formatted += formatArtists(song.artists);
    } else {
        formatted += "Unknown Artist";
    }
    formatted += ` - ${formatTitle(song)}`;
    return formatted;
}
</script>