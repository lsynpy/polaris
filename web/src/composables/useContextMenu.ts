import { computed } from "vue";
import { usePlaybackStore } from "@/stores/playback";
import type { ContextMenuItem } from "@/components/basic/ContextMenu.vue";

export function useContextMenu(getPaths: () => string[] | Promise<string[]>) {
  const playback = usePlaybackStore();

  const contextMenuItems = computed<ContextMenuItem[]>(() => {
    const paths = getPaths();
    const pathsArray = paths instanceof Promise ? [] : paths;
    if (!pathsArray.length) return [];

    return [
      {
        label: "Play",
        shortcut: "Enter",
        testID: "play",
        action: async () => {
          const tracks = paths instanceof Promise ? await paths : paths;
          playback.clear();
          playback.stop();
          playback.queueTracks(tracks);
        }
      },
      {
        label: "Queue",
        shortcut: "Shift+Enter",
        testID: "queue",
        action: async () => {
          const tracks = paths instanceof Promise ? await paths : paths;
          playback.queueTracks(tracks);
        }
      }
    ];
  });

  return { contextMenuItems };
}
