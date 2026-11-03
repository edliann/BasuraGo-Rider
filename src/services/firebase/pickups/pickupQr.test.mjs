import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  createPickupQrPayload,
  shouldShowPickupQr,
} from './pickupQr.ts';

const assignedPickup = {
  isAssignedRider: true,
  canStart: true,
  actualWeight: null,
  hasFacilityReceipt: false,
};

test('shows the QR during in-progress collection', () => {
  assert.equal(
    shouldShowPickupQr({...assignedPickup, status: 'in_progress'}),
    true,
  );
});

test('shows the QR while awaiting facility receipt', () => {
  assert.equal(
    shouldShowPickupQr({
      ...assignedPickup,
      status: 'awaiting_facility_receipt',
      canStart: false,
    }),
    true,
  );
});

test('hides the active QR prompt after completion', () => {
  assert.equal(
    shouldShowPickupQr({...assignedPickup, status: 'completed'}),
    false,
  );
});

test('keeps accepted-pickup pricing and assignment gates', () => {
  assert.equal(
    shouldShowPickupQr({...assignedPickup, status: 'accepted', canStart: false}),
    false,
  );
  assert.equal(
    shouldShowPickupQr({
      ...assignedPickup,
      status: 'awaiting_facility_receipt',
      isAssignedRider: false,
    }),
    false,
  );
});

test('hides the QR when an authoritative facility receipt exists', () => {
  assert.equal(
    shouldShowPickupQr({
      ...assignedPickup,
      status: 'awaiting_facility_receipt',
      hasFacilityReceipt: true,
    }),
    false,
  );
  assert.equal(
    shouldShowPickupQr({
      ...assignedPickup,
      status: 'in_progress',
      actualWeight: 5,
    }),
    false,
  );
});

test('encodes the internal pickup document ID in the Staff QR contract', () => {
  const payload = createPickupQrPayload('firestore-document-id');
  assert.deepEqual(JSON.parse(payload), {
    v: 1,
    type: 'basurago-pickup',
    pickupId: 'firestore-document-id',
  });
});
