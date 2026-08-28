export type UploadedMedia = { id: number; bg: string };

export interface StorageService {
  uploadMedia(): UploadedMedia;
  deleteMedia(mediaId: number): void;
}

const PLACEHOLDER_COLORS = ['#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE'];
let nextId = 0;

// TODO: ჩანაცვლდება Firebase Storage-ის რეალური ატვირთვის ლოგიკით
// (expo-image-picker-ით არჩეული ფაილის ატვირთვა, საჯარო URL-ის დაბრუნება).
// დღეს — placeholder ფერადი მართკუთხედის დაბრუნება.
//
// შენიშვნა: `MediaUploadGrid`-ის `nextMediaItem` helper-ი (ProviderSetup/
// ProviderEditProfile/RatingScreen-ის სერთიფიკატები/portfolio/ფოტოები)
// განზრახ არ არის გადაბმული ამ სერვისზე — მისი id/ფერის ლოგიკა
// დეტერმინისტულია (index-ზე დაფუძნებული ციკლი), ამ სერვისზე გადართვა
// ვიზუალურ ქცევას შეცვლიდა (რენდომული ფერების თანმიმდევრობა). ეს სერვისი
// მხოლოდ მომავალი რეალური ატვირთვის კონტრაქტს აფიქსირებს.
export const storageService: StorageService = {
  uploadMedia: () => ({ id: ++nextId, bg: PLACEHOLDER_COLORS[nextId % PLACEHOLDER_COLORS.length] }),
  deleteMedia: () => {},
};
