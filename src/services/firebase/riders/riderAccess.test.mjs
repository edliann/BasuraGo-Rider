import assert from 'node:assert/strict';
import test from 'node:test';

import { getRiderAccessDecision } from './riderAccess.ts';

test('allows an active approved rider regardless of customer profile', () => {
  assert.equal(getRiderAccessDecision('active', 'approved'), 'authorized');
});

test('allows a legacy active rider without an application', () => {
  assert.equal(getRiderAccessDecision('active', null), 'authorized');
});

test('denies a customer-only account without rider records', () => {
  assert.equal(getRiderAccessDecision(null, null), 'denied');
});

test('routes pending riders to verification, not Rider operations', () => {
  for (const status of ['incomplete', 'submitted', 'under_review']) {
    assert.equal(getRiderAccessDecision('pending', status), 'verification');
  }
});

test('denies inactive or suspended rider profiles even if approved', () => {
  for (const status of ['inactive', 'suspended', 'pending', null]) {
    assert.equal(getRiderAccessDecision(status, 'approved'), 'denied');
  }
});

test('keeps rejected applications in the existing verification flow', () => {
  assert.equal(getRiderAccessDecision('active', 'rejected'), 'verification');
});
