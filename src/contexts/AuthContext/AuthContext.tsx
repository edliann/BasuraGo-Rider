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
  authPersistenceReady,
} from '../../services/firebase/firebase';

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
  riderStatus: Rider['status'] | null;
  application: RiderApplication | null;
  authInitializationFailed: boolean;
  authorizationLoadFailed: boolean;
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

  const [riderStatus, setRiderStatus] =
    useState<Rider['status'] | null>(null);

  const [application, setApplication] =
    useState<RiderApplication | null>(null);

  const [authorizationLoadFailed, setAuthorizationLoadFailed] =
    useState(false);

  const [authInitializationFailed, setAuthInitializationFailed] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let isActive = true;
    let unsubscribe: () => void = () => {};

    void authPersistenceReady
      .then(() => {
        if (!isActive) return;

        unsubscribe = onAuthStateChanged(
          auth,
          async (currentUser) => {
            setLoading(true);
            setAuthorizationLoadFailed(false);

            console.log('AUTH STATE:', {
              uid: currentUser?.uid ?? null,
              email: currentUser?.email ?? null,
              isAnonymous: currentUser?.isAnonymous ?? null,
            });

            if (!currentUser) {
              setUser(null);
              setRider(null);
              setRiderStatus(null);
              setApplication(null);
              setAuthorizationLoadFailed(false);
              setLoading(false);
              return;
            }

            try {
              setUser(currentUser);

              console.log('AUTH UID:', currentUser.uid);

              let riderProfile: Rider | null = null;

              try {
                riderProfile = await getRider(currentUser.uid);
                setRiderStatus(riderProfile?.status ?? null);
                console.log('GET RIDER SUCCESS:', riderProfile);
              } catch (error) {
                setRiderStatus(null);
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
                setAuthorizationLoadFailed(true);
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
              setRiderStatus(null);
              setApplication(null);
              setAuthorizationLoadFailed(true);
            } finally {
              setLoading(false);
            }
          },
        );
      })
      .catch((error: unknown) => {
        console.error(
          'Unable to initialize persistent Rider authentication:',
          error,
        );
        if (isActive) {
          setAuthInitializationFailed(true);
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        rider,
        riderStatus,
        application,
        authInitializationFailed,
        authorizationLoadFailed,
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
