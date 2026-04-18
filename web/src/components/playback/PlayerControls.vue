<template>
  <div class="flex gap-4 items-center justify-center lg:justify-end">
    <div v-if="error" class="flex items-center">
      <!-- TODO error text as tooltip -->
      <span class="material-icons-round text-red-500 dark:text-red-700">error_outline</span>
    </div>
    <Spinner v-else-if="debouncedBuffering" class="text-ls-700 dark:text-ls-500" />
    <div class="flex gap-2 items-center">
      <span
        class="material-icons-round size-9 mb-0.5 text-3xl text-center rounded-lg border border-ls-0 dark:border-ds-900 active:py-px"
        :class="
          playback.hasPrevious()
            ? 'cursor-pointer text-ls-900 dark:text-ds-0 hover:border-ls-200 dark:hover:border-ds-700 hover:bg-ls-50 dark:hover:bg-white/5'
            : 'active:pointer-events-none cursor-not-allowed text-ls-400 dark:text-ds-700'
        "
        @click="skipPrevious"
      >
        skip_previous
      </span>

      <div
        class="material-icons-round py-1 size-12 text-4xl text-center text-accent-0 rounded-full ring-accent-500 dark:ring-accent-600 ring-offset-4 ring-offset-ls-0 dark:ring-offset-ds-900 active:pt-[5px]"
        :class="
          playback.currentTrack && !error
            ? 'cursor-pointer bg-accent-600 dark:bg-accent-700 hover:bg-accent-500 dark:hover:bg-accent-600 hover:ring-2'
            : 'active:pointer-events-none cursor-not-allowed text-ls-200 bg-ls-400 dark:text-ds-600 dark:bg-ds-800'
        "
        @click="togglePlayback"
      >
        {{ paused ? 'play_arrow' : 'pause' }}
      </div>

      <span
        class="material-icons-round size-9 mb-0.5 text-3xl text-center rounded-lg border border-ls-0 dark:border-ds-900 active:pt-px"
        :class="
          playback.hasNext()
            ? 'cursor-pointer text-ls-900 dark:text-ds-0 hover:border-ls-200 dark:hover:border-ds-700 hover:bg-ls-50 dark:hover:bg-white/5'
            : 'active:pointer-events-none cursor-not-allowed text-ls-400 dark:text-ds-700'
        "
        @click="skipNext"
      >
        skip_next
      </span>
    </div>

    <div class="flex items-center gap-0.5">
      <span
        class="cursor-pointer material-icons-round"
        :class="
          isQuiet ? '-translate-x-0.5 text-ls-500 dark:text-ls-500' : 'text-ls-900 dark:text-ds-200'
        "
        @click="toggleMute"
      >
        {{ isQuiet ? 'volume_mute' : 'volume_down' }}
      </span>
      <Slider v-model="volume" class="w-20" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { refDebounced } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

import Slider from '@/components/basic/Slider.vue';
import Spinner from '@/components/basic/Spinner.vue';
import { usePlaybackStore } from '@/stores/playback';

const playback = usePlaybackStore();

const props = defineProps<{
  buffering: boolean;
  error: string | null;
  paused: boolean;
}>();

const volume = defineModel<number>('volume', { required: true });

const emit = defineEmits<{
  previous: [];
  next: [];
  pause: [];
  play: [];
}>();

const debouncedVolume = refDebounced(volume, 100);
const savedVolume = ref(volume.value);
const isQuiet = computed(() => volume.value === 0);

watch(debouncedVolume, () => {
  if (debouncedVolume.value > 0) {
    savedVolume.value = debouncedVolume.value;
  }
});

const bufferingRef = computed(() => props.buffering);
const debouncedBuffering = refDebounced(bufferingRef, 100);

function togglePlayback() {
  if (props.paused) {
    emit('play');
  } else {
    emit('pause');
  }
}

async function skipPrevious() {
  emit('previous');
}

async function skipNext() {
  emit('next');
}

function toggleMute() {
  if (volume.value > 0) {
    volume.value = 0;
  } else {
    volume.value = savedVolume.value;
  }
}
</script>
