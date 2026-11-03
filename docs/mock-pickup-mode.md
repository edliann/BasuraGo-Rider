# Rider Firebase emulator mode

Rider pickup screens use real Firestore records and authorized Backend callables. The app does not substitute sample pickups when a request is empty or fails.
## Local configuration

The ignored `.env.local` file selects the Firebase project namespace and local emulator host. Set:
```env
EXPO_PUBLIC_FIREBASE_PROJECT_ID=basurago-9cd0d
EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=<development-machine-LAN-address>
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true
```

When enabled in an Expo development build, Rider connects Auth to port `9099`, Firestore to `8085`, and Functions to `5001` on the configured host. The project ID remains the emulator namespace; Firebase initialization rejects this mode outside development builds. Expo's `app.config.js` handles Maps configuration and does not select the Firebase target.
Do not set the emulator flag to `false` for a test run: without emulator routing, Firebase SDK calls use the configured Firebase project. Do not use production accounts or records in emulator tests.

## Safe manual checks
1. Start only the local Auth, Firestore, and Functions emulators from the Backend repository using its existing configuration and project ID `basurago-9cd0d`.
2. Confirm the emulators report ports `9099`, `8085`, and `5001`, and that the configured host is reachable from the Rider device or simulator.
3. Sign in with an Auth Emulator test account and use isolated Firestore emulator records for an active, approved rider, assigned vehicle, pending pickup, and accepted/in-progress pickups.
4. Check that an eligible pending pickup appears through the callable; assigned and completed records appear only for their rider; another rider and an inactive rider cannot access actionable records.
5. Test acceptance, start, and completion against emulator records, then verify the status and rider assignment in the emulator UI or emulator export.
6. Confirm empty results stay empty and stopped/unreachable emulators show an error. Do not continue if the emulator host is unavailable.
The Rider repository does not currently define an automated test script. Do not test pickup actions against production.
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
