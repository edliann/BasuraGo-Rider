import type { Pickup } from '../services/firebase/pickups/pickup.types';

// In-memory fixtures only. This module never reads or writes Firebase.
export const MOCK_PICKUP_MODE = __DEV__ && process.env.EXPO_PUBLIC_USE_MOCK_PICKUPS === 'true';

const demoLocations: Record<string, { latitude: number; longitude: number }> = {
  'demo-available-1': { latitude: 8.9518, longitude: 125.5404 },
  'demo-available-2': { latitude: 8.9491, longitude: 125.5436 },
  'demo-assigned-1': { latitude: 8.9542, longitude: 125.5232 },
  'demo-assigned-2': { latitude: 8.9566, longitude: 125.5967 },
  'demo-completed-1': { latitude: 8.9446, longitude: 125.5013 },
  'demo-completed-2': { latitude: 8.9681, longitude: 125.5199 },
};

const makePickup = (values: Partial<Pickup> & Pick<Pickup, 'id' | 'customerName' | 'pickupAddress' | 'wasteTypeName' | 'status'>): Pickup => ({
  customerId: `demo-${values.id}`, addressId: `demo-address-${values.id}`, wasteTypeId: 'demo-waste',
  estimatedWeight: 8, actualWeight: null, scheduledDate: '2026-10-15', scheduledTime: '9:00 AM – 10:00 AM',
  collectedWeightKg: null, facilityReceivedWeightKg: null,
  collectionCompletedAt: null, facilityReceipt: null,
  facilityId: 'demo-facility', facilityName: 'BasuraGo Materials Recovery Facility',
  facilityAddress: 'Libertad, Butuan City', pickupLocation: demoLocations[values.id], riderId: null, vehicleId: 'BG-DEMO-01', notes: '',
  completedAt: null, createdAt: null, updatedAt: null, ...values,
});

const fixtures: Pickup[] = [
  makePickup({ id: 'demo-available-1', customerName: 'Maria Santos', pickupAddress: 'J.P. Laurel Avenue, Butuan City', wasteTypeName: 'Plastic bottles', status: 'pending', scheduledTime: '9:00 AM – 10:00 AM', estimatedWeight: 8, riderId: null, notes: 'Please call when you arrive at the gate.' }),
  makePickup({ id: 'demo-available-2', customerName: 'Jose Dela Cruz', pickupAddress: 'Montilla Boulevard, Butuan City', wasteTypeName: 'Paper and cardboard', status: 'pending', scheduledTime: '10:30 AM – 11:30 AM', estimatedWeight: 12, riderId: null }),
  makePickup({ id: 'demo-assigned-1', customerName: 'Ana Reyes', pickupAddress: 'Villa Kananga, Butuan City', wasteTypeName: 'Metal cans', status: 'accepted', scheduledTime: '1:00 PM – 2:00 PM', estimatedWeight: 6, riderId: 'demo-rider', vehicleId: 'BG-DEMO-01' }),
  makePickup({ id: 'demo-assigned-2', customerName: 'Pedro Garcia', pickupAddress: 'Ampayon, Butuan City', wasteTypeName: 'Organic waste', status: 'in_progress', scheduledTime: '2:30 PM – 3:00 PM', estimatedWeight: 10, riderId: 'demo-rider', vehicleId: 'BG-DEMO-02', facilityName: 'Ampayon Composting Site' }),
  makePickup({ id: 'demo-completed-1', customerName: 'Liza Mendoza', pickupAddress: 'Libertad, Butuan City', wasteTypeName: 'Plastic bottles', status: 'completed', scheduledDate: '2026-10-12', estimatedWeight: 5, actualWeight: 5.5, riderId: 'demo-rider' }),
  makePickup({ id: 'demo-completed-2', customerName: 'Ramon Flores', pickupAddress: 'Doongan, Butuan City', wasteTypeName: 'Paper and cardboard', status: 'completed', scheduledDate: '2026-10-10', estimatedWeight: 9, actualWeight: 9, riderId: 'demo-rider' }),
];
let records = fixtures.map((pickup) => ({ ...pickup }));

export function getMockPickups(riderId: string) {
  return {
    available: records.filter((p) => p.status === 'pending').map((p) => ({ ...p })),
    assigned: records.filter((p) => p.riderId === riderId && p.status !== 'completed').map((p) => ({ ...p })),
    history: records.filter((p) => p.riderId === riderId && p.status === 'completed').map((p) => ({ ...p })),
  };
}

export function getMockPickupById(id: string): Pickup | null {
  const pickup = records.find((p) => p.id === id);
  return pickup ? { ...pickup } : null;
}

export function updateMockPickup(id: string, action: 'accept' | 'start' | 'complete', riderId: string): Pickup {
  const index = records.findIndex((p) => p.id === id);
  if (index < 0) throw new Error('Demo pickup not found.');
  const current = records[index];
  if (action === 'accept') {
    if (current.status !== 'pending') throw new Error('This demo pickup is no longer available.');
    records[index] = { ...current, status: 'accepted', riderId };
  } else if (action === 'start') {
    if (current.status !== 'accepted' || current.riderId !== riderId) throw new Error('This demo pickup cannot be started.');
    records[index] = { ...current, status: 'in_progress' };
  } else {
    if (current.status !== 'in_progress' || current.riderId !== riderId) throw new Error('This demo pickup cannot be completed.');
    records[index] = { ...current, status: 'awaiting_facility_receipt' };
  }
  return { ...records[index] };
}

export function resetMockPickups() {
  records = fixtures.map((pickup) => ({ ...pickup }));
}
