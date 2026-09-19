import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type LegalDocumentType =
  | 'terms'
  | 'privacy';

interface LegalDocumentModalProps {
  visible: boolean;
  type: LegalDocumentType;
  onClose: () => void;
}

export default function LegalDocumentModal({
  visible,
  type,
  onClose,
}: LegalDocumentModalProps) {
  const isTerms = type === 'terms';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {isTerms
              ? 'Terms of Service'
              : 'Privacy Notice'}
          </Text>

          <Pressable
            style={styles.closeButton}
            onPress={onClose}
          >
            <Text style={styles.closeButtonText}>
              ✕
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={true}
        >
          {isTerms ? (
            <>
              <Text style={styles.documentTitle}>
                BasuraGo Terms of Service
              </Text>

              <Text style={styles.heading}>
                1. Account
              </Text>

              <Text style={styles.paragraph}>
                You are responsible for providing
                accurate information when creating
                your BasuraGo account and for keeping
                your account credentials secure.
              </Text>

              <Text style={styles.heading}>
                2. Rider Responsibilities
              </Text>

              <Text style={styles.paragraph}>
                Riders are responsible for following
                BasuraGo pickup procedures, maintaining
                accurate account information, and
                performing assigned services responsibly.
              </Text>

              <Text style={styles.heading}>
                3. Pickup Services
              </Text>

              <Text style={styles.paragraph}>
                Riders must follow the pickup details
                provided through the BasuraGo application
                and update the pickup status accurately.
              </Text>

              <Text style={styles.heading}>
                4. Account Suspension
              </Text>

              <Text style={styles.paragraph}>
                BasuraGo may restrict or suspend access
                to an account when there is a violation
                of the applicable rules or requirements.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.documentTitle}>
                BasuraGo Privacy Notice
              </Text>

              <Text style={styles.heading}>
                1. Information We Collect
              </Text>

              <Text style={styles.paragraph}>
                BasuraGo may collect information needed
                to create and operate your account,
                provide pickup services, and manage
                rider operations.
              </Text>

              <Text style={styles.heading}>
                2. Location Information
              </Text>

              <Text style={styles.paragraph}>
                When a rider is online, BasuraGo may
                collect location information to support
                rider operations and live location
                functionality.
              </Text>

              <Text style={styles.heading}>
                3. How We Use Information
              </Text>

              <Text style={styles.paragraph}>
                Information may be used to operate the
                BasuraGo service, manage accounts,
                coordinate pickups, and support
                administrative functions.
              </Text>

              <Text style={styles.heading}>
                4. Your Privacy
              </Text>

              <Text style={styles.paragraph}>
                BasuraGo will provide information about
                its handling of personal data and the
                applicable rights and choices available
                to users.
              </Text>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.closeFooterButton}
            onPress={onClose}
          >
            <Text style={styles.closeFooterButtonText}>
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },

  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },

  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },

  scrollView: {
    flex: 1,
  },

  content: {
    padding: 24,
    paddingBottom: 40,
  },

  documentTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },

  heading: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 17,
    fontWeight: '700',
  },

  paragraph: {
    fontSize: 15,
    lineHeight: 23,
  },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
  },

  closeFooterButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#1b5e20',
  },

  closeFooterButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});