import { Stack, router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  getCurrentUser,
} from '../../services/firebase/auth/auth.services';

import {
  getRiderApplication,
} from '../../services/firebase/riders/verification.services';

import {
  doc,
  getDoc,
  getFirestore,
} from 'firebase/firestore';

import app from '../../services/firebase/firebase';

import type {
  RiderApplication,
} from '../../services/firebase/riders/verification.types';

const db = getFirestore(app);

export default function RiderLayout() {
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);

  const [application, setApplication] =
    useState<RiderApplication | null>(null);

  const [isExistingActiveRider, setIsExistingActiveRider] =
    useState(false);

  useEffect(() => {
    async function checkRiderAccess() {
      try {
        const user = getCurrentUser();

        console.log('RIDER AUTH USER:', {
          uid: user?.uid,
          email: user?.email,
        });

        if (!user) {
          router.replace('/login');
          return;
        }

        /*
         * First check the new verification system.
         */
        const riderApplication =
          await getRiderApplication(user.uid);

        if (riderApplication) {
          setApplication(riderApplication);
          return;
        }

        /*
         * Backward compatibility:
         * Existing riders created before the verification
         * system may already have an active rider document.
         */
        const riderRef = doc(
          db,
          'riders',
          user.uid,
        );

        const riderSnapshot =
          await getDoc(riderRef);

        if (riderSnapshot.exists()) {
          const riderData =
            riderSnapshot.data();

          if (riderData.status === 'active') {
            setIsExistingActiveRider(true);
            return;
          }
        }

        /*
         * No application and no active rider record.
         */
        router.replace('/access-denied');
      } catch (error) {
        console.error(
          'Failed to check rider access:',
          error,
        );

        router.replace('/access-denied');
      } finally {
        setLoading(false);
      }
    }

    checkRiderAccess();
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }

    /*
     * Existing active riders can use the operational
     * Rider app normally.
     */
    if (isExistingActiveRider) {
      return;
    }

    /*
     * New riders must have an application.
     */
    if (!application) {
      return;
    }

    const isVerificationFlow =
      pathname === '/verification' ||
      pathname === '/government-id' ||
      pathname === '/drivers-license' ||
      pathname === '/face-verification' ||
      pathname === '/vehicle-information' ||
      pathname === '/review-application';


    const isApproved =
      application.status === 'approved';

    /*
     * Approved applicants can use the Rider app.
     */
    if (isApproved) {
      return;
    }

    /*
     * Unapproved applicants may only access
     * the verification screen.
     */
    if (!isVerificationFlow) {
    router.replace('/verification');
    }
  }, [
    loading,
    application,
    isExistingActiveRider,
    pathname,
  ]);

  if (loading) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}