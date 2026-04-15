import { acceptHMRUpdate, defineStore } from "pinia";
import { markRaw, type Ref, ref } from "vue";

import type { Playlist, PlaylistHeader } from "@/api/dto";
import {
  deletePlaylist as doDeletePlaylist,
  importPlaylists as doImportPlaylists,
  getPlaylist,
  listPlaylists,
  putPlaylist
} from "@/api/endpoints";
import { usePlaybackStore } from "./playback";
import notify from "@/notify";

export type PlaylistsState = {
  listing: PlaylistHeader[];
};

export const usePlaylistsStore = defineStore("playlists", () => {
  const listing: Ref<PlaylistHeader[]> = ref([]);
  const playlists: Ref<Map<string, Playlist>> = ref(new Map());

  async function fetchList() {
    listing.value = await listPlaylists();
    return listing.value;
  }

  async function fetchPlaylist(name: string) {
    const playlist = markRaw(await getPlaylist(name));
    playlists.value.set(name, playlist);
    return playlist;
  }

  async function save() {
    const playback = usePlaybackStore();
    const name = playback.name;
    try {
      await putPlaylist(
        name,
        playback.playlist.map((e) => e.path)
      );
      await Promise.all([fetchList(), fetchPlaylist(name)]);
    } catch (e) {
      if (e instanceof Response && e.status === 409) {
        notify(
          "Duplicate Track",
          null,
          "Playlist contains duplicate tracks",
          true
        );
      }
      throw e;
    }
  }

  async function deletePlaylist(name: string) {
    await doDeletePlaylist(name);
    await fetchList();
  }

  async function importPlaylists(files: { filename: string; content: Blob }[]) {
    await doImportPlaylists(files);
    await fetchList();
  }

  return {
    listing,
    playlists,

    deletePlaylist,
    fetchList,
    fetchPlaylist,
    importPlaylists,
    save
  };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePlaylistsStore, import.meta.hot));
}
