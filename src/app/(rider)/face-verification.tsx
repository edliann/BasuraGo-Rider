import { useRef, useState } from 'react';

import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
  type CameraView as CameraViewType,
} from 'expo-camera';

import { useRouter } from 'expo-router';

import {
  getCurrentUser,
} from '../../services/firebase/auth/auth.services';

import FaceDetection from '@react-native-ml-kit/face-detection';

import {
  saveFaceVerificationDocument,
} from '../../services/firebase/riders/document.services';

import {
  deleteRiderDocument,
  uploadFaceVerification,
} from '../../services/supabase/storage/storage.services';

export default function FaceVerificationScreen() {
  const router = useRouter();

  const cameraRef =
    useRef<CameraViewType | null>(null);

  const [permission, requestPermission] =
    useCameraPermissions();

  const [cameraReady, setCameraReady] =
    useState(false);

  const [capturing, setCapturing] =
    useState(false);

  const [selfieImage, setSelfieImage] =
    useState<string | null>(null);

  const [uploading, setUploading] =
    useState(false);

  async function handleCapture() {
    if (
      !cameraReady ||
      capturing ||
      !cameraRef.current
    ) {
      return;
    }

    try {
      setCapturing(true);

      const photo =
        await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });

      if (!photo?.uri) {
        throw new Error(
          'The camera did not return an image.',
        );
      }

      const faces = await FaceDetection.detect(
        photo.uri,
        {
          landmarkMode: 'all',
        },
      );

      if (faces.length === 0) {
        Alert.alert(
          'No Face Detected',
          'We could not detect a face in the photo. Please position your face inside the guide and try again.',
        );

        return;
      }

      if (faces.length > 1) {
        Alert.alert(
          'Multiple Faces Detected',
          'Please make sure only your face is visible in the photo and try again.',
        );

        return;
      }

      setSelfieImage(photo.uri);
    } catch (error) {
      console.error(
        'Failed to capture or verify selfie:',
        error,
      );

      Alert.alert(
        'Face Verification Failed',
        'We could not verify your selfie. Please make sure your face is clearly visible and try again.',
      );
    } finally {
      setCapturing(false);
    }
  }

  function handleRetake() {
    setSelfieImage(null);
  }

  async function handleUseSelfie() {
    const user = getCurrentUser();

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!selfieImage) {
      return;
    }

    let selfiePath: string | null = null;

    try {
      setUploading(true);

      selfiePath =
        await uploadFaceVerification(
          user.uid,
          selfieImage,
        );

      await saveFaceVerificationDocument(
        user.uid,
        selfiePath,
      );

      Alert.alert(
        'Face Verification Complete',
        'Your selfie has been uploaded successfully.',
        [
          {
            text: 'Continue',
            onPress: () => {
              router.replace(
                '/vehicle-information',
              );
            },
          },
        ],
      );
    } catch (error) {
      console.error(
        'Failed to upload face verification:',
        error,
      );

      if (selfiePath) {
        try {
          await deleteRiderDocument(
            selfiePath,
          );
        } catch (cleanupError) {
          console.error(
            'Failed to clean up selfie:',
            cleanupError,
          );
        }
      }

      Alert.alert(
        'Upload Failed',
        'We could not upload your selfie. Please check your connection and try again.',
      );
    } finally {
      setUploading(false);
    }
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>
          Preparing camera...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>
          Camera Permission Required
        </Text>

        <Text style={styles.description}>
          BasuraGo needs access to your front
          camera to complete face verification.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={requestPermission}
        >
          <Text style={styles.primaryButtonText}>
            Allow Camera
          </Text>
        </Pressable>
      </View>
    );
  }

  if (selfieImage) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.stepText}>
            FACE VERIFICATION
          </Text>

          <Text style={styles.title}>
            Review Your Selfie
          </Text>

          <Text style={styles.description}>
            Make sure your face is clearly visible
            before continuing.
          </Text>
        </View>

        <View style={styles.previewFrame}>
          <Image
            source={{ uri: selfieImage }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.bottomContainer}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleUseSelfie}
            disabled={uploading}
          >
            <Text style={styles.primaryButtonText}>
              {uploading
                ? 'Uploading...'
                : 'Use This Selfie'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={handleRetake}
            disabled={uploading}
          >
            <Text style={styles.secondaryButtonText}>
              Retake
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepText}>
          FACE VERIFICATION
        </Text>

        <Text style={styles.title}>
          Take a Selfie
        </Text>

        <Text style={styles.description}>
          Position your face inside the guide and
          make sure you are in a well-lit area.
        </Text>
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={() =>
            setCameraReady(true)
          }
          mute
        />

        <View
          pointerEvents="none"
          style={styles.faceGuideContainer}
        >
          <View style={styles.faceGuide} />
        </View>
      </View>

      <View style={styles.bottomContainer}>
        <Text style={styles.helperText}>
          Look directly at the camera and keep
          your face clearly visible.
        </Text>

        <Pressable
          style={[
            styles.captureButton,
            (!cameraReady || capturing) &&
              styles.captureButtonDisabled,
          ]}
          onPress={handleCapture}
          disabled={
            !cameraReady || capturing
          }
        >
          <View style={styles.captureButtonInner}>
            <Text style={styles.captureButtonText}>
              {capturing
                ? 'Capturing...'
                : 'Capture Selfie'}
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },

  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },

  stepText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 10,
  },

  description: {
    fontSize: 15,
    lineHeight: 22,
    color: '#666',
    textAlign: 'center',
  },

  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111',
  },

  camera: {
    flex: 1,
  },

  faceGuideContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },

  faceGuide: {
    width: 230,
    height: 300,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 150,
  },

  bottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 32,
    alignItems: 'center',
  },

  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
  },

  captureButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  captureButtonDisabled: {
    opacity: 0.5,
  },

  captureButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  captureButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  primaryButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  secondaryButton: {
    width: '100%',
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
    justifyContent: 'center',
  },

  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },

  previewFrame: {
    width: 230,
    height: 300,
    alignSelf: 'center',
    borderRadius: 115,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },

  previewImage: {
    width: '100%',
    height: '100%',
  },

  loadingText: {
    fontSize: 16,
    color: '#555',
  },
});