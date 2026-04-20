<template>
  <div class="flex flex-col">
    <PageHeader :title="name" :actions="pageActions">
      <template #post-title>
        <span
          v-if="playlist"
          class="ml-4 italic whitespace-nowrap text-xs text-ls-500 dark:text-ds-500"
          v-text="formatLongDuration(playlist.duration)"
        />
      </template>
    </PageHeader>

    <div v-if="songs.length" class="mb-8 basis-10 shrink-0 flex items-center justify-between">
      <Switch
        v-model="preferences.savedPlaylistDisplayMode"
        :items="[
          { icon: 'compress', value: 'compact' },
          { icon: 'view_list', value: 'tall' },
        ]"
      />
    </div>

    <div v-show="songs?.length" data-pw="saved-playlist-songs" class="flex flex-col min-h-0">
      <SongList
        :model-value="songs"
        :compact="preferences.savedPlaylistDisplayMode == 'compact'"
        invert-stripes
      />
    </div>

    <div v-if="songs?.length" />

    <div v-else-if="isLoading" class="grow flex mt-24 items-start justify-center">
      <Spinner />
    </div>

    <Error v-else-if="error"> Something went wrong while retrieving this playlist. </Error>

    <div v-else class="grow flex items-start mt-40 justify-center text-center">
      <BlankStateFiller icon="music_off"> This playlist is empty. </BlankStateFiller>
    </div>

    <Dialog v-model="showDeleteConfirm" title="Delete Playlist">
      <p class="text-sm text-ls-500 dark:text-ds-400">
        Are you sure you want to delete this playlist? This action cannot be undone.
      </p>
      <div class="flex gap-2 justify-end">
        <Button
          label="Cancel"
          severity="secondary"
          data-pw="delete-playlist-cancel"
          @click="showDeleteConfirm = false"
        />
        <Button
          label="Delete"
          severity="danger"
          data-pw="delete-playlist-confirm"
          @click="confirmDelete"
        />
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { watchImmediate } from '@vueuse/core';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getPlaylist } from '@/api/endpoints';
import BlankStateFiller from '@/components/basic/BlankStateFiller.vue';
import Button from '@/components/basic/Button.vue';
import Dialog from '@/components/basic/Dialog.vue';
import Error from '@/components/basic/Error.vue';
import PageHeader from '@/components/basic/PageHeader.vue';
import Spinner from '@/components/basic/Spinner.vue';
import Switch from '@/components/basic/Switch.vue';
import SongList from '@/components/SongList.vue';
import { formatLongDuration } from '@/format';
import { usePlaybackStore } from '@/stores/playback';
import { usePlaylistsStore } from '@/stores/playlists';
import { usePreferencesStore } from '@/stores/preferences';

const router = useRouter();
const playback = usePlaybackStore();
const playlists = usePlaylistsStore();
const preferences = usePreferencesStore();

const props = defineProps<{ name: string }>();

const pageActions = [
  { label: 'Play All', icon: 'play_arrow', action: play },
  {
    label: 'Delete',
    icon: 'delete',
    action: deletePlaylist,
    danger: true,
    testID: 'delete-playlist',
  },
];

const isLoading = ref(false);
const error = ref(false);
const showDeleteConfirm = ref(false);

const songs = computed(() => playlist.value?.songs.paths || []);

watchImmediate(
  () => props.name,
  async () => {
    try {
      isLoading.value = true;
      await playlists.fetchPlaylist(props.name);
    } catch {
      error.value = true;
    }
    isLoading.value = false;
  }
);

const playlist = computed(() => playlists.playlists.get(props.name));

async function play() {
  const songs = await listSongs();
  playback.clear();
  playback.stop();
  playback.queueTracks(songs);
  playback.setName(props.name);
}

function deletePlaylist() {
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  await playlists.deletePlaylist(props.name);
  await router.push('/playlists');
  showDeleteConfirm.value = false;
}

async function listSongs() {
  if (playlist.value) {
    return playlist.value.songs.paths;
  }
  return (await getPlaylist(props.name)).songs.paths;
}
</script>
