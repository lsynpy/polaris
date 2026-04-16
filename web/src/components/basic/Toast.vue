<template>
	<div
		v-if="visible"
		class="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2"
	>
		<div
			v-for="(notification, index) in notifications"
			:key="notification.id"
			class="rounded-md bg-ls-800 dark:bg-ds-700 px-4 py-3 shadow-lg transition-all duration-300"
			:class="index === 0 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
		>
			<div class="flex items-start gap-3">
				<span v-if="notification.icon" class="material-icons-round text-lg">
					{{ notification.icon }}
				</span>
				<div class="flex-1">
					<div v-if="notification.title" class="font-semibold text-sm">
						{{ notification.title }}
					</div>
					<div v-if="notification.body" class="text-sm text-ls-400 dark:text-ds-400">
						{{ notification.body }}
					</div>
				</div>
				<button
					v-if="notification.dismissible"
					class="text-ls-400 hover:text-ls-600 dark:text-ds-500 dark:hover:text-ds-300"
					@click="remove(notification.id)"
				>
					<span class="material-icons-round text-sm">close</span>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

interface ToastNotification {
  id: number;
  title?: string;
  body?: string;
  icon?: string;
  dismissible?: boolean;
  duration?: number;
}

interface ToastApi {
  add: (
    title: string,
    body: string,
    icon?: string,
    dismissible?: boolean,
    duration?: number
  ) => void;
}

const notifications = ref<ToastNotification[]>([]);
let idCounter = 0;

const visible = computed(() => notifications.value.length > 0);

function add(
  title: string,
  body: string,
  icon: string = "info",
  dismissible: boolean = true,
  duration: number = 5000
) {
  const id = idCounter++;
  notifications.value.push({
    id,
    title,
    body,
    icon,
    dismissible,
    duration
  });

  if (duration > 0) {
    setTimeout(() => {
      remove(id);
    }, duration);
  }
}

function remove(id: number) {
  const index = notifications.value.findIndex((n) => n.id === id);
  if (index !== -1) {
    notifications.value.splice(index, 1);
  }
}

// Expose globally for use from stores
(window as unknown as { __toast?: ToastApi }).__toast = { add };

onMounted(() => {
  // Make toast available globally
  if (!(window as unknown as { __toast?: ToastApi }).__toast) {
    (window as unknown as { __toast?: ToastApi }).__toast = { add };
  }
});

onUnmounted(() => {
  notifications.value = [];
});

defineExpose({ add });
</script>

<style scoped>
/* Animation classes */
.translate-y-0 {
	transform: translateY(0);
}

.translate-y-4 {
	transform: translateY(1rem);
}

.opacity-100 {
	opacity: 1;
}

.opacity-0 {
	opacity: 0;
}
</style>
