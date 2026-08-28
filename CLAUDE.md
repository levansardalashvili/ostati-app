# ostati-app — პროექტის კონტექსტი

**ეს ფაილი ცოცხალი დოკუმენტია.** ყოველ ჯერზე, როცა ერთად ვიღებთ ახალ არსებით არქიტექტურულ ან პროდუქტულ გადაწყვეტილებას (ახალი Firestore collection/ველი, ახალი auth ნაკადი, დაფიქსირებული პროდუქტული წესი, ბიბლიოთეკის შეცვლა), საჭიროა კითხვა: **"განვაახლო თუ არა CLAUDE.md?"** — არ განახლდეს დუმილში და არც წვრილმან ცვლილებებზე.

## პროდუქტის არსი

მობილური marketplace (iOS + Android), რომელიც აკავშირებს **მომხმარებლებს** (სახლის სერვისის საჭიროება — სანტექნიკოსი, ელექტრიკოსი და ა.შ.) **ადგილობრივ ოსტატებთან** საქართველოში. ორი როლი: **Customer** და **Provider**, ერთ ანგარიშს ერთი როლი აქვს (role-switch მექანიზმი არ არსებობს). მთელი კომუნიკაცია აპშივეა (ჩატი), არა WhatsApp/SMS-ზე გადასვლით.

მუშავდება მარტო, საშუალო React Native გამოცდილებით. მიზანია App Store + Play Store-ზე გასვლა — ამიტომ არქიტექტურა თავიდანვე სტაბილურია, არა disposable prototype.

## წყაროები

- **`docs/design-reference/product-spec.md`** — სრული პროდუქტის სპეციფიკაცია (ეკრანები, ლოგიკა, წესები)
- **`docs/design-reference/app-states.md`** — loading/empty/error/success state-ების სტანდარტი
- **`docs/design-reference/notifications-feature.md`** — შეტყობინებების სისტემის სპეციფიკაცია
- **`docs/design-reference/theme-reference.css`** — ორიგინალი ფერების პალიტრა (Figma Make-ის web პროტოტიპიდან)
- ორიგინალი დიზაინის რეფერენსი (Figma Make-ის React web კოდი, `App.tsx`) — ვიზუალური/ინტერაქციული სიზუსტის წყარო ეკრანების აგებისას. **პრიორიტეტის წესი:** კონფლიქტისას დიზაინის რეფერენსი იმარჯვებს `product-spec.md`-ზე, გარდა სამი დაფიქსირებული წესისა (იხ. ქვემოთ).

## ტექნიკური სტეკი (საბოლოო გადაწყვეტილება)

- **Expo (React Native) + TypeScript**, `blank-typescript` ტემპლეიტი (არა Expo Router — React Navigation)
- **React Navigation** — `@react-navigation/native-stack` (root) + `@react-navigation/bottom-tabs` (Customer/Provider Home-ის ირგვლივ, იხ. "ნავიგაციის არქიტექტურა")
- **Firebase** `@react-native-firebase/*` (native მოდულები, არა JS SDK, push notification-ების საიმედოობის გამო): `app`, `auth`, `firestore`, `storage`, `messaging`
- **`@react-native-google-signin/google-signin`** — Google Sign-In
- **EAS Build + dev client** — Expo Go არ გამოიყენება (native მოდულების გამო)
- **`lucide-react-native`** (+ `react-native-svg` peer dep) — აიქონები; დიზაინის რეფერენსი `lucide-react`-ს იყენებდა, ეს ზუსტი RN შესატყვისია
- **`expo-linear-gradient`** — გრადიენტული ბარათებისთვის (CTA ბარათები, სტატისტიკის ბარათი)
- **`metro.config.js`**-ში დამატებულია `mjs` sourceExt — `lucide-react-native`-ის ESM icon barrel-ის Metro-ს resolve-ისთვის საჭირო

## Firebase Auth მეთოდი

**მხოლოდ Email/Password + Google Sign-In.** არა ტელეფონის ნომერი, არა SMS/OTP ვერიფიკაცია — ეს წესი აშკარად ამორიცხულია დიზაინის რეფერენსიდან (`create-account-form.md`).

- რეგისტრაცია: ელფოსტა, **მისამართი** (customer-ისთვისაც — დიზაინის რეფერენსის დამატება `product-spec.md`-ის საწყის აღწერაზე, პრიორიტეტის წესით), პაროლი+დადასტურება. **სახელი/გვარი: Customer-ისთვის ორ ცალკე ველად** (`სახელი`, `გვარი`) — მომხმარებლის აშკარა მოთხოვნით override-ავს ზიპის ერთიან "სახელი და გვარი" ველს; Provider-ისთვის ზიპის მიხედვით ერთი ველი უცვლელად რჩება (`RegisterScreen.tsx`-ში `role`-ზე დამოკიდებული branch).
- Google რეგისტრაცია: სახელი/ელფოსტა/ფოტო წამოღებულია Google-იდან, მომხმარებელი მხოლოდ აკლებს მისამართს (`GoogleCompleteScreen`). Customer-ისთვის mock Google-ის სახელი იყოფა firstName/lastName-ად პირველი space-ით.
- როლი (Customer/Provider) აირჩევა registration-მდე (`RoleSelectScreen`) და გადაეცემა navigation param-ად Register/GoogleComplete ეკრანებზე — **Login ეკრანს როლი არ სჭირდება** (რეალურ ანგარიშში როლი უკვე განსაზღვრულია, Firestore-დან უნდა წამოვიდეს ავტორიზაციის შემდეგ)
- **ჯერ არ არის დაკავშირებული რეალურ Firebase-თან** — ყველა submit handler-ს აქვს `// TODO: Firebase Auth ...` კომენტარი და მუშავდება მხოლოდ ლოკალური state/loading simulation-ით. Firebase პროექტი უკვე შექმნილია (`google-services.json` placeholder-ის ნაცვლად რეალურით ჩანაცვლებულია), მაგრამ auth/firestore/storage კოდი ჯერ არ არის დაწერილი.

## Firestore Collections (დაგეგმილი სქემა, ჯერ არ არის implementiert)

`product-spec.md`-ის ტექნიკური მონიშვნიდან:

- `users`
- `providerProfiles`
- `jobPosts`
- `jobResponses`
- `conversations`
- `messages`
- `reviews`

საბოლოო ველების სტრუქტურა კოდში ჩამოყალიბდება, როცა რეალურ Firebase-თან დაკავშირებას დავიწყებთ.

## მთავარი არქიტექტურული/პროდუქტული გადაწყვეტილებები

1. **კატეგორიის ფილტრი Browse-ზე — მრავალარჩევანი (multi-select).** დაფიქსირებული წესი `product-spec.md`-დან, ზედმეტდება დიზაინის რეფერენსის (single-select) ვერსიაზე. Implementiert `CustomerHomeScreen`-ში `Set<string>` state-ით.
2. **ფასის შეთანხმება ჩატში — სტრუქტურირებული ბარათი**, არა თავისუფალი ტექსტი. Provider აგზავნის რიცხვს ცალკე card-ის სახით (`ChatConversationScreen`-ის კომპოზერში ცალკე Wallet ღილაკით, provider-ისთვის მხოლოდ), Customer ეთანხმება/უარყოფს პირდაპირ ბარათიდან (`დათანხმება`/`უარყოფა` ღილაკები, ჩანს მხოლოდ `role==='customer' && !isMe && offerStatus==='pending'`-ზე). **D3 Implementiert** — ზიპში რეფერენსი არ არსებობდა, დიზაინი თავიდან შემუშავდა (`ChatMsg`-ის ახალი `type: 'offer'`, `src/data/mockChats.ts`). დათანხმებული ფასის შენახვა job-ის ჩანაწერში (Firestore) **ჯერ არ არის დაკავშირებული** — ამჟამად მხოლოდ ჩატის ლოკალურ state-ში ცვლის სტატუსს (`TODO: Firestore`-ის კომენტარი `respondToOffer`-ში).
3. **ფოტოს ატვირთვის ლიმიტი job post-ში — 1-3 ფოტო**, არა 5 (დიზაინის რეფერენსზე override).
4. **ერთ ანგარიშს ერთი როლი.** არა role-switch UI.
5. **ერთი აქცენტის ფერი მთელ აპში** (`#2563EB`) — დიზაინის რეფერენსში RoleSelect-ის ბარათებს ჰქონდა ლურჯი/იისფერი split, მაგრამ ეს override-ავს `product-spec.md`-ის ზოგადი დიზაინის წესით (`src/theme/colors.ts`).
6. **Job-ის სტატუსების ციკლი:** მომლოდინე → დადასტურებულია → დასრულების დადასტურების მოთხოვნა → დახურული + შეფასება. **Implementiert** — `CustomerJobDetailScreen`-ს აქვს სრული დასრულების/პრობლემის/შეფასების flow (ამბერ card "სამუშაო დასრულდა?" → celebration BottomSheet → `RatingScreen`), ზუსტად ზიპის App.tsx-ის CustomerJobDetail-ის მიხედვით. `ProviderJobDetailScreen`-ს დაემატა `completed` mode (მიღებული შეფასების ჩვენებით).
7. **ტელეფონის ნომერი/საკონტაქტო ინფო არასდროს ჩანს ავტომატურად** — მხოლოდ ორმხრივი გადაწყვეტილებით ჩატში.
8. **Provider-ის სპეციალობის არჩევა — dropdown + "სხვა", ერთი არჩევანი.** მომხმარებლის დაფიქსირებული გადაწყვეტილებით override-ავს ზიპის მრავალარჩევანიან chip-ებს. გაზიარებული კომპონენტი `src/components/SpecialtyPickerField.tsx` (ველი + BottomSheet სია + "სხვა"-ს თავისუფალი ტექსტი) — გამოიყენება `ProviderSetupScreen`-სა და `ProviderEditProfileScreen`-ში.
9. **Provider-ის სამუშაო რაიონები — მთელი საქართველოს მხარეები**, არა მხოლოდ თბილისის რაიონები. `src/data/georgiaRegions.ts` (11 მხარე, თბილისის რაიონები `districts.ts`-იდან საერთო წყაროა), გაზიარებული accordion კომპონენტი `src/components/RegionAreaAccordion.tsx` (მხარე იშლება, პირველი პუნქტი "ყველას მონიშვნა", მერე ცალკეული რაიონები) — გამოიყენება რეგისტრაციის `RegionAreaPickerScreen`-შიც (callback-ის საშუალებით, ცალკე root-stack ეკრანი) და პროფილის `ProviderServiceAreasScreen`-შიც (პირდაპირ ჩაშენებული).
10. **სერვისის კატეგორიები — 15 კატეგორია** (`src/data/categories.ts`), მომხმარებლის მიწოდებული სრული სია. Customer Home-ის "სერვისები" სექცია აღარ არის სქროლადი chip-ების რიგი — ახლა 2×2 ბადეა: **3 ყველაზე მოთხოვნადი** (`TOP_CATEGORY_IDS` — სანტექნიკა/ელექტროობა/დასუფთავება) + **"ყველა სერვისი"** ღილაკი. ეს ღილაკი ხსნის `CustomerCategoriesScreen`-ს (ყველა 15 კატეგორიის ბადე), საიდანაც კონკრეტულ კატეგორიაზე დაჭერით იხსნება `CustomerCategoryScreen` (მხოლოდ იმ კატეგორიის ოსტატები). Top-3 ღილაკებზე დაჭერა კვლავ inline მრავალარჩევანიან ფილტრს ამატებს Home-ის სიაში (გადაწყვეტილება #1 დაცულია).
11. **`CustomerCategory`-ის ორიგინალი ზიპის ვერსია იყო ბაგიანი** — `PROVIDERS.map()`-ს იყენებდა `.filter(category)`-ის გარეშე (ყველა ოსტატს უჩვენებდა, კატეგორიის მიუხედავად) და თავად ზიპშივე არსად არ იყო რეალურად გამოძახებული (orphan screen). ჩვენთან გასწორებულია (რეალურად filter-ავს) და დაკავშირებულია "ყველა სერვისი" ნაკადში.
12. **Global state პირველად ჩნდება: `CustomerProfileContext`** (`src/state/CustomerProfileContext.tsx`, App.tsx-ში `RootNavigator`-ის გარშემო). ინახავს `firstName/lastName/email/defaultAddress`-ს — რეგისტრაცია (ორივე გზა) წერს, `CustomerHome`/`CustomerProfile`/`CustomerEditProfile` კითხულობენ/ცვლიან, `PostJobScreen`-ის მისამართის ველი მხოლოდ **წინასწარ ივსება** `defaultAddress`-ით mount-ზე და **არასდროს არ წერს უკან** — job-ისთვის შეცვლილი მისამართი (მაგ. მეგობრის სახლისთვის) პროფილის default-ს არ ეხება.

## ვიზუალური დიზაინის სისტემა

- ფერები: `src/theme/colors.ts` (light bg, ერთი აქცენტი, სემანტიკური success/warning/danger)
- Radius/spacing/typography ტოკენები: `src/theme/index.ts`
- Card radius: 12-16px (`radius.lg` = 16)
- Loading/empty/error/success state-ების ვიზუალური ენა: `docs/design-reference/app-states.md`-ის მიხედვით (skeleton-ები, არა spinner-ები; inline loading ღილაკებში)

## ნავიგაციის არქიტექტურა

Root არის ერთი `native-stack` (`src/navigation/RootNavigator.tsx`), ტიპიზირებული `RootStackParamList`-ით (`src/navigation/types.ts`). Onboarding-იდან Home-ზე გადასვლისას `navigation.reset()` გამოიყენება (არა `navigate`/`replace`) — მომხმარებელს არ შეუძლია უკან დაბრუნება რეგისტრაციაში ავტორიზაციის შემდეგ.

**Bottom Tabs** (`CustomerTabs`/`ProviderTabs`, `src/navigation/CustomerTabs.tsx` და `ProviderTabs.tsx`) — თითო ცალკე Tab Navigator როლის მიხედვით (არა ერთი საერთო + role param, იმავე პრინციპით რითიც CustomerHome/ProviderHome ცალკეა). ორივე ჩალაგებულია RootStack-ის **იგივე** `"CustomerHome"`/`"ProviderHome"` route-ების ქვეშ — ეს route-ის სახელები არ შეცვლილა განზრახ, რომ ყველა არსებული `navigation.reset({routes:[{name:'CustomerHome'}]})` გამოძახება უცვლელად იმუშაოს. თითო ტაბ-ნავიგატორს 3 ტაბი აქვს: **Home** (CustomerHomeScreen/ProviderHomeScreen), **Chats** (`ChatsListScreen`, role prop-ით გადაცემული children render prop-ის საშუალებით — ერთი საერთო კომპონენტი ორივე როლისთვის), **Profile** (`ProviderProfileScreen`/`CustomerProfileScreen` — E1/E2, `role`-ის მიხედვით ცალკე კომპონენტი თითო ტაბ-ნავიგატორში).

Tab-ის შიგნით მდებარე ეკრანების (`CustomerHomeScreen` და ა.შ.) navigation prop ტიპია `CompositeScreenProps<BottomTabScreenProps<...>, NativeStackScreenProps<RootStackParamList>>` — საჭიროა root-stack route-ებზე (`PostJob`, `ChatConversation` და ა.შ.) ნავიგაციისთვის ტაბის შიგნიდან. **Parent stack-ის action-ები** (მაგ. `reset`) ტაბის შიგნიდან უნდა გამოიძახოს `navigation.getParent()?.reset(...)`-ით, არა პირდაპირ `navigation.reset(...)`-ით — TypeScript-ის composite ტიპი `reset`-ს ტაბ-navigator-ზე resolve-ავს.

`ChatConversation`, `ProviderJobDetail`, `CustomerJobDetail`, `PostJob` — root-stack screen-ებია (ტაბების გარეთ, ტაბ-ბარს ფარავენ push-ისას), არა tab-ის შიგნით ჩალაგებული.

## პროექტის სტრუქტურა

```
src/
  components/   # საერთო UI კომპონენტები (Button, TextField, Chip, Avatar, StatusPill,
                # BottomSheet, InlineBanner, RegionAreaAccordion, SpecialtyPickerField, ...)
  data/         # mock მონაცემები (categories — 15 კატეგორია, districts, georgiaRegions,
                # specialties, mockHomeData, mockChats, mockNotifications, mockReviews)
                # — ჩანაცვლდება Firestore queries-ით
  navigation/   # RootNavigator, CustomerTabs, ProviderTabs + ტიპები
  screens/      # თითო ეკრანი — თითო ფაილი
  state/        # Global state (React Context) — ჯერჯერობით მხოლოდ CustomerProfileContext
  theme/        # ფერები, radius, spacing, typography ტოკენები
docs/
  design-reference/   # საწყისი სპეციფიკაციები, გადატანილი Downloads-იდან მუდმივი წვდომისთვის
  firebase-setup.md   # ინსტრუქცია რეალური Firebase პროექტის დასაკავშირებლად
```

## აშენებული ეკრანები (მდგომარეობა ამ დოკუმენტის ბოლო განახლებისას)

ზიპის (Figma Make React web პროტოტიპის) **ყველა რეალურად გამოყენებადი ეკრანი უკვე აშენებულია.** დეტალურად:

**A — Onboarding:** Welcome, RoleSelect, Register (customer-ისთვის სახელი/გვარი გაყოფილი, იხ. გადაწყვეტილება #8-ის თავზე), Login, ForgotPassword, GoogleComplete, CustomerSetup, ProviderSetup (specialty dropdown + Georgia-ის რეგიონების area picker) — **დასრულებული**
**B — Provider:** ProviderHome (B1), ProviderJobDetail (B2, browse/selected/**completed** mode) — **დასრულებული**
**C — Customer:** CustomerHome/Browse (C1, 2×2 სერვისების ბადე), PostJob (C2, ფოტო-ლიმიტი 3-ზე override + ახალი მისამართის ველი), CustomerJobDetail (C3+C4, სრული completion/problem/rating flow) — **დასრულებული**
**D — Chat:** ChatsList (D1), ChatConversation (D2), ფასის შეთავაზების ბარათი (D3) — **დასრულებული**, იხ. არქიტექტურული გადაწყვეტილება #2
**E — პროფილები:** ProviderProfile (E1), CustomerProfile (E2) — **დასრულებული**, ორივე მენიუს პუნქტი მიბმულია რეალურ ეკრანზე (ქვემოთ). "გასვლა" BottomSheet-ით (`navigation.getParent()?.reset()` Welcome-ზე).
**პროფილის ქვე-ეკრანები (ახალი, ზიპიდან გადმოტანილი):** NotificationsScreen + NotificationSettingsScreen, ProfileSettings (პაროლის შეცვლა), CustomerEditProfile, ProviderEditProfile, ProviderServiceAreas, ProviderCompletedJobs, ProviderReviews, ProviderMyJobs (ზიპშივე orphan იყო — ჩვენთან `ProviderHomeScreen`-ის სტატისტიკის "სამ." უჯრიდან ვხსნით), CustomerJobs, ViewProviderProfile (Customer-ის მხრიდან ოსტატის საჯარო პროფილი) — **ყველა დასრულებული**.
**RatingScreen** (product-spec.md პუნქტი #14) — **დასრულებული**, ინტეგრირებულია `CustomerJobDetailScreen`-ის completion flow-ში (იხ. გადაწყვეტილება #6).
**Notifications** — **დასრულებული**, `NotificationsScreen`/`NotificationSettingsScreen`, bell ღილაკები ყველგან რეალურად მიბმულია.
**`CustomerCategoriesScreen`/`CustomerCategoryScreen`** — ახალი, ზიპში არ არსებობდა ამ ფორმით (იხ. გადაწყვეტილება #10-11).
**`RegionAreaPickerScreen`** — ახალი, ზიპში საერთოდ არ არსებობდა (იხ. გადაწყვეტილება #9).
**შეგნებულად არ აშენებულა:** ზიპის `ErrorState`/`OfflineState` გენერიკული კომპონენტები — არცერთ ეკრანზე რეალურად არ იყო გამოყენებული ზიპშივე (მკვდარი კოდი). "დახმარება" მენიუს პუნქტი (Customer/Provider Profile) — ზიპშივე `screen: null` იყო, დანიშნულების ეკრანი არასდროს არსებობდა.

## ცნობილი ტექნიკური თავისებურებები ამ მანქანაზე

- **JDK 25 (Android Studio-ს ჩაშენებული) ვერ ვარგისობს Android native build-ისთვის** — გამოიყენე Eclipse Temurin JDK 17 (`C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`)
- **ძველი Metro პროცესი port 8081-ზე** შეიძლება მალავდეს ახალ ფაილებს "unresolvable module" შეცდომით — შეამოწმე `Get-NetTCPConnection -LocalPort 8081` პროცესის დაწყების დროით
