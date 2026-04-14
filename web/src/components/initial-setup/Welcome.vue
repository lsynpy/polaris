<template>
	<Step title="Welcome to Polaris!" description="Your server is up and running, let's configure a couple things.">
		<Button label="Sounds good!" size="xl" @click="$emit('proceed')" data-pw="submit-welcome" />
	</Step>
</template>

<script setup lang="ts">
defineEmits<{
  proceed: [];
}>();
</script>
