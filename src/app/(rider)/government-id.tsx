import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import { router } from 'expo-router';

import { useState } from 'react';

import {
  getCurrentUser,
} from '../../services/firebase/auth/auth.services';

import {
  deleteRiderDocument,
  uploadGovernmentId,
} from '../../services/supabase/storage/storage.services';

import {
  saveGovernmentIdDocuments,
} from '../../services/firebase/riders/document.services';

type CaptureSide = 'front' | 'back';

export default function GovernmentIdScreen() {
  const [
    permission,
    requestPermission,
  ] = useCameraPermissions();

  const [
    cameraVisible,
    setCameraVisible,
  ] = useState(false);

  const [
    captureSide,
    setCaptureSide,
  ] = useState<CaptureSide>('front');

  const [
    frontImage,
    setFrontImage,
  ] = useState<string | null>(null);

  const [
    backImage,
    setBackImage,
  ] = useState<string | null>(null);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    camera,
    setCamera,
  ] = useState<CameraView | null>(null);

  async function handleStartCamera(
    side: CaptureSide,
  ) {
    if (!permission) {
      return;
    }

    if (!permission.granted) {
      const result =
        await requestPermission();

      if (!result.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is required to capture your government ID.',
        );

        return;
      }
    }

    setCaptureSide(side);
    setCameraVisible(true);
  }

  async function handleCapture() {
    if (!camera) {
      return;
    }

    try {
      const photo =
        await camera.takePictureAsync({
          quality: 0.8,
        });

      if (!photo?.uri) {
        Alert.alert(
          'Capture Failed',
          'We could not capture the ID image. Please try again.',
        );

        return;
      }

      if (captureSide === 'front') {
        setFrontImage(photo.uri);
      } else {
        setBackImage(photo.uri);
      }

      setCameraVisible(false);
    } catch (error) {
      console.error(
        'Government ID capture failed:',
        error,
      );

      Alert.alert(
        'Capture Failed',
        'Something went wrong while capturing the ID. Please try again.',
      );
    }
  }

  function handleRetake(
    side: CaptureSide,
  ) {
    if (side === 'front') {
      setFrontImage(null);
    } else {
      setBackImage(null);
    }

    handleStartCamera(side);
  }

  async function handleContinue() {
    if (!frontImage) {
      Alert.alert(
        'Front ID Required',
        'Please capture the front of your government ID.',
      );

      return;
    }

    if (!backImage) {
      Alert.alert(
        'Back ID Required',
        'Please capture the back of your government ID.',
      );

      return;
    }

    const user = getCurrentUser();

    if (!user) {
      Alert.alert(
        'Session Expired',
        'Please sign in again to continue.',
      );

      router.replace('/login');

      return;
    }

    let frontPath: string | null = null;
    let backPath: string | null = null;

    try {
      setUploading(true);

      frontPath = await uploadGovernmentId(
        user.uid,
        frontImage,
        'front',
      );

      backPath = await uploadGovernmentId(
        user.uid,
        backImage,
        'back',
      );

      await saveGovernmentIdDocuments(
        user.uid,
        {
          frontPath,
          backPath,
        },
      );

      Alert.alert(
        'Government ID Saved',
        'Your government ID has been securely uploaded.',
        [
          {
            text: 'Continue',
            onPress: () =>
              router.push('/drivers-license'),
          },
        ],
      );
    } catch (error) {
      console.error(
        'Government ID upload failed:',
        error,
      );

      try {
        if (frontPath) {
          await deleteRiderDocument(frontPath);
        }

        if (backPath) {
          await deleteRiderDocument(backPath);
        }
      } catch (cleanupError) {
        console.error(
          'Government ID cleanup failed:',
          cleanupError,
        );
      }

      Alert.alert(
        'Upload Failed',
        'We could not upload your government ID. Please check your connection and try again.',
      );
    } finally {
      setUploading(false);
    }
  }

  if (cameraVisible) {
    return (
      <SafeAreaView
        style={styles.cameraContainer}
      >
        <CameraView
          ref={setCamera}
          style={styles.camera}
          facing="back"
        />

        <View
          style={styles.cameraOverlay}
        >
          <View
            style={styles.cameraHeader}
          >
            <Pressable
              onPress={() =>
                setCameraVisible(false)
              }
              style={styles.closeButton}
            >
              <Text
                style={styles.closeButtonText}
              >
                Cancel
              </Text>
            </Pressable>

            <Text
              style={styles.cameraTitle}
            >
              {captureSide === 'front'
                ? 'Front of ID'
                : 'Back of ID'}
            </Text>

            <View
              style={styles.headerSpacer}
            />
          </View>

          <View
            style={styles.idGuide}
          >
            <Text
              style={styles.guideText}
            >
              Position your ID inside the frame
            </Text>
          </View>

          <View
            style={styles.cameraBottom}
          >
            <Text
              style={styles.cameraInstruction}
            >
              Make sure the entire ID is visible
              and readable.
            </Text>

            <Pressable
              onPress={handleCapture}
              style={styles.captureButton}
            >
              <View
                style={styles.captureButtonInner}
              />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          VERIFICATION 1 OF 4
        </Text>

        <Text style={styles.title}>
          Government ID
        </Text>

        <Text style={styles.subtitle}>
          Capture clear photos of the front and
          back of your government-issued ID.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Front of ID
          </Text>

          {frontImage ? (
            <>
              <Image
                source={{
                  uri: frontImage,
                }}
                style={styles.preview}
              />

              <Pressable
                onPress={() =>
                  handleRetake('front')
                }
                style={styles.secondaryButton}
              >
                <Text
                  style={styles.secondaryButtonText}
                >
                  Retake Front
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() =>
                handleStartCamera('front')
              }
              style={styles.captureCard}
            >
              <Text
                style={styles.captureIcon}
              >
                📷
              </Text>

              <Text
                style={styles.captureCardTitle}
              >
                Capture Front
              </Text>

              <Text
                style={styles.captureCardText}
              >
                Take a photo of the front of your
                ID
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            Back of ID
          </Text>

          {backImage ? (
            <>
              <Image
                source={{
                  uri: backImage,
                }}
                style={styles.preview}
              />

              <Pressable
                onPress={() =>
                  handleRetake('back')
                }
                style={styles.secondaryButton}
              >
                <Text
                  style={styles.secondaryButtonText}
                >
                  Retake Back
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() =>
                handleStartCamera('back')
              }
              style={styles.captureCard}
            >
              <Text
                style={styles.captureIcon}
              >
                📷
              </Text>

              <Text
                style={styles.captureCardTitle}
              >
                Capture Back
              </Text>

              <Text
                style={styles.captureCardText}
              >
                Take a photo of the back of your
                ID
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.tip}>
          <Text style={styles.tipTitle}>
            Photo tips
          </Text>

          <Text style={styles.tipText}>
            • Use good lighting
            {'\n'}
            • Keep the ID flat and fully visible
            {'\n'}
            • Avoid glare and reflections
            {'\n'}
            • Make sure the text is readable
          </Text>
        </View>

        <Pressable
          onPress={handleContinue}
          disabled={
            !frontImage ||
            !backImage ||
            uploading
          }
          style={[
            styles.primaryButton,
            (
              !frontImage ||
              !backImage ||
              uploading
            ) &&
              styles.primaryButtonDisabled,
          ]}
        >
          <Text
            style={styles.primaryButtonText}
          >
            {uploading
              ? 'Uploading...'
              : 'Continue'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  scrollView: {
    flex: 1,
  },

  content: {
    padding: 24,
    paddingBottom: 40,
  },

  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#6B7280',
    marginBottom: 8,
  },

  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginBottom: 24,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },

  captureCard: {
    minHeight: 130,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },

  captureIcon: {
    fontSize: 28,
    marginBottom: 8,
  },

  captureCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },

  captureCardText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },

  preview: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    resizeMode: 'cover',
    marginBottom: 12,
  },

  secondaryButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  tip: {
    backgroundColor: '#EEF6FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },

  tipText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4B5563',
  },

  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonDisabled: {
    opacity: 0.45,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },

  camera: {
    flex: 1,
  },

  cameraOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
  },

  cameraHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  headerSpacer: {
    width: 50,
  },

  idGuide: {
    alignSelf: 'center',
    width: '88%',
    aspectRatio: 1.586,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 12,
  },

  guideText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  cameraBottom: {
    alignItems: 'center',
    paddingBottom: 36,
    paddingHorizontal: 24,
  },

  cameraInstruction: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },

  captureButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
});