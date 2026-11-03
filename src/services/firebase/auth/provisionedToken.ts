import type { User } from 'firebase/auth';

/**
 * Refreshes the token after server-side claims are provisioned.
 *
 * @param user Signed-in Firebase user to refresh.
 * @param expectedUid UID returned by the provisioning callable.
 */
export async function refreshProvisionedUserToken(
  user: Pick<User, 'uid' | 'getIdToken'> | null,
  expectedUid: string,
): Promise<void> {
  if (!user || user.uid !== expectedUid) {
    throw new Error(
      'The signed-in account changed during Rider invitation completion.',
    );
  }

  await user.getIdToken(true);
}
