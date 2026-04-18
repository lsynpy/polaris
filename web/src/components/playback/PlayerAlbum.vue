<template>
  <div
    class="flex flex-col lg:flex-row lg:items-center"
    :class="{ 'pointer-events-none': miniPlayer }"
  >
    <!-- TODO tooltips -->
    <div
      :class="albumURL ? 'cursor-pointer' : ''"
      class="min-h-0 lg:shrink-0 lg:w-24 lg:h-24"
      @click="onAlbumClicked"
    >
      <AlbumArt :url="artworkURL" :rounding="miniPlayer ? 'rounded-t-md' : undefined" />
    </div>

    <div
      class="min-w-0 flex flex-col px-3 py-2 lg:ml-4 lg:p-0 border border-t-0 rounded-b-lg border-ls-200 dark:border-ds-700 lg:border-0 text-md lg:text-sm"
    >
      <div
        v-if="albumName"
        class="mb-2 text-ls-900 dark:text-ds-200 overflow-hidden text-ellipsis"
        :class="albumURL ? 'cursor-pointer hover:underline hover:text-accent-600' : ''"
        @click="onAlbumClicked"
      >
        {{ albumName }}
      </div>
      <div v-else class="rounded-full w-48 h-2.5 mt-1.5 mb-3 bg-ls-200 dark:bg-ds-700" />

      <div v-if="artists" class="overflow-hidden text-ellipsis">
        <span v-for="(artist, index) in artists" :key="index" class="text-ls-500 dark:text-ds-500">
          <span
            :class="artist.url ? 'cursor-pointer hover:underline hover:text-accent-600' : ''"
            @click="onArtistClicked(artist)"
          >
            {{ artist.name }}
          </span>
          <span v-if="index < artists.length - 1">{{ ', ' }}</span>
        </span>
      </div>
      <div v-else class="rounded-full w-36 h-2.5 my-[5px] bg-ls-200 dark:bg-ds-700" />

      <div
        v-if="song && song.year"
        class="text-ls-400 dark:text-ds-600 overflow-hidden text-ellipsis"
      >
        {{ song.year }}
      </div>
      <div v-else-if="!song" class="rounded-full w-12 h-2.5 my-[5px] bg-ls-200 dark:bg-ds-700" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { makeThumbnailURL } from '@/api/endpoints';
import AlbumArt from '@/components/AlbumArt.vue';
import { isFakeArtist } from '@/format';
import { makeAlbumURLFromSong, makeArtistURL } from '@/router';
import { usePlaybackStore } from '@/stores/playback';

const props = defineProps<{
  miniPlayer: boolean;
}>();

interface Artist {
  name: string;
  url?: string;
}

const router = useRouter();
const playback = usePlaybackStore();

const song = computed(() => playback.currentSong);

const artworkURL = computed(() => {
  if (!song.value?.artwork) {
    return undefined;
  }
  const size = props.miniPlayer ? 'large' : 'small';
  return makeThumbnailURL(song.value.artwork, size);
});

const albumName = computed(() => {
  if (!song.value) {
    return undefined;
  }
  return song.value?.album || 'Unknown Album';
});

const albumURL = computed(() => {
  if (!song.value) {
    return undefined;
  }
  return makeAlbumURLFromSong(song.value);
});

const artists = computed(() => {
  if (!song.value) {
    return undefined;
  }

  let names: string[] = [];
  if (song.value.album_artists?.length) {
    names = song.value.album_artists;
  } else if (song.value.artists?.length) {
    names = song.value.artists;
  }

  if (!names.length) {
    return [{ name: 'Unknown Artist', url: undefined }];
  }

  return names.map((n) => {
    return {
      name: n,
      url: isFakeArtist(n) ? undefined : makeArtistURL(n),
    };
  });
});

function onArtistClicked(artist: Artist) {
  if (artist.url) {
    router.push(artist.url);
  }
}

function onAlbumClicked() {
  if (albumURL.value) {
    router.push(albumURL.value);
  }
}
</script>
