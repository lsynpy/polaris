import { acceptHMRUpdate, defineStore } from "pinia";
import { type ShallowRef, shallowRef, triggerRef } from "vue";
import type { Song } from "@/api/dto";
import { get_songs } from "@/api/endpoints";

export const useSongsStore = defineStore("songs", () => {
  const cache: ShallowRef<Map<string, Song>> = shallowRef(new Map());
  const requested = new Set<string>();
  const failed = new Set<string>();
  let fetching = false;

  function request(paths: string[]) {
    const cached = cache.value;
    for (const path of paths) {
      if (!cached.has(path) && !failed.has(path)) {
        requested.add(path);
      }
    }
    fetch();
  }

  function ingest(songs: Song[]) {
    const cached = cache.value;
    for (const song of songs) {
      cached.set(song.path, song);
      requested.delete(song.path);
      failed.delete(song.path);
    }
    triggerRef(cache);
  }

  async function fetch() {
    if (fetching || requested.size === 0) {
      return;
    }
    fetching = true;

    let batch = [];
    const fetches = [];
    let songCount = 0;
    const cached = cache.value;

    for (const path of requested) {
      if (cached.has(path) || failed.has(path)) {
        continue;
      }
      songCount += 1;
      batch.push(path);
      if (batch.length >= 2000) {
        fetches.push(fetchBatch(batch));
        batch = [];
      }
    }
    fetches.push(fetchBatch(batch));

    await Promise.all(fetches);

    fetching = false;

    if (songCount !== 0) {
      fetch();
    }
  }

  async function fetchBatch(batch: string[]) {
    if (batch.length === 0) {
      return;
    }

    try {
      const results = await get_songs(batch);
      ingest(results.songs);
      for (const path of results.not_found) {
        failed.add(path);
      }
    } catch (_e) {
      for (const path of batch) {
        failed.add(path);
      }
    }

    for (const path of batch) {
      requested.delete(path);
    }
  }

  return {
    cache,
    ingest,
    request
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useSongsStore, import.meta.hot));
}
