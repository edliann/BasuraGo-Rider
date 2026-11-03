import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

interface PrivacySectionProps {
  title: string;
  children: string;
}

function PrivacySection({title, children}: PrivacySectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function RiderPrivacyScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to account"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/account');
          }}
          style={({pressed}) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.backText}>‹  Back to account</Text>
        </Pressable>

        <Text style={styles.eyebrow}>YOUR INFORMATION</Text>
        <Text style={styles.title}>Rider Privacy</Text>
        <Text style={styles.intro}>
          This summary describes Rider-app and Backend behavior visible in the
          current implementation. It is not a legal privacy policy.
        </Text>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Policy details need confirmation</Text>
          <Text style={styles.noticeBody}>
            The app does not state a data-retention period or provide a
            dedicated privacy-request workflow. An approved privacy policy,
            retention schedule, and privacy contact process should be
            confirmed before launch.
          </Text>
        </View>

        <View style={styles.card}>
          <PrivacySection title="Account and profile">
            The Rider app uses Firebase Authentication for sign-in and reads
            Rider profile information such as name, phone number, account
            status, assigned vehicle, and online state. The account screen also
            displays the signed-in email when available.
          </PrivacySection>

          <PrivacySection title="Verification information">
            The verification flow collects government ID images, driver
            licence images, and a face-verification selfie. The Rider app
            uploads these files to the Supabase Storage bucket
            rider-documents and saves their file paths and completion state in
            the rider application record. This page does not define who reviews
            those files or how long they are kept.
          </PrivacySection>

          <PrivacySection title="Location while online">
            The app requests foreground location permission and, on Android,
            background location permission for location reporting while the
            Rider is online. The app publishes validated coordinates,
            accuracy, and a location timestamp through a Firebase callable;
            the Backend stores the current Rider location in Firestore.
            Android can report in the background while online. On iOS, the
            current implementation reports while the app is open. Device
            permission and location services must be enabled for reporting.
          </PrivacySection>

          <PrivacySection title="Pickup and operational records">
            Pickup records used by the Rider app include pickup reference,
            Customer and facility identifiers, address and schedule, waste
            details, status changes, and collection or receipt information.
            When a Rider cancels an accepted pickup, the Backend records the
            cancellation actor, time, and entered reason with the pickup and
            an audit event. These records support pickup coordination and
            operational history.
          </PrivacySection>

          <PrivacySection title="Information shared for assigned pickups">
            The Rider app can retrieve Customer contact information for a
            pickup through an authenticated Backend callable. The Customer
            contact response is limited to a phone number and is available
            only to the assigned Rider for eligible pickup states. The
            Customer app can receive the assigned Rider&apos;s name and phone
            number, and can display a fresh Rider location for an active
            assigned pickup. This page does not specify further use or
            retention by either party.
          </PrivacySection>

          <PrivacySection title="Storage, access, and retention">
            Account and pickup records are handled through Firebase services
            and Backend functions; verification files are uploaded to Supabase
            Storage. The code reviewed for this page does not establish a
            general retention period, a deletion schedule, or all staff
            access procedures. Do not treat this summary as a guarantee about
            retention or access beyond the described app flows.
          </PrivacySection>

          <PrivacySection title="Privacy questions">
            The app includes a BasuraGo support email link on the Help and
            Support page, but the code does not designate it as a privacy
            request channel or define an access, correction, or deletion
            process. Confirm an official privacy contact and process before
            launch. Avoid sending identity documents or other sensitive
            information through an ordinary support email.
          </PrivacySection>
        </View>

        <Text style={styles.footer}>
          This implementation summary is not a legal policy and does not
          establish privacy rights, retention periods, or deletion guarantees.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F5F8F6'},
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
  },
  backButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginBottom: 14,
    paddingRight: 12,
  },
  backText: {color: '#176744', fontSize: 15, fontWeight: '700'},
  eyebrow: {
    color: '#38B84A',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  title: {color: '#173D2C', fontSize: 28, fontWeight: '800'},
  intro: {
    color: '#64736A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 18,
  },
  notice: {
    backgroundColor: '#FFF8E8',
    borderColor: '#F1E2B9',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  noticeTitle: {
    color: '#604A15',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  noticeBody: {color: '#66582F', fontSize: 13, lineHeight: 20},
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5ECE6',
    paddingHorizontal: 16,
  },
  section: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF1ED',
  },
  sectionTitle: {
    color: '#173D2C',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 7,
  },
  body: {color: '#536158', fontSize: 13, lineHeight: 20},
  footer: {
    color: '#849187',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 15,
    paddingHorizontal: 2,
  },
  pressed: {opacity: 0.75},
});
