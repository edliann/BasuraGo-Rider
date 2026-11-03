import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyNetworkReachability,
  finishConnectivityStartup,
  getNetworkReachability,
} from './connectivity.ts';

test('offline startup is detected from disconnected network state', () => {
  assert.equal(
    getNetworkReachability({
      isConnected: false,
      isInternetReachable: null,
    }),
    'offline',
  );
});

test('online startup is detected when connectivity is available', () => {
  assert.equal(
    getNetworkReachability({
      isConnected: true,
      isInternetReachable: true,
    }),
    'online',
  );
});

test('a later online state restores connectivity after an offline state', () => {
  assert.equal(
    applyNetworkReachability(
      'offline',
      getNetworkReachability({
        isConnected: true,
        isInternetReachable: true,
      }),
    ),
    'online',
  );
});

test('unknown initial reachability is not treated as offline', () => {
  const reachability = getNetworkReachability({
    isConnected: null,
    isInternetReachable: null,
  });
  assert.equal(reachability, 'unknown');
  assert.equal(applyNetworkReachability('checking', reachability), 'checking');
  assert.equal(finishConnectivityStartup('checking'), 'online');
});

test('connected with unknown internet reachability is not classified offline', () => {
  assert.equal(
    getNetworkReachability({
      isConnected: true,
      isInternetReachable: null,
    }),
    'online',
  );
});
