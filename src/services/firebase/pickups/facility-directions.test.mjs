import assert from 'node:assert/strict';
import {test} from 'node:test';

import {
  createGoogleMapsDirectionsUrl,
  FacilityDirectionsError,
  resolveFacilityDirectionsUrl,
} from './facility-directions.ts';

const assignedPickup = {
  id: 'pickup-1',
  facilityId: 'facility-1',
  facilityAddress: 'Verified Facility Address, Iligan City',
};

test('uses the assigned pickup address snapshot without a redundant lookup', async () => {
  let lookupCalled = false;
  const url = await resolveFacilityDirectionsUrl(assignedPickup, async () => {
    lookupCalled = true;
    return {};
  });

  assert.equal(lookupCalled, false);
  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1' +
      '&destination=Verified%20Facility%20Address%2C%20Iligan%20City' +
      '&travelmode=driving',
  );
});

test('uses valid verified coordinates returned by the assigned-facility lookup', async () => {
  const url = await resolveFacilityDirectionsUrl({
    ...assignedPickup,
    facilityAddress: '',
  }, async (pickupId) => {
    assert.equal(pickupId, assignedPickup.id);
    return {
      facilityAddress: 'Verified Facility Address',
      latitude: 8.228,
      longitude: 124.2452,
    };
  });

  assert.equal(
    url,
    'https://www.google.com/maps/dir/?api=1' +
      '&destination=8.228%2C124.2452&travelmode=driving',
  );
});

test('rejects missing facility references before attempting lookup', async () => {
  let lookupCalled = false;
  await assert.rejects(
    resolveFacilityDirectionsUrl({
      ...assignedPickup,
      facilityId: undefined,
      facilityAddress: '',
    }, async () => {
      lookupCalled = true;
      return {};
    }),
    (error) => error instanceof FacilityDirectionsError &&
      error.reason === 'assigned-facility-missing',
  );
  assert.equal(lookupCalled, false);
});

test('reports when the assigned facility lookup is unavailable', async () => {
  await assert.rejects(
    resolveFacilityDirectionsUrl({
      ...assignedPickup,
      facilityAddress: '',
    }, async () => {
      throw new Error('private backend error');
    }),
    (error) => error instanceof FacilityDirectionsError &&
      error.reason === 'destination-lookup-failed',
  );
});

test('does not use missing or invalid-coordinate lookup data', async () => {
  const invalidCoordinates = createGoogleMapsDirectionsUrl({
    facilityAddress: '',
    latitude: 91,
    longitude: 124.2452,
  });
  assert.equal(invalidCoordinates, null);

  await assert.rejects(
    resolveFacilityDirectionsUrl({
      ...assignedPickup,
      facilityAddress: '',
    }, async () => ({
      latitude: Number.NaN,
      longitude: 124.2452,
      facilityAddress: ' \n ',
    })),
    (error) => error instanceof FacilityDirectionsError &&
      error.reason === 'verified-destination-missing',
  );
});

test('uses a verified address if lookup coordinates are invalid', async () => {
  const url = await resolveFacilityDirectionsUrl({
    ...assignedPickup,
    facilityAddress: '',
  }, async () => ({
    latitude: 91,
    longitude: 124.2452,
    facilityAddress: 'Fallback Verified Facility Address',
  }));
  assert.match(url, /destination=Fallback%20Verified%20Facility%20Address/);
});

test('encodes an address containing reserved URL characters', () => {
  assert.equal(
    createGoogleMapsDirectionsUrl({
      facilityAddress: 'Facility #2, Main & 1st Street',
    }),
    'https://www.google.com/maps/dir/?api=1' +
      '&destination=Facility%20%232%2C%20Main%20%26%201st%20Street' +
      '&travelmode=driving',
  );
});
