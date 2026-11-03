import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext/AuthContext';
import {
  cancelAcceptedPickupByRider,
  completePickup,
  CustomerPhoneLookupError,
  getPickupById,
  getPickupByIdFromServer,
  getPickupCustomerPhone,
  getPickupDestination,
  startPickup,
} from '../../services/firebase/pickups/pickup.services';
import {
  getPickupCancellationLabel,
  getPickupPricingState,
  getFacilityReceivedWeight,
  type Pickup,
} from '../../services/firebase/pickups/pickup.types';
import {
  FacilityDirectionsError,
  resolveFacilityDirectionsUrl,
} from '../../services/firebase/pickups/facility-directions';
import {shouldShowPickupQr} from '../../services/firebase/pickups/pickupQr';
import PickupRouteMap from '../../components/pickups/PickupRouteMap';
import RemixIcon from 'react-native-remix-icon';
import * as WebBrowser from 'expo-web-browser';

type ActionType = 'start' | 'complete' | null;

const STATUS_LABELS: Record<string, string> = {
  pending: 'Available',
  accepted: 'Accepted',
  in_progress: 'In progress',
  awaiting_facility_receipt: 'Awaiting facility receipt',
  completed: 'Completed',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
};

function formatPickupTimestamp(value: unknown): string | null {
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    const converted: unknown = value.toDate();
    if (converted instanceof Date) date = converted;
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date);
}

export default function PickupDetailsScreen() {
  const { pickupId, from } = useLocalSearchParams<{
    pickupId: string;
    from?: string;
  }>();
  const { rider } = useAuth();

  const [pickup, setPickup] = useState<Pickup | null>(null);
  const pickupIdRef = useRef(pickupId);
  pickupIdRef.current = pickupId;
  const [loadedPickupId, setLoadedPickupId] =
    useState<string | null | undefined>(null);
  const pickupRef = useRef(pickup);
  const loadedPickupIdRef = useRef<string | null | undefined>(null);
  const loading = loadedPickupId !== pickupId;
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const requestInFlight = useRef(false);
  const requestPickupId = useRef<string | null>(null);
  const requestPromise = useRef<Promise<void> | null>(null);
  const requestSequence = useRef(0);
  const [actionLoading, setActionLoading] = useState<ActionType>(null);
  const actionLock = useRef(false);
  const [cancellationModalVisible, setCancellationModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [cancellationSubmitting, setCancellationSubmitting] = useState(false);
  const [loadingCustomerPhone, setLoadingCustomerPhone] = useState(false);
  const [loadingFacilityDirections, setLoadingFacilityDirections] =
    useState(false);
  const returnToList = from === '/available-pickups'
    || from === '/my-pickups'
    || from === '/pickup-history'
    ? from
    : pickup?.status === 'completed'
      ? '/pickup-history'
      : pickup?.status === 'pending'
        ? '/available-pickups'
        : '/my-pickups';
  const returnLabel = returnToList === '/available-pickups'
    ? 'Available Pickups'
    : returnToList === '/pickup-history'
      ? 'Pickup History'
      : 'My Pickups';

  function handleBackToList() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(returnToList);
  }

  const loadPickup = useCallback(async (
    showRefreshing = false,
    forceServer = false,
  ): Promise<Pickup | null> => {
    if (!pickupId || typeof pickupId !== 'string') {
      setError('Pickup ID is missing.');
      setLoadedPickupId(pickupId);
      return null;
    }

    if (
      requestInFlight.current &&
      requestPickupId.current === pickupId
    ) {
      if (showRefreshing) setRefreshing(true);
      if (!forceServer) return pickupRef.current;
      const currentRequest = requestPromise.current;
      if (currentRequest) await currentRequest;
      if (pickupIdRef.current !== pickupId) return null;
      return loadPickup(showRefreshing, true);
    }

    if (pickupIdRef.current !== pickupId) {
      return null;
    }

    requestInFlight.current = true;
    requestPickupId.current = pickupId;
    const requestId = ++requestSequence.current;
    let resolveRequest!: () => void;
    const thisRequest = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    requestPromise.current = thisRequest;
    if (showRefreshing) setRefreshing(true);
    try {
      setError('');
      setRefreshError('');
      const result = forceServer
        ? await getPickupByIdFromServer(pickupId)
        : await getPickupById(pickupId);
      if (
        requestId === requestSequence.current &&
        pickupIdRef.current === pickupId
      ) {
        pickupRef.current = result;
        setPickup(result);
        if (!result) setError('This pickup could not be found.');
      }
      return result;
    } catch (loadError) {
      console.error('Failed to load pickup details:', loadError);
      if (
        requestId === requestSequence.current &&
        pickupIdRef.current === pickupId
      ) {
        const message =
          'We couldn’t load this pickup. Check your connection and try again.';
        if (
          pickupRef.current &&
          loadedPickupIdRef.current === pickupId
        ) setRefreshError(message);
        else setError(message);
      }
      return null;
    } finally {
      if (requestId === requestSequence.current) {
        requestInFlight.current = false;
        requestPickupId.current = null;
        loadedPickupIdRef.current = pickupId;
        setLoadedPickupId(pickupId);
        setRefreshing(false);
      }
      if (requestPromise.current === thisRequest) {
        requestPromise.current = null;
      }
      resolveRequest();
    }
  }, [pickupId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        return loadPickup();
      }
    });
    return () => {
      active = false;
      requestSequence.current += 1;
      requestInFlight.current = false;
      requestPickupId.current = null;
      requestPromise.current = null;
      loadedPickupIdRef.current = null;
    };
  }, [loadPickup]);

  useEffect(() => {
    const awaitingFinalPrice =
      pickup?.status === 'accepted' &&
      pickup.pricingWorkflowVersion === 2 &&
      pickup.pricingStage !== 'customer_confirmed';
    if (!awaitingFinalPrice && pickup?.status !== 'awaiting_facility_receipt') return;
    const refreshTimer = setInterval(() => {
      void loadPickup(false, true);
    }, 15000);
    return () => clearInterval(refreshTimer);
  }, [loadPickup, pickup?.pricingStage, pickup?.pricingWorkflowVersion, pickup?.status]);

  async function handleNavigateToPickup() {
    if (!pickup?.pickupAddress?.trim()) {
      Alert.alert('Address Unavailable', 'This pickup does not have a valid pickup address.');
      return;
    }

    const destination = encodeURIComponent(pickup.pickupAddress);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

    try {
      await Linking.openURL(url);
    } catch (navigationError) {
      console.error('Failed to open navigation:', navigationError);
      Alert.alert('Navigation Error', 'Unable to open directions. Please check that a maps app or browser is available.');
    }
  }

  async function handleNavigateToFacility() {
    if (!pickup || loadingFacilityDirections) return;

    setLoadingFacilityDirections(true);
    try {
      const url = await resolveFacilityDirectionsUrl(
        pickup,
        getPickupDestination,
      );
      try {
        await Linking.openURL(url);
      } catch (navigationError) {
        console.error('Unable to open destination directions:', navigationError);
        Alert.alert(
          'Navigation unavailable',
          'A maps app could not open the facility directions.',
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'Open in browser',
              onPress: () => {
                void WebBrowser.openBrowserAsync(url).catch((browserError: unknown) => {
                  console.error(
                    'Unable to open destination directions in browser:',
                    browserError,
                  );
                  Alert.alert(
                    'Directions unavailable',
                    'Unable to open Google Maps on this device. Try again later.',
                  );
                });
              },
            },
          ],
        );
      }
    } catch (destinationError) {
      if (destinationError instanceof FacilityDirectionsError) {
        switch (destinationError.reason) {
          case 'assigned-facility-missing':
            Alert.alert(
              'Destination unavailable',
              'This pickup has no valid assigned facility reference. Refresh pickup details; if it remains unavailable, contact support.',
            );
            break;
          case 'destination-lookup-failed':
            Alert.alert(
              'Could not verify facility',
              'The pickup has no saved facility address and the assigned facility could not be verified. Check your connection, refresh pickup details, and try again.',
            );
            break;
          case 'verified-destination-missing':
            Alert.alert(
              'Directions unavailable',
              'The assigned facility has no verified coordinates or usable address. Contact support before travelling.',
            );
            break;
        }
      } else {
        console.error('Unable to resolve destination directions.');
        Alert.alert(
          'Directions unavailable',
          'The assigned facility destination could not be resolved. Refresh pickup details and try again.',
        );
      }
    } finally {
      setLoadingFacilityDirections(false);
    }
  }

  async function handleCallCustomer() {
    if (!pickup || loadingCustomerPhone) return;

    let phoneNumber: string | null;
    try {
      setLoadingCustomerPhone(true);
      const customerContact = await getPickupCustomerPhone(pickup.id);
      if (!customerContact.customerFound) {
        Alert.alert(
          'Customer Profile Not Found',
          'The customer profile linked to this pickup could not be found.',
        );
        return;
      }
      phoneNumber = customerContact.phoneNumber?.trim() ?? null;
    } catch (lookupError) {
      if (lookupError instanceof CustomerPhoneLookupError) {
        console.warn('Customer contact lookup failed.', {
          code: lookupError.firebaseCode,
        });
        if (lookupError.failure === 'service-unavailable') {
          Alert.alert(
            'Contact Service Unavailable',
            'Customer calling is not available right now. Please try again later.',
          );
        } else if (lookupError.failure === 'pickup-not-found') {
          Alert.alert(
            'Pickup Contact Unavailable',
            'Customer phone number is unavailable for this pickup.',
          );
        } else if (lookupError.failure === 'permission-denied') {
          Alert.alert(
            'Unable to Access Customer Contact',
            'You are not authorized to access contact information for this pickup.',
          );
        } else if (lookupError.failure === 'network') {
          Alert.alert(
            'Connection Problem',
            'Customer contact could not be loaded. Check your connection and try again.',
          );
        } else {
          Alert.alert(
            'Customer Contact Error',
            'Customer contact could not be loaded. Please try again later.',
          );
        }
      } else {
        console.warn('Customer contact lookup failed.', {code: 'unknown'});
        Alert.alert(
          'Customer Contact Error',
          'Customer contact could not be loaded. Please try again later.',
        );
      }
      return;
    } finally {
      setLoadingCustomerPhone(false);
    }

    if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      Alert.alert(
        'Phone Number Unavailable',
        'Customer phone number is unavailable for this pickup.',
      );
      return;
    }

    const dialerUrl = `tel:${encodeURIComponent(phoneNumber)}`;
    try {
      await Linking.openURL(dialerUrl);
    } catch (dialerError) {
      const code =
        typeof dialerError === 'object' &&
        dialerError !== null &&
        'code' in dialerError &&
        typeof dialerError.code === 'string'
          ? dialerError.code
          : 'unknown';
      console.warn('Unable to open phone dialer.', {code});
      Alert.alert(
        'Unable to Open Phone Dialer',
        'Could not open the phone dialer. Please try again.',
      );
    }
  }

  async function handlePickupAction(action: Exclude<ActionType, null>) {
    if (actionLock.current) return;
    if (!rider || !pickup) {
      Alert.alert('Rider Profile Unavailable', 'Please sign in again and try once more.');
      return;
    }

    if (
      action === 'start' &&
      !getPickupPricingState(pickup).canStart
    ) {
      Alert.alert(
        'Final Price Not Confirmed',
        getPickupPricingState(pickup).message ??
          'Refresh the pickup and verify the customer confirmed the final price.',
      );
      return;
    }

    actionLock.current = true;
    try {
      setActionLoading(action);
      if (action === 'start') {
        await startPickup(pickup.id);
        Alert.alert('Pickup Started', 'This collection is now marked as in progress.');
      } else {
        const result = await completePickup(pickup.id);
        const currentPickup = pickupRef.current;
        if (currentPickup?.id === pickup.id) {
          const updatedPickup = {...currentPickup, status: result.status};
          pickupRef.current = updatedPickup;
          setPickup(updatedPickup);
        }
        Alert.alert(
          result.status === 'completed' ? 'Pickup Received' : 'Collection Complete',
          result.status === 'completed'
            ? 'Facility receipt has already been recorded. This pickup is completed.'
            : 'Collection is complete and is now awaiting facility receipt.',
        );
      }
      await loadPickup(false, action === 'complete');
    } catch (actionError) {
      console.error(`Failed to ${action} pickup:`, actionError);
      const message = actionError instanceof Error
        ? actionError.message
        : 'Something went wrong. Please try again.';
      Alert.alert(action === 'start' ? 'Unable to Start Pickup' : 'Unable to Complete Pickup', message);
    } finally {
      actionLock.current = false;
      setActionLoading(null);
    }
  }

  function openCancellationReasonDialog() {
    const currentPickup = pickupRef.current;
    if (
      actionLock.current ||
      !currentPickup ||
      currentPickup.status !== 'accepted' ||
      currentPickup.riderId !== rider?.id
    ) {
      return;
    }
    setCancellationReason('');
    setCancellationModalVisible(true);
  }

  async function submitPickupCancellation(reason: string) {
    if (actionLock.current) return;
    const currentPickup = pickupRef.current;
    if (
      !rider ||
      !currentPickup ||
      currentPickup.id !== pickupId ||
      currentPickup.status !== 'accepted' ||
      currentPickup.riderId !== rider.id
    ) {
      await loadPickup(false, true);
      Alert.alert(
        'Cancellation Not Available',
        'The pickup is no longer accepted or assigned to you. Its current details have been refreshed.',
      );
      return;
    }

    actionLock.current = true;
    setCancellationSubmitting(true);
    try {
      await cancelAcceptedPickupByRider(currentPickup.id, reason);
      setCancellationReason('');
      const confirmedPickup = {
        ...currentPickup,
        status: 'cancelled',
        cancelledBy: rider.id,
        cancellationReason: reason.trim(),
      };
      if (pickupIdRef.current === currentPickup.id) {
        pickupRef.current = confirmedPickup;
        setPickup(confirmedPickup);
        await loadPickup(false, true);
      }
      Alert.alert(
        'Pickup Cancelled',
        'The pickup was cancelled and the reason was recorded.',
        [{
          text: 'Back to My Pickups',
          onPress: () => router.replace(returnToList),
        }],
      );
    } catch (cancellationError) {
      console.error('Failed to cancel accepted pickup:', cancellationError);
      const refreshedPickup = await loadPickup(false, true);
      const currentStatus = refreshedPickup?.status?.toLowerCase() ??
        (pickupRef.current?.id === pickupId
          ? pickupRef.current.status?.toLowerCase()
          : undefined);
      const currentStatusLabel = currentStatus
        ? STATUS_LABELS[currentStatus] ?? currentStatus.replace(/_/g, ' ')
        : 'Unavailable';
      const message = cancellationError instanceof Error
        ? cancellationError.message
        : 'Something went wrong. Please try again.';
      Alert.alert(
        'Cancellation Not Completed',
        refreshedPickup
          ? `${message}\n\nCurrent pickup status: ${currentStatusLabel}.`
          : `${message}\n\nThe pickup status could not be refreshed. ` +
            `Last known status: ${currentStatusLabel}.`,
      );
    } finally {
      actionLock.current = false;
      setCancellationSubmitting(false);
    }
  }

  function confirmPickupCancellation() {
    const reason = cancellationReason.trim();
    if (!reason) {
      Alert.alert(
        'Reason Required',
        'Enter a reason before continuing with cancellation.',
      );
      return;
    }

    setCancellationModalVisible(false);
    Alert.alert(
      'Confirm Pickup Cancellation',
      `This reason will be recorded: “${reason}”. Confirm only if you and the Customer have agreed not to proceed.`,
      [
        {
          text: 'Go Back',
          style: 'cancel',
          onPress: () => setCancellationModalVisible(true),
        },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: () => void submitPickupCancellation(reason),
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#176744" />
        <Text style={styles.centerMessage}>Loading pickup details…</Text>
      </View>
    );
  }

  if (error || !pickup) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}><Text style={styles.errorIconText}>!</Text></View>
        <Text style={styles.errorTitle}>Pickup unavailable</Text>
        <Text style={styles.centerMessage}>{error || 'This pickup could not be found.'}</Text>
        <Pressable style={styles.primaryButton} onPress={() => { setLoadedPickupId(null); loadPickup(); }}>
          <Text style={styles.primaryButtonText}>Try again</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${returnLabel}`} style={styles.backLink} onPress={handleBackToList}>
          <Text style={styles.backLinkText}>Back to {returnLabel}</Text>
        </Pressable>
      </View>
    );
  }

  const status = pickup.status?.toLowerCase() ?? 'pending';
  const pricingState = getPickupPricingState(pickup);
  const statusLabel = pricingState.label ??
    STATUS_LABELS[status] ??
    status.replace(/_/g, ' ');
  const isActionInProgress = actionLoading !== null;
  const canPresentPickupQr = shouldShowPickupQr({
    status,
    isAssignedRider: pickup.riderId === rider?.id,
    canStart: pricingState.canStart,
    actualWeight: pickup.actualWeight,
    hasFacilityReceipt: pickup.facilityReceipt !== null,
  });
  const finalPriceConfirmed =
    pickup.pricingWorkflowVersion !== 2 ||
    pickup.pricingStage === 'customer_confirmed';
  const canCallCustomer =
    pickup.riderId === rider?.id &&
    (status === 'accepted' || status === 'in_progress');
  const canCancelAcceptedPickup =
    status === 'accepted' && pickup.riderId === rider?.id;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadPickup(true)}
            tintColor="#176744"
            colors={['#176744']}
          />
        }
      >
        <Pressable style={styles.backButton} onPress={handleBackToList} accessibilityRole="button" accessibilityLabel={`Back to ${returnLabel}`}>
          <Text style={styles.backButtonText}>‹  Back to {returnLabel}</Text>
        </Pressable>

        {refreshError ? (
          <Text accessibilityRole="alert" style={styles.refreshError}>
            {refreshError} Showing the last loaded pickup details.
          </Text>
        ) : null}

        <View style={styles.header}>
          <Text style={styles.eyebrow}>COLLECTION TASK</Text>
          <Text style={styles.title}>Pickup details</Text>
          <Text style={styles.subtitle}>Review the collection information before heading out.</Text>
          <View style={[styles.statusBadge, status === 'completed' ? styles.statusCompleted : status === 'in_progress' || status === 'awaiting_facility_receipt' ? styles.statusInProgress : styles.statusDefault]}>
            <View style={[styles.statusDot, status === 'completed' ? styles.dotCompleted : status === 'in_progress' || status === 'awaiting_facility_receipt' ? styles.dotInProgress : styles.dotDefault]} />
            <Text style={[styles.statusText, status === 'completed' ? styles.statusTextCompleted : status === 'in_progress' || status === 'awaiting_facility_receipt' ? styles.statusTextInProgress : styles.statusTextDefault]}>{statusLabel}</Text>
          </View>
        </View>

        <PickupRouteMap
          pickup={pickup}
          riderId={rider?.id}
          isActive={
            pickup.riderId === rider?.id &&
            (status === 'accepted' || status === 'in_progress')
          }
        />

        {canPresentPickupQr ? (
          <View style={styles.qrCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Facility receipt</Text>
              <RemixIcon name="qr-code-line" size={21} color="#176744" accessible={false} />
            </View>
            <Text style={styles.nextStepDescription}>
              {status === 'awaiting_facility_receipt'
                ? 'Collection is complete. Present this pickup’s QR code to facility staff so they can record the received weight.'
                : 'Present this pickup’s QR code to facility staff when they receive the collection.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.primaryButton}
              onPress={() => router.push({
                pathname: '/pickup-qr',
                params: {pickupId: pickup.id},
              })}
            >
              <Text style={styles.primaryButtonText}>Present Pickup QR</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Customer & Location</Text>
            <View style={styles.sectionActions}>
              {canCallCustomer ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Call customer"
                  accessibilityState={{disabled: loadingCustomerPhone}}
                  style={[
                    styles.headerActionButton,
                    loadingCustomerPhone && styles.buttonDisabled,
                  ]}
                  onPress={() => void handleCallCustomer()}
                  disabled={loadingCustomerPhone}
                >
                  {loadingCustomerPhone ? (
                    <ActivityIndicator size="small" color="#176744" />
                  ) : (
                    <RemixIcon
                      name="phone-line"
                      size={19}
                      color="#176744"
                      accessible={false}
                    />
                  )}
                </Pressable>
              ) : null}
              <View
                style={styles.headerActionButton}
                accessible={false}
                importantForAccessibility="no"
              >
                <RemixIcon
                  name="map-pin-line"
                  size={19}
                  color="#176744"
                  accessible={false}
                />
              </View>
            </View>
          </View>
          <Text style={styles.label}>CUSTOMER</Text>
          <Text style={styles.value}>{pickup.customerName || 'Customer information unavailable'}</Text>

          <View style={styles.divider} />
          <Text style={styles.label}>PICKUP ADDRESS</Text>
          <Text style={styles.value}>{pickup.pickupAddress || 'Address information unavailable'}</Text>
          {(status === 'accepted' || status === 'in_progress') && (
            <Pressable style={styles.navigationButton} onPress={handleNavigateToPickup}>
              <Text style={styles.navigationButtonText}>Open directions</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Collection information</Text>
          </View>
          {pickup.items?.length ? pickup.items.map((item, index) => (
            <View key={`${item.wasteTypeId}:${item.bagSizeId}:${index}`} style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.label}>WASTE ITEM</Text>
                <Text style={styles.value}>{item.wasteTypeName}</Text>
                <Text style={styles.secondaryValue}>
                  {item.bagSizeLabel} · {item.quantity} bag{item.quantity === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.label}>EST. WEIGHT</Text>
                <Text style={styles.value}>{item.estimatedWeightKg} kg</Text>
              </View>
            </View>
          )) : (
            <View style={styles.infoRow}>
              <View style={styles.infoBlock}>
                <Text style={styles.label}>WASTE TYPE</Text>
                <Text style={styles.value}>{pickup.wasteTypeName || 'Not specified'}</Text>
              </View>
              <View style={styles.infoBlock}>
                <Text style={styles.label}>EST. WEIGHT</Text>
                <Text style={styles.value}>{pickup.estimatedWeight ?? 0} kg</Text>
              </View>
            </View>
          )}
          {pickup.priceSnapshot ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.label}>
                {pickup.pricingWorkflowVersion === 2 && !finalPriceConfirmed
                  ? 'INITIAL ESTIMATE · NOT FINAL'
                  : 'TOTAL'}
              </Text>
              <Text style={styles.value}>
                {pickup.priceSnapshot.currency === 'PHP'
                  ? `₱${(pickup.priceSnapshot.amountCentavos / 100).toFixed(2)}`
                  : 'Price unavailable'}
              </Text>
              {typeof pickup.priceSnapshot.breakdown.basePickupFeeCentavos === 'number' ? (
                <Text style={styles.secondaryValue}>
                  Base fee ₱{(pickup.priceSnapshot.breakdown.basePickupFeeCentavos / 100).toFixed(2)}
                </Text>
              ) : null}
              {typeof pickup.priceSnapshot.breakdown.distanceCentavos === 'number' &&
              pickup.priceSnapshot.breakdown.distanceCentavos > 0 ? (
                <Text style={styles.secondaryValue}>
                  {typeof pickup.priceSnapshot.breakdown.facilityTransportDistanceMeters === 'number'
                    ? `Facility transport · ${(pickup.priceSnapshot.breakdown.facilityTransportDistanceMeters / 1000).toFixed(2)} km · `
                    : typeof pickup.priceSnapshot.breakdown.riderDistanceMeters === 'number'
                      ? `Legacy Rider route · ${(pickup.priceSnapshot.breakdown.riderDistanceMeters / 1000).toFixed(2)} km · `
                      : 'Facility transport · '}
                  {typeof pickup.priceSnapshot.breakdown.facilityTransportTierIndex === 'number' ?
                    `tier ${pickup.priceSnapshot.breakdown.facilityTransportTierIndex + 1} · ` :
                    typeof pickup.priceSnapshot.breakdown.riderDistanceTierIndex === 'number' ?
                      `legacy tier ${pickup.priceSnapshot.breakdown.riderDistanceTierIndex + 1} · ` : ''}
                  ₱{(pickup.priceSnapshot.breakdown.distanceCentavos / 100).toFixed(2)}
                </Text>
              ) : null}
              {typeof pickup.priceSnapshot.breakdown.loadSurchargeCentavos === 'number' ? (
                <Text style={styles.secondaryValue}>
                  Load surcharge ₱{(pickup.priceSnapshot.breakdown.loadSurchargeCentavos / 100).toFixed(2)}
                </Text>
              ) : null}
            </>
          ) : null}
          <View style={styles.divider} />
          <Text style={styles.label}>SCHEDULE</Text>
          <Text style={styles.value}>{pickup.scheduledDate || 'Date not set'} · {pickup.scheduledTime || 'Time not set'}</Text>
          <View style={styles.divider} />
          <Text style={styles.label}>DESTINATION FACILITY</Text>
          <Text style={styles.value}>{pickup.facilityName || 'Facility not assigned'}</Text>
          {pickup.facilityAddress ? <Text style={styles.secondaryValue}>{pickup.facilityAddress}</Text> : null}
          {(status === 'accepted' ||
            status === 'in_progress' ||
            status === 'awaiting_facility_receipt') ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open directions to destination facility"
              accessibilityState={{disabled: loadingFacilityDirections}}
              style={[
                styles.facilityNavigationButton,
                loadingFacilityDirections && styles.buttonDisabled,
              ]}
              onPress={() => void handleNavigateToFacility()}
              disabled={loadingFacilityDirections}
            >
              {loadingFacilityDirections ? (
                <ActivityIndicator size="small" color="#176744" />
              ) : (
                <RemixIcon
                  name="navigation-line"
                  size={17}
                  color="#176744"
                  accessible={false}
                />
              )}
              <Text style={styles.facilityNavigationButtonText}>
                Open Directions
              </Text>
            </Pressable>
          ) : null}
        </View>

        {pickup.notes?.trim() ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Important notes</Text>
            <Text style={styles.notesText}>{pickup.notes}</Text>
          </View>
        ) : null}

        {status === 'accepted' && !pricingState.canStart && (
          <View style={styles.nextStepCard}>
            <Text style={styles.nextStepEyebrow}>PRICING STATUS</Text>
            <Text style={styles.nextStepTitle}>{pricingState.label}</Text>
            <Text style={styles.nextStepDescription}>{pricingState.message}</Text>
          </View>
        )}

        {status === 'accepted' && pricingState.canStart && (
          <View style={styles.nextStepCard}>
            <Text style={styles.nextStepEyebrow}>NEXT STEP</Text>
            <Text style={styles.nextStepTitle}>Ready to collect?</Text>
            <Text style={styles.nextStepDescription}>When you arrive and are ready to begin, start this pickup to update its status.</Text>
            <Pressable
              style={[styles.primaryButton, isActionInProgress && styles.buttonDisabled]}
              onPress={() => handlePickupAction('start')}
              disabled={isActionInProgress}
            >
              {actionLoading === 'start' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Start pickup</Text>}
            </Pressable>
          </View>
        )}

        {canCancelAcceptedPickup ? (
          <View style={styles.cancellationCard}>
            <Text style={styles.nextStepEyebrow}>CANCELLATION</Text>
            <Text style={styles.nextStepTitle}>Need to cancel this pickup?</Text>
            <Text style={styles.nextStepDescription}>
              Use this only when you and the Customer have agreed not to proceed,
              including after a phone conversation. Your reason will be recorded
              with the pickup.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel accepted pickup"
              accessibilityState={{
                disabled: isActionInProgress || cancellationSubmitting,
              }}
              style={[
                styles.cancelButton,
                (isActionInProgress || cancellationSubmitting) &&
                  styles.buttonDisabled,
              ]}
              onPress={openCancellationReasonDialog}
              disabled={isActionInProgress || cancellationSubmitting}
            >
              {cancellationSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Cancel Pickup</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {status === 'in_progress' && (
          <View style={styles.nextStepCard}>
            <Text style={styles.nextStepEyebrow}>PICKUP IN PROGRESS</Text>
            <Text style={styles.nextStepTitle}>Collection complete?</Text>
            <Text style={styles.nextStepDescription}>Completing collection sends the pickup to facility staff for receipt. It does not mark the entire pickup completed.</Text>
            <Pressable
              style={[styles.completeButton, isActionInProgress && styles.buttonDisabled]}
              onPress={() => handlePickupAction('complete')}
              disabled={isActionInProgress}
            >
              {actionLoading === 'complete' ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Complete Collection</Text>}
            </Pressable>
          </View>
        )}

        {status === 'awaiting_facility_receipt' && (
          <View style={styles.nextStepCard}>
            <Text style={styles.nextStepEyebrow}>COLLECTION COMPLETE</Text>
            <Text style={styles.nextStepTitle}>Awaiting facility receipt</Text>
            <Text style={styles.nextStepDescription}>
              Facility staff must scan the pickup QR and record the actual received
              weight before this pickup is marked completed.
            </Text>
            {pickup.collectedWeightKg !== null ? (
              <>
                <Text style={styles.label}>Rider collection weight</Text>
                <Text style={styles.value}>{pickup.collectedWeightKg} kg</Text>
              </>
            ) : null}
          </View>
        )}

        {status === 'completed' && (
          <View style={styles.completedCard}>
            <Text style={styles.completedIcon}>✓</Text>
            <View style={styles.completedCopy}>
              <Text style={styles.completedTitle}>Pickup completed</Text>
              <Text style={styles.completedDescription}>Facility receipt has been recorded. This pickup is fully completed.</Text>
            </View>
            {getFacilityReceivedWeight(pickup) !== null ? (
              <Text style={styles.completedDescription}>
                Facility received: {getFacilityReceivedWeight(pickup)} kg
              </Text>
            ) : null}
          </View>
        )}

        {pickup.facilityReceipt ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Facility receipt</Text>
            <Text style={styles.label}>STATUS</Text>
            <Text style={styles.value}>Verified by facility staff</Text>
            {pickup.facilityName || pickup.facilityReceipt.facilityId ? (
              <>
                <Text style={styles.label}>RECEIVING FACILITY</Text>
                <Text style={styles.value}>
                  {pickup.facilityName ?? pickup.facilityReceipt.facilityId}
                </Text>
              </>
            ) : null}
            <Text style={styles.label}>ACTUAL FACILITY-RECEIVED WEIGHT</Text>
            <Text style={styles.value}>
              {getFacilityReceivedWeight(pickup) ?? 'Unavailable'} kg
            </Text>
            {pickup.collectedWeightKg !== null ? (
              <>
                <Text style={styles.label}>RIDER COLLECTION WEIGHT</Text>
                <Text style={styles.value}>{pickup.collectedWeightKg} kg</Text>
              </>
            ) : null}
            <Text style={styles.label}>RECEIPT TIME</Text>
            <Text style={styles.value}>
              {formatPickupTimestamp(pickup.facilityReceipt.receivedAt) ?? 'Unavailable'}
            </Text>
          </View>
        ) : null}

        {(status === 'cancelled' || status === 'canceled') && (
          <View style={styles.nextStepCard}>
            <Text style={styles.nextStepEyebrow}>PICKUP CANCELLED</Text>
            <Text style={styles.nextStepTitle}>
              {getPickupCancellationLabel(pickup)}
            </Text>
            <Text style={styles.nextStepDescription}>
              Do not proceed with collection.
            </Text>
            {pickup.cancellationReason ? (
              <>
                <Text style={styles.label}>RECORDED REASON</Text>
                <Text style={styles.value}>{pickup.cancellationReason}</Text>
              </>
            ) : null}
          </View>
        )}

        <Text style={styles.footerText}>BasuraGo Rider · Collect responsibly</Text>
      </ScrollView>

      <Modal
        visible={cancellationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCancellationModalVisible(false);
          setCancellationReason('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={styles.modalKeyboardAvoiding}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
          <View style={styles.modalCard}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              showsVerticalScrollIndicator={false}
            >
            <Text style={styles.modalTitle}>Cancellation reason</Text>
            <Text style={styles.modalDescription}>
              Enter the reason agreed with the Customer. This will be recorded
              in the pickup history. Cancellation is only available before
              collection starts.
            </Text>
            <TextInput
              accessibilityLabel="Cancellation reason"
              value={cancellationReason}
              onChangeText={setCancellationReason}
              placeholder="Enter the agreed reason"
              placeholderTextColor="#87948A"
              multiline
              maxLength={500}
              editable={!cancellationSubmitting}
              textAlignVertical="top"
              style={styles.cancellationInput}
            />
            <Text style={styles.characterCount}>
              {cancellationReason.length}/500
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                style={styles.modalSecondaryButton}
                onPress={() => {
                  setCancellationModalVisible(false);
                  setCancellationReason('');
                }}
                disabled={cancellationSubmitting}
              >
                <Text style={styles.modalSecondaryButtonText}>Keep Pickup</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[
                  styles.cancelButton,
                  styles.modalPrimaryButton,
                  (!cancellationReason.trim() || cancellationSubmitting) &&
                    styles.buttonDisabled,
                ]}
                onPress={confirmPickupCancellation}
                disabled={!cancellationReason.trim() || cancellationSubmitting}
              >
                <Text style={styles.primaryButtonText}>Review Cancellation</Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8F6' },
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#F5F8F6' },
  centerMessage: { marginTop: 10, maxWidth: 300, color: '#738077', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  refreshError: { marginBottom: 14, color: '#A33B2F', fontSize: 13, lineHeight: 18 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 12, marginBottom: 18 },
  backButtonText: { color: '#176744', fontSize: 13, fontWeight: '800' },

  header: { padding: 22, borderRadius: 24, backgroundColor: '#176744', marginBottom: 15 },
  headerIcon: { width: 45, height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#E8F5EC', marginBottom: 19 },
  headerIconText: { color: '#176744', fontSize: 25, fontWeight: '800' },
  eyebrow: { color: '#BDE3C9', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  title: { marginTop: 6, color: '#FFFFFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  subtitle: { marginTop: 7, maxWidth: 320, color: '#D3E9DA', fontSize: 12, lineHeight: 18 },
  statusBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 17, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10 },
  statusDefault: { backgroundColor: '#E7F5EC' },
  statusInProgress: { backgroundColor: '#FFF1CC' },
  statusCompleted: { backgroundColor: '#E8F5EC' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  dotDefault: { backgroundColor: '#176744' },
  dotInProgress: { backgroundColor: '#B7791F' },
  dotCompleted: { backgroundColor: '#176744' },
  statusText: { fontSize: 11, fontWeight: '800', textTransform: 'capitalize' },
  statusTextDefault: { color: '#176744' },
  statusTextInProgress: { color: '#A56500' },
  statusTextCompleted: { color: '#176744' },

  card: { padding: 20, marginBottom: 13, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8DE' },
  qrCard: { padding: 20, marginBottom: 13, borderRadius: 20, backgroundColor: '#E8F5EC', borderWidth: 1, borderColor: '#C9E7D2' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerActionButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  sectionTitle: { color: '#173D2C', fontSize: 16, fontWeight: '800' },
  sectionSymbol: { color: '#176744', fontSize: 22, fontWeight: '700' },
  label: { color: '#829087', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  value: { marginTop: 6, color: '#173D2C', fontSize: 14, fontWeight: '600', lineHeight: 21 },
  secondaryValue: { marginTop: 3, color: '#78867C', fontSize: 12, lineHeight: 18 },
  divider: { height: 1, marginVertical: 16, backgroundColor: '#EEF2EF' },
  infoRow: { flexDirection: 'row', gap: 14 },
  infoBlock: { flex: 1 },
  navigationButton: { alignSelf: 'flex-start', marginTop: 15, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 11, backgroundColor: '#E8F5EC' },
  navigationButtonText: { color: '#176744', fontSize: 12, fontWeight: '800' },
  facilityNavigationButton: { flexDirection: 'row', alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, marginTop: 13, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#E8F5EC' },
  facilityNavigationButtonText: { color: '#176744', fontSize: 12, fontWeight: '800' },

  notesCard: { padding: 17, marginBottom: 13, borderRadius: 17, borderWidth: 1, borderColor: '#EBDCB6', backgroundColor: '#FFF9E9' },
  notesTitle: { color: '#775B1C', fontSize: 13, fontWeight: '800' },
  notesText: { marginTop: 6, color: '#6D5A32', fontSize: 13, lineHeight: 20 },
  nextStepCard: { padding: 19, marginTop: 2, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDEBE0' },
  nextStepEyebrow: { color: '#176744', fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  nextStepTitle: { marginTop: 7, color: '#173D2C', fontSize: 18, fontWeight: '800' },
  nextStepDescription: { marginTop: 6, color: '#748178', fontSize: 12, lineHeight: 18 },
  cancellationCard: { padding: 19, marginTop: 13, borderRadius: 19, backgroundColor: '#FFF9E9', borderWidth: 1, borderColor: '#EBDCB6' },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 15, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 13, backgroundColor: '#A33B2F' },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: '#176744' },
  completeButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: '#124D33' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  buttonDisabled: { opacity: 0.65 },
  completedCard: { flexDirection: 'row', alignItems: 'center', padding: 17, borderRadius: 17, backgroundColor: '#E8F5EC', borderWidth: 1, borderColor: '#C9E7D2' },
  completedIcon: { width: 37, height: 37, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 13, backgroundColor: '#FFFFFF', color: '#176744', fontSize: 23, fontWeight: '800' },
  completedCopy: { flex: 1, marginLeft: 12 },
  completedTitle: { color: '#176744', fontSize: 14, fontWeight: '800' },
  completedDescription: { marginTop: 3, color: '#5C7966', fontSize: 11, lineHeight: 16 },
  errorIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEECEB' },
  errorIconText: { color: '#B42318', fontSize: 22, fontWeight: '800' },
  errorTitle: { marginTop: 14, color: '#25352A', fontSize: 18, fontWeight: '800' },
  primaryButtonTextUnused: { color: '#FFFFFF' },
  backLink: { marginTop: 16, padding: 10 },
  backLinkText: { color: '#176744', fontSize: 13, fontWeight: '800' },
  footerText: { marginTop: 22, color: '#9AA69D', fontSize: 10, textAlign: 'center', letterSpacing: 0.4 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(20, 35, 25, 0.55)' },
  modalKeyboardAvoiding: { flex: 1, justifyContent: 'center' },
  modalCard: { width: '100%', maxWidth: 520, maxHeight: '90%', alignSelf: 'center', padding: 22, borderRadius: 20, backgroundColor: '#FFFFFF' },
  modalTitle: { color: '#173D2C', fontSize: 20, fontWeight: '800' },
  modalDescription: { marginTop: 8, color: '#748178', fontSize: 13, lineHeight: 19 },
  cancellationInput: { minHeight: 110, marginTop: 17, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#DCE8DE', color: '#173D2C', fontSize: 14, lineHeight: 20 },
  characterCount: { marginTop: 5, color: '#87948A', fontSize: 11, textAlign: 'right' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  modalSecondaryButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8DE' },
  modalSecondaryButtonText: { color: '#435248', fontSize: 12, fontWeight: '800' },
  modalPrimaryButton: { flex: 1, marginTop: 0 },
});
