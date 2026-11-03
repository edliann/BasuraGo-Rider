import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getPickupPricingState,
  mapPickupItemSnapshots,
  mapPickupPriceSnapshot,
} from './pickup.types.ts';

const initialEstimate = {
  amountCentavos: 24500,
  currency: 'PHP',
  pricingSource: 'centralized-pricing',
  pricingVersion: 'pricing-v3',
  breakdown: { totalCentavos: 24500, distanceCentavos: null },
};

test('maps a new pickup initial estimate from its nested authoritative snapshot', () => {
  assert.deepEqual(
    mapPickupPriceSnapshot({
      schemaVersion: 2,
      pricingStage: 'estimate',
      initialEstimate,
      final: null,
    }),
    {
      amountCentavos: 24500,
      currency: 'PHP',
      pricingSource: 'centralized-pricing',
      pricingVersion: 'pricing-v3',
      breakdown: initialEstimate.breakdown,
    },
  );
});

test('preserves multiple saved waste lines and their own bag details', () => {
  assert.deepEqual(mapPickupItemSnapshots([
    {
      wasteTypeId: 'chemical',
      wasteTypeName: 'Chemical',
      bagSizeId: 'small',
      bagSizeLabel: 'Small Bag',
      quantity: 2,
      estimatedWeightKg: 4,
    },
    {
      wasteTypeId: 'biodegradable',
      wasteTypeName: 'Biodegradable',
      bagSizeId: 'large',
      bagSizeLabel: 'Large Bag',
      quantity: 1,
      estimatedWeightKg: 3,
    },
    {
      wasteTypeId: 'chemical',
      wasteTypeName: 'Chemical',
      bagSizeId: 'large',
      bagSizeLabel: 'Large Bag',
      quantity: 1,
      estimatedWeightKg: 5,
    },
  ]), [
    {
      wasteTypeId: 'chemical',
      wasteTypeName: 'Chemical',
      bagSizeId: 'small',
      bagSizeLabel: 'Small Bag',
      quantity: 2,
      estimatedWeightKg: 4,
    },
    {
      wasteTypeId: 'biodegradable',
      wasteTypeName: 'Biodegradable',
      bagSizeId: 'large',
      bagSizeLabel: 'Large Bag',
      quantity: 1,
      estimatedWeightKg: 3,
    },
    {
      wasteTypeId: 'chemical',
      wasteTypeName: 'Chemical',
      bagSizeId: 'large',
      bagSizeLabel: 'Large Bag',
      quantity: 1,
      estimatedWeightKg: 5,
    },
  ]);
});

test('maps a confirmed final price ahead of the initial estimate', () => {
  const final = {
    quoteId: 'final-quote',
    amountCentavos: 31200,
    currency: 'PHP',
    pricingVersion: 'pricing-v4',
    breakdown: { totalCentavos: 31200, distanceCentavos: 6700 },
  };
  assert.equal(
    mapPickupPriceSnapshot({
      schemaVersion: 2,
      initialEstimate,
      final,
    })?.amountCentavos,
    31200,
  );
});

test('rejects malformed or incomplete pricing snapshots', () => {
  assert.equal(mapPickupPriceSnapshot(null), null);
  assert.equal(mapPickupPriceSnapshot({ initialEstimate: { amountCentavos: -1 } }), null);
  assert.equal(mapPickupPriceSnapshot({
    initialEstimate: {
      ...initialEstimate,
      breakdown: null,
    },
  }), null);
});

test('rejects an amount that conflicts with its breakdown or confirmed final snapshot', () => {
  assert.equal(mapPickupPriceSnapshot({
    initialEstimate: {
      ...initialEstimate,
      breakdown: { totalCentavos: 24499 },
    },
  }), null);

  assert.equal(mapPickupPriceSnapshot({
    amountCentavos: 31200,
    currency: 'PHP',
    pricingVersion: 'pricing-v4',
    breakdown: { totalCentavos: 31200 },
    initialEstimate,
    final: {
      amountCentavos: 31100,
      currency: 'PHP',
      pricingVersion: 'pricing-v4',
      breakdown: { totalCentavos: 31100 },
    },
  }), null);
});

test('recognizes the valid initial state and keeps collection blocked', () => {
  const state = getPickupPricingState({
    status: 'pending',
    pricingWorkflowVersion: 2,
    pricingStage: 'awaiting_rider_acceptance',
    finalPriceResolution: { status: 'pending' },
  });
  assert.equal(state.label, 'Awaiting rider acceptance');
  assert.equal(state.canStart, false);
});

test('does not treat a pending pickup as final-price confirmed', () => {
  const state = getPickupPricingState({
    status: 'pending',
    pricingWorkflowVersion: 2,
    pricingStage: 'customer_confirmed',
    finalPriceResolution: { status: 'ready' },
  });
  assert.equal(state.label, 'Pricing status unavailable');
  assert.equal(state.canStart, false);
});

test('keeps an inconsistent assigned pickup blocked while explaining its stage', () => {
  const state = getPickupPricingState({
    status: 'accepted',
    pricingWorkflowVersion: 2,
    pricingStage: 'awaiting_rider_acceptance',
    finalPriceResolution: { status: 'pending' },
  });
  assert.equal(state.label, 'Pricing update pending');
  assert.equal(state.canStart, false);
});

test('keeps unknown workflow stages fail-closed and accepts only explicit confirmation', () => {
  const unavailable = getPickupPricingState({
    status: 'accepted',
    pricingWorkflowVersion: 2,
    pricingStage: 'unknown',
    finalPriceResolution: null,
  });
  assert.equal(unavailable.label, 'Pricing status unavailable');
  assert.equal(unavailable.canStart, false);

  const confirmed = getPickupPricingState({
    status: 'accepted',
    pricingWorkflowVersion: 2,
    pricingStage: 'customer_confirmed',
    finalPriceResolution: { status: 'ready' },
  });
  assert.equal(confirmed.label, 'Final price confirmed');
  assert.equal(confirmed.canStart, true);
});

test('preserves legacy pickups and trusted route failures', () => {
  assert.equal(getPickupPricingState({
    status: 'accepted',
    pricingWorkflowVersion: undefined,
    pricingStage: null,
    finalPriceResolution: null,
  }).canStart, true);

  const routeFailed = getPickupPricingState({
    status: 'accepted',
    pricingWorkflowVersion: 2,
    pricingStage: 'awaiting_final_price',
    finalPriceResolution: { status: 'failed' },
  });
  assert.equal(routeFailed.label, 'Route/pricing issue');
  assert.equal(routeFailed.canStart, false);
});
