import { Stack } from 'expo-router';

export default function SystemLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}