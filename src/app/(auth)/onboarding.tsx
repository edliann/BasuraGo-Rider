import AsyncStorage from '@react-native-async-storage/async-storage';
import {
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
    title: 'Welcome to BasuraGo',
    description:
      'Your waste collection partner. Manage your pickups easily and efficiently.',
  },
  {
    title: 'Find & Accept Pickups',
    description:
      'View available pickups and choose the jobs that fit your route.',
  },
  {
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

    router.replace('./login');
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
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imageText}>
            {currentIndex + 1}
          </Text>
        </View>

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

  imagePlaceholder: {
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eeeeee',
    marginBottom: 48,
  },

  imageText: {
    fontSize: 48,
    fontWeight: '700',
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
    backgroundColor: '#111111',
  },

  nextText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});