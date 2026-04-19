<template>
  <div v-bind="containerProps" tabindex="-1" class="-mx-4 px-4" @keydown="onKeyDown">
    <div v-bind="wrapperProps">
      <SongListRow
        v-for="item in virtualItems"
        :key="item.index"
        :path="item.data.key"
        :index="item.index + +!!invertStripes"
        :compact="compact"
        :selected="selectedKeys.has(item.data.key)"
        :focused="focusedKey == item.data.key"
        :style="`height: ${itemHeight}px`"
        @click="(e: MouseEvent) => clickItem(e, item.data)"
        @dblclick="onSongDoubleClicked(item.data.key)"
        @contextmenu="(e: MouseEvent) => onSongRightClicked(e, item.data.key)"
      />
    </div>
    <ContextMenu ref="contextMenu" :items="contextMenuItems" />
  </div>
</template>

<script setup lang="ts">
import ContextMenu, { type ContextMenuItem } from '@/components/basic/ContextMenu.vue';
import { saveScrollState, useHistory } from '@/history';
import useMultiselect from '@/multiselect';
import { makeAlbumURLFromSongPaths, makeSongURL } from '@/router';
import { usePlaybackStore } from '@/stores/playback';
import { useSongsStore } from '@/stores/songs';
import { useElementSize, useScroll, useVirtualList } from '@vueuse/core';
import { computed, nextTick, onMounted, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import SongListRow from './SongListRow.vue';

const playback = usePlaybackStore();
const router = useRouter();
const songs = useSongsStore();

const props = defineProps<{
  compact: boolean;
  invertStripes?: boolean;
}>();

const paths = defineModel<string[]>({ required: true });

const items = computed(() => paths.value.map((p) => ({ key: p })));

const itemHeight = computed(() => (props.compact ? 32 : 64));

const overscan = 1;
const {
  list: virtualItems,
  containerProps,
  wrapperProps,
  scrollTo,
} = useVirtualList(items, { itemHeight: () => itemHeight.value, overscan });
const viewport = computed(() => containerProps.ref.value);
const { y: scrollY } = useScroll(viewport);
const { height: viewportHeight } = useElementSize(viewport);

const { clickItem, focusedKey, multiselect, pivotKey, selectedKeys, selectItem, selection } =
  useMultiselect(items, { onMove: snapScrolling });

watch(itemHeight, (to, from) => {
  const halfHeight = viewportHeight.value / 2;
  const y = ((scrollY.value + halfHeight) * to) / from - halfHeight;
  nextTick(() => {
    scrollY.value = y;
  });
});

watch(paths, () => {
  scrollY.value = 0;
});

function snapScrolling() {
  const focusedIndex = items.value.findIndex((n) => n.key === focusedKey.value);
  if (focusedIndex < 0) {
    return;
  }

  const padding = 4 + overscan;
  const nodes = virtualItems.value;
  const first = nodes[0].index;
  const last = nodes[nodes.length - 1].index;

  if (focusedIndex <= first + padding) {
    scrollTo(Math.max(0, focusedIndex - padding));
  } else if (focusedIndex >= last - padding) {
    scrollTo(focusedIndex - (last - first) + padding);
  }
}

function onKeyDown(event: KeyboardEvent) {
  multiselect.onKeyDown(event);
  if (event.code === 'Enter') {
    queueSelection(!event.shiftKey);
  }
}

function queueSelection(replace: boolean) {
  const tracks = selection.value.map((s) => s.key);
  if (!tracks.length) {
    return;
  }

  if (replace) {
    playback.clear();
    playback.stop();
  }
  playback.queueTracks(tracks);
}

function onSongDoubleClicked(path: string) {
  playback.clear();
  playback.stop();
  playback.queueTracks([path]);
}

function onSongRightClicked(e: MouseEvent, path: string) {
  if (!selectedKeys.value.has(path)) {
    selectItem({ key: path });
  }
  contextMenu.value?.show(e);
}

const contextMenu = useTemplateRef('contextMenu');
const contextMenuItems = computed(() => {
  const selectedSongs = selection.value.map((s) => s.key);

  const items: ContextMenuItem[] = [
    {
      label: 'Play',
      shortcut: 'Enter',
      action: () => {
        queueSelection(true);
      },
    },
    {
      label: 'Queue',
      shortcut: 'Shift+Enter',
      action: () => {
        queueSelection(false);
      },
    },
  ];

  const albumURL = makeAlbumURLFromSongPaths(selectedSongs);
  if (albumURL) {
    items.push({
      label: 'Album Details',
      action: () => {
        router.push(albumURL);
      },
    });
  }

  if (selectedSongs.length === 1) {
    const songURL = makeSongURL(selectedSongs[0]);
    items.push({
      label: 'File Properties',
      action: () => {
        router.push(songURL);
      },
    });
  }

  return items;
});

useHistory('song-list', [paths, selectedKeys, focusedKey, pivotKey, saveScrollState(viewport)]);

onMounted(() => {
  songs.request(paths.value);
});
</script>
