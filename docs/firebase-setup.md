# Firebase-ის დაკავშირება

პროექტი უკვე მზადაა Firebase-ისთვის (`@react-native-firebase/*` პაკეტები და Expo config plugin-ები დაყენებულია). დარჩენილია რეალური Firebase პროექტის მონაცემების მიწოდება.

## რა არის საჭირო შენგან

1. **Firebase Console**-ში ახალი პროექტის შექმნა.
2. პროექტში დაამატე ორი აპი:
   - **Android** — package name: `com.ostati.app`
   - **iOS** — Bundle ID: `com.ostati.app`
   (თუ გინდა სხვა bundle id/package name — მითხარი, შევცვლი `app.json`-ში.)
3. Console-იდან ჩამოტვირთე:
   - `google-services.json` (Android) → ჩააგდე პროექტის root-ში: `ostati-app/google-services.json`
   - `GoogleService-Info.plist` (iOS) → ჩააგდე პროექტის root-ში: `ostati-app/GoogleService-Info.plist`
   ორივე ფაილი `.gitignore`-შია — არ აიტვირთება git-ში.
4. **Authentication** → Sign-in method-ში ჩართე:
   - Email/Password
   - Google
5. **Firestore Database** — შექმენი (production mode, security rules მოგვიანებით დავამატებთ).
6. **Storage** — ჩართე (ფოტოების ატვირთვისთვის: პროფილის ფოტო, job post-ის ფოტოები).
7. **Cloud Messaging** — ავტომატურად ირთვება პროექტთან ერთად, დამატებითი Console-setup არ სჭირდება ამ ეტაპზე.

## Google Sign-In — დამატებითი ნაბიჯი

Google Sign-In-ს სჭირდება ცალკე OAuth Client ID-ები **Google Cloud Console**-ში (იგივე პროექტი, რასაც Firebase იყენებს):

- **Android OAuth Client** — სჭირდება SHA-1 fingerprint. ამას მოგცემთ მოგვიანებით, EAS Build-ის კონფიგურაციისას (`eas credentials`-ით გამოვიღებთ).
- **iOS OAuth Client** — სჭირდება Bundle ID (`com.ostati.app`).
- **Web OAuth Client** — სჭირდება `@react-native-firebase/auth`-ს Google-სთან დასაკავშირებლად (`webClientId`).

ამ ID-ების კონკრეტულ კონფიგურაციას გავივლით მაშინ, როცა Google Sign-In-ის ეკრანებს დავამატებთ კოდში.

## რას ველოდები შენგან ახლა

მხოლოდ ნაბიჯი 1-4 (Firebase პროექტის შექმნა და ორი ფაილის მოცემა). დანარჩენი (Google OAuth client-ები, security rules, Storage rules) მოგვიანებით, შესაბამის ეტაპებზე გავივლით ერთად.
