import { useScroll, watchThrottled, whenever } from "@vueuse/core";
import { type MaybeRef, type Ref, toRaw, type WatchSource } from "vue";
import { useScrollSizeObserver } from "vue-use-scroll-size-observer";

export interface HistoryValue {
  save: () => unknown;
  restore: (v: unknown) => void;
  restoreWhen?: (v: unknown) => WatchSource;
}

export function saveScrollState(
  el: MaybeRef<HTMLElement | null>
): HistoryValue {
  const { y: scrollY } = useScroll(el);
  const { scrollHeight } = useScrollSizeObserver(el);
  return {
    save: () => [scrollY.value, scrollHeight.value],
    restore: (v: unknown) => {
      const [y] = v as [number, number];
      scrollY.value = y;
    },
    restoreWhen: (v: unknown) => () => {
      const [, h] = v as [number, number];
      return scrollHeight.value >= h;
    }
  };
}

export function useHistory(key: string, values: (Ref | HistoryValue)[]) {
  let pendingRestores = 0;

  const watchSources = values.map((r) => {
    if ("save" in r) {
      return () => r.save();
    } else {
      return r;
    }
  });

  // Ideally we would only save state when vue-router calls `onBeforeRouteLeave`
  // However, when the user clicks the browser back button, the browser
  // history updates before vue-router's. When `onBeforeRouteLeave` runs, it
  // is too late to save data for the page we are exiting via `history.replaceState()`.
  watchThrottled(
    watchSources,
    () => {
      if (pendingRestores > 0) {
        return;
      }
      const state = values.map((r) => {
        if ("save" in r) {
          return r.save();
        } else {
          return toRaw(r.value);
        }
      });
      history.replaceState({ ...history.state, [key]: state }, "");
    },
    { throttle: 500 }
  );

  const state = history.state[key] as unknown[] | undefined;
  if (!state) {
    return false;
  }

  pendingRestores = values.length;
  for (const [i, v] of state.entries()) {
    const r = values[i];
    if ("restore" in r) {
      if (r.restoreWhen) {
        whenever(
          r.restoreWhen(v),
          () => {
            pendingRestores -= 1;
            r.restore(v);
          },
          { once: true }
        );
      } else {
        pendingRestores -= 1;
        r.restore(v);
      }
    } else {
      pendingRestores -= 1;
      r.value = v;
    }
  }

  return true;
}
