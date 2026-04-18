<template>
  <div class="flex flex-col min-h-0">
    <div class="flex flex-col gap-8 grow overflow-y-auto -mx-4 px-4">
      <Section v-for="user in users.listing" :key="user.name">
        <User :user="user" />
      </Section>

      <Button
        v-if="!newUser"
        label="Add User"
        icon="person_add"
        severity="secondary"
        size="xl"
        data-pw="add-user"
        class="self-start"
        @click="beginCreateUser"
      />

      <Section v-else class="flex flex-col gap-8">
        <div class="flex gap-4 items-center">
          <span
            class="material-icons-round rounded-full p-2 flex items-center justify-center text-ls-500 dark:text-ds-400 bg-ls-200 dark:bg-ds-700"
            v-text="'face'"
          />
          <div
            class="font-medium text-ls-600 dark:text-ds-300"
            v-text="newUser.name || 'New User'"
          />
        </div>

        <InputText
          id="username"
          v-model="newUser.name"
          label="Username"
          icon="face"
          autofocus
          class="w-80"
          :error="!validNewUserName && !!newUser.name.length"
        />
        <InputText
          id="password"
          v-model="newUser.password"
          label="Password"
          icon="key"
          password
          class="w-80"
        />
        <Button
          label="Create User"
          icon="person_add"
          severity="primary"
          size="xl"
          data-pw="create-user"
          :disabled="!validNewUser"
          class="self-end"
          @click="endCreateUser"
        />
      </Section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, type Ref, ref } from 'vue';

import type { NewUser } from '@/api/dto';
import Button from '@/components/basic/Button.vue';
import InputText from '@/components/basic/InputText.vue';
import Section from '@/components/basic/Section.vue';
import User from '@/components/settings/User.vue';
import { useUsersStore } from '@/stores/users';

const users = useUsersStore();

onMounted(() => {
  users.refresh();
});

const newUser: Ref<NewUser | undefined> = ref(undefined);

const validNewUserName = computed(() => {
  if (!newUser.value) {
    return false;
  }
  const newUsername = newUser.value.name;
  return newUsername.length && !users.listing?.some((u) => u.name === newUsername);
});

const validNewUserPassword = computed(() => {
  if (!newUser.value) {
    return false;
  }
  return newUser.value.password.length;
});

const validNewUser = computed(() => validNewUserName.value && validNewUserPassword.value);

function beginCreateUser() {
  newUser.value = {
    name: '',
    password: '',
    admin: false,
  };
}

async function endCreateUser() {
  if (newUser.value) {
    await users.create(newUser.value);
  }
  newUser.value = undefined;
}
</script>
