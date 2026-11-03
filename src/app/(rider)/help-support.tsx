import {useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';

const SUPPORT_EMAIL = 'basurago.support2026@gmail.com';

const SUPPORT_TOPICS = [
  {
    title: 'Account and verification',
    body: 'For sign-in, profile, application review, or verification-document '
      + 'issues, include the step you are on and any message shown in the app.',
  },
  {
    title: 'Pickup assignments and status',
    body: 'Check the pickup details and current status first. For an '
      + 'assignment or status that looks incorrect, describe the pickup '
      + 'reference and what you expected to happen.',
  },
  {
    title: 'Cancellation',
    body: 'A Rider cancellation is available only for an accepted pickup. '
      + 'The Rider must enter a reason, and the cancellation and reason are '
      + 'recorded in the pickup service. Use it when you and the Customer '
      + 'have agreed not to proceed.',
  },
  {
    title: 'App or technical problem',
    body: 'Include your device type, what you were trying to do, and the '
      + 'error message if one appeared. Do not include passwords or '
      + 'verification documents in a support email.',
  },
  {
    title: 'Operational issue',
    body: 'For a concern affecting an assigned pickup or facility handoff, '
      + 'describe the pickup reference, the operational issue, and whether '
      + 'collection has started. Do not rely on this page as an emergency '
      + 'or real-time dispatch channel.',
  },
];

export default function RiderHelpSupportScreen() {
  const [problemDescription, setProblemDescription] = useState('');

  async function openSupportEmail(subject: string, body: string) {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Unable to open Rider support email:', error);
      Alert.alert(
        'Unable to open email',
        `No email app could open this draft. You can email ${SUPPORT_EMAIL} from your email app.`,
      );
    }
  }

  function contactSupport() {
    void openSupportEmail(
      'BasuraGo Rider Support',
      'Hello BasuraGo Support,\n\nI need help with my Rider account or an assigned pickup:\n\n\nThank you.',
    );
  }

  function reportProblem() {
    const description = problemDescription.trim();
    if (!description) {
      Alert.alert(
        'Describe the issue',
        'Add a short description before preparing your email.',
      );
      return;
    }
    void openSupportEmail(
      'BasuraGo Rider Problem Report',
      `Hello BasuraGo Support,\n\nI would like to report the following Rider app or operational problem:\n\n${description}\n\nThank you.`,
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
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

          <Text style={styles.eyebrow}>BASURAGO RIDER</Text>
          <Text style={styles.title}>Help and support</Text>
          <Text style={styles.intro}>
            Find guidance for Rider account, verification, pickup, and app
            issues. The contact option opens an email draft for you to review.
          </Text>

          <View style={styles.contactCard}>
            <Text style={styles.cardTitle}>Contact Support</Text>
            <Text style={styles.body}>
              The BasuraGo app currently provides the support email
              {` ${SUPPORT_EMAIL}`}. There is no in-app Rider ticket or
              real-time dispatch workflow configured here.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={contactSupport}
              style={({pressed}) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Email Support</Text>
            </Pressable>
            <Text style={styles.caption}>
              Your email app opens a draft. Review and send it yourself;
              BasuraGo does not automatically attach account or pickup data.
              No response time is specified in the app.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Common Rider support topics</Text>
          <View style={styles.card}>
            {SUPPORT_TOPICS.map((topic, index) => (
              <View key={topic.title}>
                {index > 0 ? <View style={styles.divider} /> : null}
                <View style={styles.topic}>
                  <Text style={styles.topicTitle}>{topic.title}</Text>
                  <Text style={styles.body}>{topic.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Prepare a problem report</Text>
            <Text style={styles.body}>
              Describe the issue and the app will prepare an email draft to
              {` ${SUPPORT_EMAIL}`}. The description is included only in the
              draft.
            </Text>
            <TextInput
              accessibilityLabel="Rider problem description"
              value={problemDescription}
              onChangeText={setProblemDescription}
              placeholder="What were you trying to do?"
              placeholderTextColor="#8A9B8F"
              multiline
              maxLength={1000}
              textAlignVertical="top"
              style={styles.input}
            />
            <Text style={styles.characterCount}>
              {problemDescription.length}/1000
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={reportProblem}
              style={({pressed}) => [
                styles.secondaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryButtonText}>
                Prepare Problem Report
              </Text>
            </Pressable>
            <Text style={styles.caption}>
              The report is not submitted or saved by BasuraGo unless you send
              the email yourself.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: '#F5F8F6'},
  flex: {flex: 1},
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
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  title: {color: '#173D2C', fontSize: 29, fontWeight: '800'},
  intro: {
    color: '#64736A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#173D2C',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 24,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5ECE6',
    paddingHorizontal: 17,
    marginBottom: 14,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5ECE6',
    padding: 17,
  },
  cardTitle: {
    color: '#173D2C',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  body: {color: '#536158', fontSize: 13, lineHeight: 20},
  topic: {paddingVertical: 15},
  topicTitle: {
    color: '#173D2C',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  divider: {height: 1, backgroundColor: '#EDF1ED'},
  caption: {
    color: '#849187',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 11,
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#DCE8DE',
    borderRadius: 12,
    backgroundColor: '#FAFCFA',
    color: '#173D2C',
    fontSize: 14,
    lineHeight: 20,
    padding: 13,
    marginTop: 14,
  },
  characterCount: {
    color: '#849187',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 5,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176744',
    borderRadius: 12,
    marginTop: 14,
  },
  primaryButtonText: {color: '#FFFFFF', fontSize: 14, fontWeight: '700'},
  secondaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#176744',
    borderRadius: 12,
    marginTop: 12,
  },
  secondaryButtonText: {color: '#176744', fontSize: 14, fontWeight: '700'},
  pressed: {opacity: 0.75},
});
