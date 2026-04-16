import { computed, ref, type WritableComputedRef } from "vue";
import { useUserStore } from "@/stores/user";

export interface Serializer<T> {
  read: (raw: string) => T;
  write: (value: T) => string;
}

export const StorageSerializers: Record<
  "boolean" | "object" | "number" | "any" | "string" | "map" | "set" | "date",
  Serializer<unknown>
> = {
  boolean: {
    read: (v: string) => v === "true",
    write: (v: unknown) => String(v)
  },
  object: {
    read: (v: string) => JSON.parse(v),
    write: (v: unknown) => JSON.stringify(v)
  },
  number: {
    read: (v: string) => Number.parseFloat(v),
    write: (v: unknown) => String(v)
  },
  any: {
    read: (v: string) => v,
    write: (v: unknown) => String(v)
  },
  string: {
    read: (v: string) => v,
    write: (v: unknown) => String(v)
  },
  map: {
    read: (v: string) => new Map(JSON.parse(v)),
    write: (v: unknown) =>
      JSON.stringify(Array.from((v as Map<unknown, unknown>).entries()))
  },
  set: {
    read: (v: string) => new Set(JSON.parse(v)),
    write: (v: unknown) => JSON.stringify(Array.from(v as Set<unknown>))
  },
  date: {
    read: (v: string) => new Date(v),
    write: (v: unknown) => (v as Date).toISOString()
  }
};

export function guessSerializerType<T>(rawInit: T) {
  return rawInit == null
    ? "any"
    : rawInit instanceof Set
      ? "set"
      : rawInit instanceof Map
        ? "map"
        : rawInit instanceof Date
          ? "date"
          : typeof rawInit === "boolean"
            ? "boolean"
            : typeof rawInit === "string"
              ? "string"
              : typeof rawInit === "object"
                ? "object"
                : !Number.isNaN(rawInit)
                  ? "number"
                  : "any";
}

function read<T>(key: string, defaultValue: T, serializer: Serializer<T>): T {
  const rawValue = localStorage.getItem(key);
  if (rawValue == null) {
    return defaultValue;
  } else {
    return serializer.read(rawValue);
  }
}

function write<T>(key: string, value: T, serializer: Serializer<T>) {
  const serialized = serializer.write(value);
  try {
    localStorage.setItem(key, serialized);
    return true;
  } catch (_e) {
    console.log(`Could not write '${key}' to local storage`);
    return false;
  }
}

export function useUserStorage<T>(
  key: string,
  defaultValue: T
): WritableComputedRef<T> {
  const type = guessSerializerType<T>(defaultValue);
  const serializer = StorageSerializers[type];
  const user = useUserStore();

  const asRef = ref(defaultValue);

  const getter = () => {
    if (!user.name) {
      return defaultValue;
    }
    asRef.value = read(`${user.name}.${key}`, defaultValue, serializer);
    return asRef.value;
  };

  const setter = (value: T) => {
    if (!user.name) {
      return;
    }
    write(`${user.name}.${key}`, value, serializer);
    asRef.value = value;
  };

  return computed({
    get: getter,
    set: setter
  });
}

export function loadUserValue<T>(key: string, defaultValue: T): T {
  const user = useUserStore();
  if (!user.name) {
    return defaultValue;
  }
  const type = guessSerializerType<T>(defaultValue);
  const serializer = StorageSerializers[type] as Serializer<T>;
  return read(`${user.name}.${key}`, defaultValue, serializer);
}

export function saveUserValue<T>(key: string, value: T) {
  const user = useUserStore();
  if (!user.name) {
    return false;
  }
  const type = guessSerializerType<T>(value);
  const serializer = StorageSerializers[type];
  return write(`${user.name}.${key}`, value, serializer);
}
