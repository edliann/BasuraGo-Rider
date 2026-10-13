# Rider pickup mock mode

This mode is for UI development only. It uses in-memory sample pickup objects and never creates or updates pickup documents in Firebase.

## Enable

1. In the Rider App repository root, create or edit `.env.local` (this file is git-ignored).
2. Add:
   ```env
   EXPO_PUBLIC_USE_MOCK_PICKUPS=true
   ```
3. Restart Expo with its cache cleared: `npx expo start -c`.
4. Sign in to the Rider App as usual. The demo pickup cards will be marked **DEMO DATA · NOT SAVED**.

Mock mode is gated by both Expo's development flag and the environment variable, so it is disabled in production builds. If the variable is missing or set to anything other than `true`, existing Firebase pickup operations are used.

## What can be tested

- Two available pickup examples
- One accepted pickup and one in-progress pickup
- Two completed pickup history examples
- Accept, start, and complete actions that update only in-memory fixtures
- Pickup details screen and status refresh

Changes to fixtures reset when the app's JavaScript runtime restarts. These examples are fictional and are not customer requests.

## Safety notes

- Do not commit `.env.local`.
- This switch isolates pickup reads, acceptance, start, and completion. Other dashboard features, such as rider availability and GPS location updates, still use their existing services; avoid those actions during mock-mode UI testing if you do not want to update the signed-in rider record.
- This mode is not a substitute for Firebase integration testing.
