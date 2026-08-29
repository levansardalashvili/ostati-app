import { supabase } from './supabaseClient';

export type UserMediaKind = 'certificate' | 'portfolio' | 'rating' | 'profile' | 'chat';

export interface StorageService {
  // Supabase Storage-ის რეალური ატვირთვა (#61, "Storage ეტაპი A" —
  // job post-ის ფოტოები, `job-photos` bucket). ლოკალური ფაილის URI-დან
  // (expo-image-picker-ის შედეგი) აბრუნებს საჯარო URL-ს.
  uploadJobPhoto(uid: string, localUri: string): Promise<string>;

  // "Storage ეტაპი B" (#62) — Provider-ის სერთიფიკატები/ნამუშევრები,
  // RatingScreen-ის დასრულების ფოტოები, პროფილის ფოტო (#65) და ჩატის
  // სურათები (#68) — ყველა საერთო `user-media` bucket-ში, `kind`-ის
  // მიხედვით ცალკე "საქაღალდით" (`{kind}/{uid}/...`).
  uploadUserMedia(uid: string, localUri: string, kind: UserMediaKind): Promise<string>;
}

async function uploadToBucket(bucket: string, path: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const blob = await response.blob();
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg' });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function extOf(localUri: string): string {
  return localUri.split('.').pop()?.split('?')[0] || 'jpg';
}

export const storageService: StorageService = {
  async uploadJobPhoto(uid, localUri) {
    const path = `${uid}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${extOf(localUri)}`;
    return uploadToBucket('job-photos', path, localUri);
  },
  async uploadUserMedia(uid, localUri, kind) {
    const path = `${kind}/${uid}/${Date.now()}-${Math.round(Math.random() * 1e6)}.${extOf(localUri)}`;
    return uploadToBucket('user-media', path, localUri);
  },
};
