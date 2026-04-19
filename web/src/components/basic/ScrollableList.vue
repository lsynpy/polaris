<template>
  <div ref="viewport" class="overflow-y-auto overflow-x-hidden" tabindex="-1" @keydown="onKeyDown">
    <div
      ref="wrapper"
      class="relative min-h-full divide-ls-200 dark:border-ds-700"
      :class="{ 'divide-y': divider }"
      :style="{ height: `${props.items.length * rowHeight}px` }"
    >
      <div
        v-for="(item, index) of visibleItems"
        :key="item.key"
        class="absolute w-full"
        :style="{
          translate: `0 ${rowOffset(firstVisibleIndex + index)}px`,
          height: `${itemHeight}px`,
        }"
        @click="(e) => clickItem(e, item)"
      >
        <slot
          name="default"
          :item="item"
          :index="firstVisibleIndex + index"
          :selected="selectedKeys.has(item.key)"
          :focused="focusedKey == item.key"
        >
          <div
            class="whitespace-nowrap"
            :class="{ 'bg-accent-500': selectedKeys.has(item.key) }"
            :style="{ height: itemHeight + 'px' }"
          >
            {{ item }}
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends { key: string | number }">
import { useElementSize, useScroll } from '@vueuse/core';
import { computed, nextTick, useTemplateRef, watch } from 'vue';

import useMultiselect from '@/multiselect';

const { divider = false, ...props } = defineProps<{
  items: T[];
  itemHeight: number;
  divider?: boolean;
}>();

const emit = defineEmits<{
  'list-delete': [items: T[]];
}>();

const viewport = useTemplateRef('viewport');
const wrapper = useTemplateRef('wrapper');

const { y: scrollY } = useScroll(viewport);
const { height: rawViewportHeight } = useElementSize(viewport);
const viewportHeight = computed(() => rawViewportHeight.value || viewport.value?.clientHeight || 0);

const dividerHeight = computed(() => (divider ? 1 : 0));
const rowHeight = computed(() => props.itemHeight + dividerHeight.value);

function rowOffset(index: number) {
  return index * rowHeight.value - (index > 0 ? dividerHeight.value : 0);
}

const firstVisibleIndex = computed(() => {
  return Math.floor(scrollY.value / rowHeight.value);
});

const numVisibleItems = computed(() => {
  return 1 + Math.ceil(viewportHeight.value / rowHeight.value);
});

const { clickItem, multiselect, focusedKey, pivotKey, selectedKeys, selection, selectItem } =
  useMultiselect(() => props.items, {
    onMove: () => snapScrolling('clamp', 'instant'),
  });

const visibleItems = computed(() => {
  return props.items.slice(
    firstVisibleIndex.value,
    firstVisibleIndex.value + numVisibleItems.value
  );
});

watch(
  () => props.itemHeight,
  (to, from) => {
    const halfHeight = viewportHeight.value / 2;
    const y = ((scrollY.value + halfHeight) * to) / from - halfHeight;
    nextTick(() => {
      scrollY.value = y;
    });
  }
);

defineExpose({ isIdle, isSelected, selectItem, selection, snapScrolling });

function isIdle() {
  return true;
}

function isSelected(key: string | number) {
  return selectedKeys.value.has(key);
}

function onKeyDown(event: KeyboardEvent) {
  multiselect.onKeyDown(event);
  switch (event.code) {
    case 'Delete':
      deleteSelection();
      event.preventDefault();
      break;
    default:
      break;
  }
}

function snapScrolling(mode: 'clamp' | 'center', behavior: ScrollBehavior) {
  const focusedIndex = props.items.findIndex((i) => i.key === focusedKey.value);
  if (focusedIndex < 0) {
    return;
  }

  if (document.hidden) {
    behavior = 'instant';
  }

  let y = scrollY.value;
  if (mode === 'clamp') {
    const padding = 4;
    const first = firstVisibleIndex.value;
    const last = first + visibleItems.value.length - 1;
    if (focusedIndex < first + padding) {
      y = rowHeight.value * (focusedIndex - padding);
    } else if (focusedIndex > last - padding) {
      y = rowHeight.value * (focusedIndex - (last - first) + padding);
    }
  } else {
    y = (focusedIndex + 0.5) * rowHeight.value - viewportHeight.value / 2;
  }

  if (rowHeight.value * props.items.length > 50 * window.innerHeight) {
    behavior = 'instant';
  }

  viewport.value?.scrollTo({ top: y, behavior });
}

function deleteSelection() {
  const pivot = props.items.findIndex((i) => i.key === pivotKey.value);
  const newSelection = props.items.find(
    (item, index) => pivot >= 0 && index > pivot && !selectedKeys.value.has(item.key)
  );

  emit('list-delete', selection.value);

  if (newSelection) {
    selectItem(newSelection);
    nextTick(() => snapScrolling('clamp', 'instant'));
  }
}
</script>
