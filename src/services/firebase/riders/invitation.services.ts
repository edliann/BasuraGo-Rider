import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
} from 'firebase/functions';

import app from '../firebase';

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

export interface CreateRiderAccountResult {
  riderId: string;
  email: string;
  phoneNumber: string;
}

const functions = getFunctions(app);

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