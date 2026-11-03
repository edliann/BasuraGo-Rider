import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { getCurrentUser } from '../firebase/auth/auth.services';

interface JwtPayload {
  aud?: unknown;
  exp?: unknown;
  iss?: unknown;
  role?: unknown;
  sub?: unknown;
}

function decodeJwtPayload(token: string | null): JwtPayload | null {
  if (!token) {
    return null;
  }

  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) {
      return null;
    }

    const base64 = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '=',
    );
    const binaryPayload = globalThis.atob(paddedBase64);
    const payloadBytes = Uint8Array.from(
      binaryPayload,
      (character) => character.charCodeAt(0),
    );

    return JSON.parse(
      new TextDecoder().decode(payloadBytes),
    ) as JwtPayload;
  } catch {
    return null;
  }
}

function getStorageObjectPath(input: RequestInfo | URL): string | null {
  try {
    const requestUrl = typeof input === 'string' ?
      input : input instanceof URL ? input.href : input.url;
    const pathname = new URL(requestUrl).pathname;
    const objectPrefix = '/storage/v1/object/rider-documents/';
    const objectPrefixIndex = pathname.indexOf(objectPrefix);

    if (objectPrefixIndex < 0) {
      return null;
    }

    return decodeURIComponent(
      pathname.slice(objectPrefixIndex + objectPrefix.length),
    );
  } catch {
    return null;
  }
}

function logRiderStorageJwtDiagnostics(
  input: RequestInfo | URL,
  init?: RequestInit,
): void {
  const requestUrl = typeof input === 'string' ?
    input : input instanceof URL ? input.href : input.url;
  const path = getStorageObjectPath(input);
  if (
    init?.method?.toUpperCase() !== 'POST' ||
    !path ||
    !requestUrl.includes('/storage/v1/object/rider-documents/')
  ) {
    return;
  }

  const authorization = new Headers(init.headers)
    .get('Authorization');
  const token = authorization?.startsWith('Bearer ') ?
    authorization.slice('Bearer '.length) : null;
  const claims = decodeJwtPayload(token);
  const user = getCurrentUser();
  const projectId = user?.auth.app.options.projectId;
  const expiration = typeof claims?.exp === 'number' ? claims.exp : null;
  const now = Math.floor(Date.now() / 1000);
  const subject = typeof claims?.sub === 'string' ? claims.sub : null;
  const pathOwner = path.split('/')[0] ?? '';
  const audienceMatchesProject =
    claims?.aud === projectId ||
    (Array.isArray(claims?.aud) && claims.aud.includes(projectId));

  console.info('[Rider Storage JWT diagnostic]', {
    tokenPresent: Boolean(token),
    roleIsAuthenticated: claims?.role === 'authenticated',
    issuerMatchesProject:
      Boolean(projectId) &&
      claims?.iss === `https://securetoken.google.com/${projectId}`,
    audienceMatchesProject:
      Boolean(projectId) && audienceMatchesProject,
    subMatchesFirebaseUid:
      Boolean(subject && user) && subject === user?.uid,
    pathOwnerMatchesSub:
      Boolean(subject && pathOwner) && pathOwner === subject,
    isExpired: expiration === null ? null : expiration <= now,
    secondsUntilExpiration:
      expiration === null ? null : expiration - now,
  });
}

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL;

const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL',
  );
}

if (!supabasePublishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    accessToken: async () => {
      const user = getCurrentUser();

      if (!user) {
        return null;
      }

      return user.getIdToken();
    },

    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input, init) => {
        if (__DEV__) {
          logRiderStorageJwtDiagnostics(input, init);
        }

        return globalThis.fetch(input, init);
      },
    },
  },
);
