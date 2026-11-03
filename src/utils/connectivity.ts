export type ConnectivityStatus = 'checking' | 'online' | 'offline';
export type NetworkReachability = 'online' | 'offline' | 'unknown';

export function getNetworkReachability(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): NetworkReachability {
  if (state.isConnected === false || state.isInternetReachable === false) {
    return 'offline';
  }

  if (state.isConnected === true || state.isInternetReachable === true) {
    return 'online';
  }

  return 'unknown';
}

export function applyNetworkReachability(
  current: ConnectivityStatus,
  next: NetworkReachability,
): ConnectivityStatus {
  return next === 'unknown' ? current : next;
}

export function finishConnectivityStartup(
  current: ConnectivityStatus,
): ConnectivityStatus {
  return current === 'checking' ? 'online' : current;
}
