<template>
    <div class="flex flex-col whitespace-nowrap">
        <PageHeader title="Artists" :view-modes="roles" v-model:view-mode="roleFilter" />

        <div v-if="artists.length" class="grow min-h-0 flex flex-col">
            <div class="mb-8 flex items-center justify-between">
                <!-- TODO tooltips -->
                <InputText class="w-64 xl:w-80" v-model="filter" id="filter" placeholder="Filter" icon="filter_alt"
                    autofocus clearable />
                <!-- TODO tooltips -->
                <Switch v-model="sortBy" :items="[
                    { icon: 'sort_by_alpha', value: 'alpha' },
                    { icon: 'trending_up', value: 'popularity' },
                    { icon: 'history', value: 'recent' }
                ]" />
            </div>
            <ArtistGrid v-if="filtered.length" ref="list" class="grow min-h-0 -mr-4 pr-4" :artists="filtered" />
            <div v-else class="grow flex mt-40 justify-center text-center">
                <BlankStateFiller icon="filter_alt_off">
                    No artists match this filter.
                </BlankStateFiller>
            </div>

        </div>

        <div v-else-if="isLoading" class="grow flex mt-24 items-start justify-center">
            <Spinner />
        </div>

        <Error v-else-if="error">
            Something went wrong while listing artists.
        </Error>

        <div v-else-if="isReady && !artists.length" class="grow flex mt-40 justify-center text-center">
            <BlankStateFiller icon="person_off" suggestion="collectionSettings">
                No artists found.
            </BlankStateFiller>
        </div>

    </div>
</template>

<script setup lang="ts">
import { useScroll } from "@vueuse/core";
import { computed, type Ref, ref, toRaw, useTemplateRef, watch } from "vue";

import type { ArtistHeader } from "@/api/dto";
import { type ArtistSort, getArtists } from "@/api/endpoints";
import BlankStateFiller from "@/components/basic/BlankStateFiller.vue";
import Error from "@/components/basic/Error.vue";
import InputText from "@/components/basic/InputText.vue";
import PageHeader, {
  type PageViewMode
} from "@/components/basic/PageHeader.vue";
import Spinner from "@/components/basic/Spinner.vue";
import Switch from "@/components/basic/Switch.vue";
import ArtistGrid from "@/components/library/ArtistGrid.vue";
import { saveScrollState, useHistory } from "@/history";

const artists: Ref<ArtistHeader[]> = ref([]);
const isLoading = ref(true);
const isReady = ref(false);
const error = ref(false);

async function fetchArtists(sort?: ArtistSort) {
  isLoading.value = true;
  error.value = false;
  try {
    artists.value = await getArtists(sort);
    isReady.value = true;
  } catch (e) {
    error.value = true;
  } finally {
    isLoading.value = false;
  }
}

fetchArtists();

const filter = ref("");
const sortBy = ref<ArtistSort>("alpha");

watch(sortBy, (newSort) => {
  fetchArtists(newSort);
});

type ArtistRole = "performer" | "composer" | "lyricist";
const roleFilter: Ref<ArtistRole> = ref("performer");
const roles: PageViewMode<ArtistRole>[] = [
  { label: "Performers", value: "performer" },
  { label: "Composers", value: "composer" },
  { label: "Lyricists", value: "lyricist" }
];

function isRelevant(artist: ArtistHeader) {
  return (
    artist.num_albums_as_performer > 0 ||
    artist.num_albums_as_composer > 0 ||
    artist.num_albums_as_lyricist > 0 ||
    artist.num_albums_as_additional_performer > 1
  );
}

const filtered = computed(() => {
  const query = filter.value.toLowerCase();
  return artists.value.filter((a) => {
    if (!isRelevant(a)) {
      return false;
    }
    switch (roleFilter.value) {
      case "performer":
        if (
          a.num_albums_as_performer < 1 &&
          a.num_albums_as_additional_performer < 2
        ) {
          return false;
        }
        break;
      case "composer":
        if (a.num_albums_as_composer < 1) {
          return false;
        }
        break;
      case "lyricist":
        if (a.num_albums_as_lyricist < 1) {
          return false;
        }
        break;
    }
    if (!filter.value.length) {
      return true;
    }
    return a.name.toLowerCase().includes(query);
  });
});

const list = useTemplateRef("list");
const viewport = computed(() => list.value?.$el);
const { y: scrollY } = useScroll(viewport);

watch(filtered, () => (scrollY.value = 0));

const saveArtists = {
  save: () => toRaw(artists.value).filter(isRelevant),
  restore: (v: ArtistHeader[]) => (artists.value = v)
};

useHistory("artists", [
  saveArtists,
  filter,
  roleFilter,
  saveScrollState(viewport)
]);
</script>
