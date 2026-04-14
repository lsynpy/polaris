<template>
    <div v-if="open">
        <Teleport to="#side-panel">
            <slot />
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { useEventBus } from "@vueuse/core";
import { watch } from "vue";

import type { PanelEvent } from "./SidePanelSetup.vue";

const open = defineModel<boolean>({ required: true });

const bus = useEventBus<PanelEvent>("side-panel");

bus.on((event) => {
  if (event === "CLOSE_PANEL") {
    open.value = false;
  }
});

watch(open, () => {
  if (open.value) {
    bus.emit("OPEN_PANEL");
  } else {
    bus.emit("CLOSE_PANEL");
  }
});
</script>
