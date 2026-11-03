import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRiderLocationPublishInput,
  getRiderLocationSampleIssue,
} from './locationQuality.ts';

const now = 1_000_000;

function validLocation(overrides = {}) {
  return {
    coords: {
      latitude: 8.95,
      longitude: 125.54,
      accuracy: 12,
      altitude: 10,
      altitudeAccuracy: 5,
      heading: 0,
      speed: 0,
    },
    timestamp: now,
    mocked: false,
    ...overrides,
  };
}

test('accepts a fresh accurate sample and emits the publish contract', () => {
  const location = validLocation();
  assert.equal(getRiderLocationSampleIssue(location, now), null);
  assert.deepEqual(createRiderLocationPublishInput(location, now), {
    latitude: 8.95,
    longitude: 125.54,
    accuracy: 12,
    locationTimestamp: now,
  });
});

test('rejects a stale sample', () => {
  const issue = getRiderLocationSampleIssue(
    validLocation({timestamp: now - 60_001}),
    now,
  );
  assert.match(issue ?? '', /stale/i);
});

test('rejects GPS accuracy above the Backend limit', () => {
  const issue = getRiderLocationSampleIssue(
    validLocation({
      coords: {...validLocation().coords, accuracy: 101},
    }),
    now,
  );
  assert.match(issue ?? '', /accuracy is too low/i);
});

test('rejects missing coordinates', () => {
  const issue = getRiderLocationSampleIssue({timestamp: now}, now);
  assert.match(issue ?? '', /valid position/i);
});

test('rejects a sample with no accuracy measurement', () => {
  const issue = getRiderLocationSampleIssue(
    validLocation({
      coords: {...validLocation().coords, accuracy: null},
    }),
    now,
  );
  assert.match(issue ?? '', /accuracy is unavailable/i);
});
