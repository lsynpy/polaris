<template>
  <div class="flex flex-col gap-2">
    <ContextMenu :items="contextMenuItems">
      <div
        :class="size == 'lg' ? 'hover:scale-105' : 'hover:scale-110'"
        class="cursor-pointer aspect-square w-full min-h-0 origin-center transition-all ease-out duration-100 hover:opacity-90"
        @click="router.push(makeAlbumURL(album.main_artists, album.name))"
      >
        <AlbumArt :url="album.artwork ? makeThumbnailURL(album.artwork, 'small') : undefined" />
      </div>
    </ContextMenu>
    <div class="font-medium text-sm whitespace-normal text-ls-500 dark:text-ds-400">
      <span class="mb-1 line-clamp-2 text-ls-900 dark:text-ds-200" v-text="album.name" />
      <span v-if="showArtists" class="line-clamp-1">
        <span v-for="(artist, index) of album.main_artists" :key="index">
          <span
            :class="{
              'cursor-pointer hover:underline hover:text-accent-600': !isFakeArtist(artist),
            }"
            @click="onArtistClicked(artist)"
            v-text="artist"
          />
          <span v-if="index < album.main_artists.length - 1" v-text="`, `" />
        </span>
      </span>
      <span v-if="!showArtists" v-text="album.year" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

import type { AlbumHeader, AlbumKey } from '@/api/dto';
import { getAlbum, makeThumbnailURL } from '@/api/endpoints';
import AlbumArt from '@/components/AlbumArt.vue';
import ContextMenu from '@/components/basic/ContextMenu.vue';
import { isFakeArtist } from '@/format';
import { makeAlbumURL, makeArtistURL } from '@/router';
import { usePlaybackStore } from '@/stores/playback';

const router = useRouter();
const playback = usePlaybackStore();

const props = defineProps<{
  album: AlbumHeader;
  showArtists: boolean;
  size: 'md' | 'lg';
}>();

function onArtistClicked(name: string) {
  if (!isFakeArtist(name)) {
    router.push(makeArtistURL(name));
  }
}

const contextMenuItems = [
  {
    label: 'Play',
    action: () => {
      play(true);
    },
  },
  {
    label: 'Queue',
    action: () => {
      play(false);
    },
  },
];

async function play(replace: boolean) {
  const key: AlbumKey = {
    name: props.album.name,
    artists: props.album.main_artists,
  };

  const songs = await getAlbum(key).then((a) => a.songs.map((s) => s.path));

  if (replace) {
    playback.clear();
    playback.stop();
  }

  playback.queueTracks(songs);
}
</script>
