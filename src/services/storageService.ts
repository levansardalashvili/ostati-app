import { supabase } from './supabaseClient';

export type UserMediaKind =
  | 'certificate'
  | 'portfolio'
  | 'profile';

const PRIVATE_BUCKET = 'private-media';
const PRIVATE_PREFIX = 'private-media://';

export interface StorageService {
  // Public job photos — existing behavior.
  uploadJobPhoto(uid: string, localUri: string): Promise<string>;

  // Public Provider media.
  uploadUserMedia(
    uid: string,
    localUri: string,
    kind: UserMediaKind,
  ): Promise<string>;

  // Private chat image.
  uploadPrivateChatImage(
    customerId: string,
    providerId: string,
    uploaderId: string,
    localUri: string,
  ): Promise<string>;

  // Private completion/rating image.
  uploadPrivateCompletionPhoto(
    jobId: string,
    uploaderId: string,
    localUri: string,
  ): Promise<string>;

  // Converts private-media://... into a temporary signed URL.
  // Normal http/public URLs pass through unchanged.
  getDisplayUrl(reference: string): Promise<string>;

  isPrivateReference(reference?: string | null): boolean;
}

function extOf(localUri: string): string {
  const withoutQuery = localUri.split('?')[0];
  const ext = withoutQuery.split('.').pop()?.toLowerCase();

  if (!ext || ext.length > 5) {
    return 'jpg';
  }

  return ext;
}

function createFilename(localUri: string): string {
  return `${Date.now()}-${Math.round(
    Math.random() * 1_000_000,
  )}.${extOf(localUri)}`;
}

async function localUriToBlob(localUri: string): Promise<Blob> {
  const response = await fetch(localUri);

  if (!response.ok) {
    throw new Error('ფაილის წაკითხვა ვერ მოხერხდა');
  }

  return response.blob();
}

async function uploadPublic(
  bucket: string,
  path: string,
  localUri: string,
): Promise<string> {
  const blob = await localUriToBlob(localUri);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

async function uploadPrivate(
  path: string,
  localUri: string,
): Promise<string> {
  const blob = await localUriToBlob(localUri);

  const { error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  // IMPORTANT:
  // DB stores stable Storage reference, NOT temporary signed URL.
  return `${PRIVATE_PREFIX}${path}`;
}

function privatePathFromReference(reference: string): string | null {
  if (!reference.startsWith(PRIVATE_PREFIX)) {
    return null;
  }

  const path = reference.slice(PRIVATE_PREFIX.length);

  return path.length > 0 ? path : null;
}

export const storageService: StorageService = {
  async uploadJobPhoto(uid, localUri) {
    const path = `${uid}/${createFilename(localUri)}`;

    return uploadPublic(
      'job-photos',
      path,
      localUri,
    );
  },

  async uploadUserMedia(uid, localUri, kind) {
    const path = `${kind}/${uid}/${createFilename(localUri)}`;

    return uploadPublic(
      'user-media',
      path,
      localUri,
    );
  },

  async uploadPrivateChatImage(
    customerId,
    providerId,
    uploaderId,
    localUri,
  ) {
    const path =
      `chat/${customerId}/${providerId}/${uploaderId}/` +
      createFilename(localUri);

    return uploadPrivate(path, localUri);
  },

  async uploadPrivateCompletionPhoto(
    jobId,
    uploaderId,
    localUri,
  ) {
    const path =
      `completion/${jobId}/${uploaderId}/` +
      createFilename(localUri);

    return uploadPrivate(path, localUri);
  },

  async getDisplayUrl(reference) {
    const privatePath = privatePathFromReference(reference);

    // Legacy/current public URL.
    if (!privatePath) {
      return reference;
    }

    const { data, error } = await supabase.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(
        privatePath,
        60 * 15, // 15 minutes
      );

    if (error) {
      throw error;
    }

    if (!data?.signedUrl) {
      throw new Error('სურათის დროებითი ბმული ვერ შეიქმნა');
    }

    return data.signedUrl;
  },

  isPrivateReference(reference) {
    return Boolean(
      reference &&
        reference.startsWith(PRIVATE_PREFIX),
    );
  },
};
