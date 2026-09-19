export interface RiderLocation {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: unknown;
}