import {
  deleteObject,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';

import {
  doc,
  getFirestore,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

import app, {
  storage,
} from '../firebase';

import { getCurrentUser } from '../../firebase/auth/auth.services';

const db = getFirestore(app);

export type RiderDocumentType =
  | 'government-id'
  | 'drivers-license'
  | 'face-verification';

export type RiderDocumentSide =
  | 'front'
  | 'back';

interface UploadRiderDocumentOptions {
  riderId: string;
  documentType: RiderDocumentType;
  uri: string;
  side?: RiderDocumentSide;
}

function getFileExtension(uri: string): string {
  const cleanUri = uri.split('?')[0];
  const extension = cleanUri.split('.').pop()?.toLowerCase();

  if (!extension || extension.length > 5) {
    return 'jpg';
  }

  return extension;
}

function buildDocumentPath(
  riderId: string,
  documentType: RiderDocumentType,
  extension: string,
  side?: RiderDocumentSide,
): string {
  const fileName = side
    ? `${side}.${extension}`
    : `selfie.${extension}`;

  return `${riderId}/${documentType}/${fileName}`;
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(
      'Failed to read the selected image.',
    );
  }

  return await response.blob();
}

export async function uploadRiderDocument({
  riderId,
  documentType,
  uri,
  side,
}: UploadRiderDocumentOptions): Promise<string> {
  const user = getCurrentUser();

  if (!user) {
    throw new Error('No Firebase user is signed in.');
  }

  if (user.uid !== riderId) {
    throw new Error(
      'You are not authorized to upload this document.',
    );
  }

  const extension = getFileExtension(uri);

  const filePath = buildDocumentPath(
    riderId,
    documentType,
    extension,
    side,
  );

  const file = await uriToBlob(uri);

  console.log('DOCUMENT STORAGE MODE:', {
    __DEV__,
    riderId,
    filePath,
  });

  if (__DEV__) {
    const storageRef = ref(
      storage,
      filePath,
    );

    await uploadBytes(storageRef, file, {
      contentType:
        file.type || 'image/jpeg',
    });
  } else {
    const { supabase } = await import(
      '../../supabase/supabase'
    );

    const { error } =
      await supabase.storage
        .from('rider-documents')
        .upload(filePath, file, {
          contentType:
            file.type || 'image/jpeg',
          upsert: true,
        });

    if (error) {
      throw error;
    }
  }

  return filePath;
}

export async function uploadGovernmentId(
  riderId: string,
  uri: string,
  side: RiderDocumentSide,
): Promise<string> {
  return uploadRiderDocument({
    riderId,
    documentType: 'government-id',
    uri,
    side,
  });
}

export async function uploadDriversLicense(
  riderId: string,
  uri: string,
  side: RiderDocumentSide,
): Promise<string> {
  return uploadRiderDocument({
    riderId,
    documentType: 'drivers-license',
    uri,
    side,
  });
}

export async function uploadFaceVerification(
  riderId: string,
  uri: string,
): Promise<string> {
  return uploadRiderDocument({
    riderId,
    documentType: 'face-verification',
    uri,
  });
}

export async function deleteRiderDocument(
  filePath: string,
): Promise<void> {
  const user = getCurrentUser();

  if (!user) {
    throw new Error(
      'No Firebase user is signed in.',
    );
  }

  if (!filePath.startsWith(`${user.uid}/`)) {
    throw new Error(
      'You are not authorized to delete this document.',
    );
  }

  if (__DEV__) {
    const storageRef = ref(
      storage,
      filePath,
    );

    await deleteObject(storageRef);
  } else {
    const { supabase } = await import(
      '../../supabase/supabase'
    );

    const { error } =
      await supabase.storage
        .from('rider-documents')
        .remove([filePath]);

    if (error) {
      throw error;
    }
  }
}

export interface GovernmentIdDocuments {
  frontPath: string;
  backPath: string;
}

export async function saveGovernmentIdDocuments(
  riderId: string,
  documents: GovernmentIdDocuments,
): Promise<void> {
  const applicationRef = doc(
    db,
    'riderApplications',
    riderId,
  );

  await updateDoc(applicationRef, {
    'documents.governmentId': documents,
    identityDocumentCompleted: true,
    updatedAt: serverTimestamp(),
  });
}

export interface DriversLicenseDocuments {
  frontPath: string;
  backPath: string;
}

export async function saveDriversLicenseDocuments(
  riderId: string,
  documents: DriversLicenseDocuments,
): Promise<void> {
  const applicationRef = doc(
    db,
    'riderApplications',
    riderId,
  );

  await updateDoc(applicationRef, {
    'documents.driversLicense': documents,
    driversLicenseCompleted: true,
    updatedAt: serverTimestamp(),
  });
}

export async function saveFaceVerificationDocument(
  riderId: string,
  selfiePath: string,
): Promise<void> {
  const applicationRef = doc(
    db,
    'riderApplications',
    riderId,
  );

  await updateDoc(applicationRef, {
    'documents.faceVerification': {
      selfiePath,
    },
    faceVerificationCompleted: true,
    updatedAt: serverTimestamp(),
  });
}