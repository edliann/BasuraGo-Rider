import {
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

import { refreshProvisionedUserToken } from '../auth/provisionedToken';
import firebaseApp, { auth } from '../firebase';

export interface GetRiderInvitationInput {
  invitationId: string;
  invitationToken: string;
}

export interface GetRiderInvitationResult {
  invitationId: string;
  email: string;
  phoneNumber: string;
  expiresAt: string;
}

export interface CreateRiderAccountInput {
  invitationId: string;
  invitationToken: string;
  fullName: string;
  password: string;
}

export interface CompleteRiderInvitationInput {
  invitationId: string;
  invitationToken: string;
  fullName: string;
}

export interface CreateRiderAccountResult {
  riderId: string;
  email: string;
  phoneNumber: string;
}

const functions = getFunctions(firebaseApp);

const getRiderInvitationFunction =
  httpsCallable<
    GetRiderInvitationInput,
    GetRiderInvitationResult
  >(
    functions,
    'getRiderInvitation',
  );

const createRiderAccountFunction =
  httpsCallable<
    CreateRiderAccountInput,
    CreateRiderAccountResult
  >(
    functions,
    'createRiderAccountFromInvitation',
  );

const completeRiderInvitationFunction =
  httpsCallable<
    CompleteRiderInvitationInput,
    CreateRiderAccountResult
  >(
    functions,
    'completeRiderInvitationFunction',
  );

export async function getRiderInvitation(
  invitationId: string,
  invitationToken: string,
): Promise<GetRiderInvitationResult> {
  const result =
    await getRiderInvitationFunction({
      invitationId:
        invitationId.trim(),

      invitationToken:
        invitationToken.trim(),
    });

  return result.data;
}

export async function createRiderAccountFromInvitation(
  input: CreateRiderAccountInput,
): Promise<CreateRiderAccountResult> {
  const result =
    await createRiderAccountFunction({
      invitationId:
        input.invitationId.trim(),

      invitationToken:
        input.invitationToken.trim(),

      fullName:
        input.fullName.trim(),

      password:
        input.password,
    });

  return result.data;
}

export async function completeRiderInvitation(
  input: CompleteRiderInvitationInput,
): Promise<CreateRiderAccountResult> {
  const result = await completeRiderInvitationFunction({
    invitationId: input.invitationId.trim(),
    invitationToken: input.invitationToken.trim(),
    fullName: input.fullName.trim(),
  });

  await refreshProvisionedUserToken(
    auth.currentUser,
    result.data.riderId,
  );

  return result.data;
}
