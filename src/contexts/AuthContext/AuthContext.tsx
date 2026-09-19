import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

import {
  auth,
} from '../../services/firebase/auth/auth.services';

import {
  getRider,
} from '../../services/firebase/riders/riders.services';

import {
  getRiderApplication,
} from '../../services/firebase/riders/verification.services';

import type {
  Rider,
} from '../../services/firebase/riders/riders.types';

import type {
  RiderApplication,
} from '../../services/firebase/riders/verification.types';

interface AuthContextValue {
  user: User | null;
  rider: Rider | null;
  application: RiderApplication | null;
  loading: boolean;
  isRider: boolean;
}

const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<User | null>(null);

  const [rider, setRider] =
    useState<Rider | null>(null);

  const [application, setApplication] =
    useState<RiderApplication | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {
          setLoading(true);

          console.log('AUTH STATE:', {
            uid: currentUser?.uid ?? null,
            email: currentUser?.email ?? null,
            isAnonymous: currentUser?.isAnonymous ?? null,
          });

          if (!currentUser) {
            setUser(null);
            setRider(null);
            setApplication(null);
            setLoading(false);
            return;
          }

          try {
            setUser(currentUser);

            console.log('AUTH UID:', currentUser.uid);

            let riderProfile: Rider | null = null;

            try {
              riderProfile = await getRider(currentUser.uid);
              console.log('GET RIDER SUCCESS:', riderProfile);
            } catch (error) {
              console.error('GET RIDER FAILED:', error);
            }

            if (
              riderProfile &&
              riderProfile.status === 'active'
            ) {
              setRider(riderProfile);
            } else {
              setRider(null);
            }

            let riderApplication: RiderApplication | null = null;

            try {
              riderApplication =
                await getRiderApplication(currentUser.uid);

              console.log(
                'GET APPLICATION SUCCESS:',
                riderApplication,
              );
            } catch (error) {
              console.error(
                'GET APPLICATION FAILED:',
                error,
              );
            }

            setApplication(riderApplication);
          } catch (error) {
            console.error(
              'Failed to load rider authentication data:',
              error,
            );

            setRider(null);
            setApplication(null);
          } finally {
            setLoading(false);
          }
        },
      );

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        rider,
        application,
        loading,
        isRider: rider !== null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used inside AuthProvider',
    );
  }

  return context;
}