import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  /** React Native API exposed by the installed Firebase runtime entry. */
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
