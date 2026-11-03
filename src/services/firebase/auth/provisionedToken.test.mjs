import assert from 'node:assert/strict';
import test from 'node:test';

import { refreshProvisionedUserToken } from './provisionedToken.ts';

test('forces a token refresh for the provisioned signed-in rider', async () => {
  const calls = [];
  const user = {
    uid: 'rider-1',
    async getIdToken(forceRefresh) {
      calls.push(forceRefresh);
      return 'token';
    },
  };

  await refreshProvisionedUserToken(user, 'rider-1');

  assert.deepEqual(calls, [true]);
});

test('rejects if the signed-in user differs from the provisioned rider', async () => {
  const user = {
    uid: 'rider-1',
    async getIdToken() {
      assert.fail('A mismatched user must not have its token refreshed.');
    },
  };

  await assert.rejects(
    refreshProvisionedUserToken(user, 'rider-2'),
    /signed-in account changed/,
  );
});

test('propagates token refresh failures', async () => {
  const refreshError = new Error('refresh failed');
  const user = {
    uid: 'rider-1',
    async getIdToken() {
      throw refreshError;
    },
  };

  await assert.rejects(
    refreshProvisionedUserToken(user, 'rider-1'),
    refreshError,
  );
});
