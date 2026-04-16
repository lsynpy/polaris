<template>
	<div
		v-if="visible"
		class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex max-w-lg flex-col gap-2 items-center"
	>
		<div
			v-for="(notification, index) in notifications"
			:key="notification.id"
			class="rounded-lg px-5 py-4 shadow-xl transition-all duration-300 border"
			:class="[
				notification.type === 'warning'
					? 'bg-amber-500/90 dark:bg-amber-600/90 border-amber-400/50 dark:border-amber-500/50'
					: 'bg-blue-500/90 dark:bg-blue-600/90 border-blue-400/50 dark:border-blue-500/50',
				index === 0 ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-2 opacity-0 scale-95'
			]"
		>
			<div class="flex items-start gap-3">
				<span
					v-if="notification.icon"
					class="material-icons-round text-xl shrink-0 text-white/90"
				>
					{{ notification.icon }}
				</span>
				<div class="flex-1 min-w-0">
					<div v-if="notification.title" class="font-semibold text-sm text-white mb-1">
						{{ notification.title }}
					</div>
					<div v-if="notification.body" class="text-sm text-white/90 mb-2">
						{{ notification.body }}
					</div>
					<div
						v-if="notification.details"
						class="text-xs text-white/80 bg-white/10 rounded p-2 max-h-24 overflow-y-auto"
					>
						<div v-for="(list, key) in notification.details" :key="key" class="mb-1 last:mb-0">
							<span class="font-medium">{{ key }}:</span>
							<span class="ml-2">{{ list }}</span>
						</div>
					</div>
				</div>
				<button
					v-if="notification.dismissible"
					class="text-white/70 hover:text-white transition-colors shrink-0"
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

interface ToastDetail {
  [demand: string]: string;
}

interface ToastNotification {
  id: number;
  title?: string;
  body?: string;
  icon?: string;
  dismissible?: boolean;
  duration?: number;
  type?: "info" | "warning" | "success";
  details?: ToastDetail;
}

interface ToastApi {
  add: (
    title: string,
    body: string,
    icon?: string,
    dismissible?: boolean,
    duration?: number,
    type?: "info" | "warning" | "success",
    details?: ToastDetail
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
  duration: number = 5000,
  type: "info" | "warning" | "success" = "info",
  details?: ToastDetail
) {
  const id = idCounter++;
  notifications.value.push({
    id,
    title,
    body,
    icon,
    dismissible,
    duration,
    type,
    details
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

.translate-y-2 {
	transform: translateY(0.5rem);
}

.opacity-100 {
	opacity: 1;
}

.opacity-0 {
	opacity: 0;
}
</style>
