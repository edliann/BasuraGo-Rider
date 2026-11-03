import AsyncStorage from '@react-native-async-storage/async-storage';
import Slide1Image from '../../../assets/onboarding/slider1.png';
import Slide2Image from '../../../assets/onboarding/slider2.png';
import Slide3Image from '../../../assets/onboarding/slider3.png';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  router,
} from 'expo-router';
import {
  useState,
} from 'react';

const slides = [
  {
    image: Slide1Image,
    title: 'Welcome to BasuraGo',
    description:
      'Your waste collection partner. Manage your pickups easily and efficiently.',
  },
  {
    image: Slide2Image,
    title: 'Find & Accept Pickups',
    description:
      'View available pickups and choose the jobs that fit your route.',
  },
  {
    image: Slide3Image,
    title: 'Complete Pickups',
    description:
      'Keep track of your assigned pickups and complete every collection with confidence.',
  },
];

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] =
    useState(0);

  const currentSlide =
    slides[currentIndex];

  const isLastSlide =
    currentIndex === slides.length - 1;

  async function finishOnboarding() {
    await AsyncStorage.setItem(
      'basurago_rider_onboarding_complete',
      'true',
    );

    router.replace('/login');
  }

  function handleNext() {
    if (isLastSlide) {
      finishOnboarding();
      return;
    }

    setCurrentIndex(
      currentIndex + 1,
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.skipButton}
        onPress={finishOnboarding}
      >
        <Text style={styles.skipText}>
          Skip
        </Text>
      </Pressable>

      <View style={styles.content}>
        <Image
          source={currentSlide.image}
          style={styles.onboardingImage}
          resizeMode="contain"
          accessibilityLabel={`Onboarding illustration ${currentIndex + 1}`}
        />

        <Text style={styles.title}>
          {currentSlide.title}
        </Text>

        <Text style={styles.description}>
          {currentSlide.description}
        </Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex &&
                  styles.activeDot,
              ]}
            />
          ))}
        </View>

        <Pressable
          style={styles.nextButton}
          onPress={handleNext}
        >
          <Text style={styles.nextText}>
            {isLastSlide
              ? 'Get Started'
              : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    padding: 8,
  },

  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  onboardingImage: {
    width: '100%',
    maxWidth: 320,
    height: 260,
    marginBottom: 24,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },

  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },

  bottom: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#cccccc',
  },

  activeDot: {
    width: 24,
  },

  nextButton: {
    height: 54,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#176744',
  },

  nextText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
