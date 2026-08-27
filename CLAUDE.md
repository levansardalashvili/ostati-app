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

- რეგისტრაცია: სახელი, გვარი, ელფოსტა, **მისამართი** (customer-ისთვისაც — დიზაინის რეფერენსის დამატება `product-spec.md`-ის საწყის აღწერაზე, პრიორიტეტის წესით), პაროლი+დადასტურება
- Google რეგისტრაცია: სახელი/ელფოსტა/ფოტო წამოღებულია Google-იდან, მომხმარებელი მხოლოდ აკლებს მისამართს (`GoogleCompleteScreen`)
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
6. **Job-ის სტატუსების ციკლი:** მომლოდინე → დადასტურებულია → დასრულების დადასტურების მოთხოვნა → დახურული + შეფასება.
7. **ტელეფონის ნომერი/საკონტაქტო ინფო არასდროს ჩანს ავტომატურად** — მხოლოდ ორმხრივი გადაწყვეტილებით ჩატში.

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
                # BottomSheet — native Modal-ზე დაფუძნებული ქვევიდან ამომხტარი ფურცელი, ...)
  data/         # mock მონაცემები (categories, districts, specialties, mockHomeData,
                # mockChats) — ჩანაცვლდება Firestore queries-ით
  navigation/   # RootNavigator, CustomerTabs, ProviderTabs + ტიპები
  screens/      # თითო ეკრანი — თითო ფაილი
  theme/        # ფერები, radius, spacing, typography ტოკენები
docs/
  design-reference/   # საწყისი სპეციფიკაციები, გადატანილი Downloads-იდან მუდმივი წვდომისთვის
  firebase-setup.md   # ინსტრუქცია რეალური Firebase პროექტის დასაკავშირებლად
```

## აშენებული ეკრანები (მდგომარეობა ამ დოკუმენტის ბოლო განახლებისას)

**A — Onboarding:** Welcome, RoleSelect, Register, Login, ForgotPassword, GoogleComplete, CustomerSetup, ProviderSetup — **დასრულებული**
**B — Provider:** ProviderHome (B1), ProviderJobDetail (B2, browse/selected mode) — **დასრულებული**
**C — Customer:** CustomerHome/Browse (C1), PostJob (C2, ფოტო-ლიმიტი 3-ზე override), CustomerJobDetail (C3+C4 — ერთი ეკრანი, ორივე state, დიზაინის რეფერენსის მსგავსად) — **დასრულებული**
**D — Chat:** ChatsList (D1), ChatConversation (D2), ფასის შეთავაზების ბარათი (D3) — **დასრულებული**, იხ. არქიტექტურული გადაწყვეტილება #2
**E — პროფილები:** ProviderProfile (E1), CustomerProfile (E2) — **დასრულებული**. ორივეს აქვს "გასვლა" ღილაკი გადამოწმების BottomSheet-ით (`navigation.getParent()?.reset()` Welcome-ზე). მენიუს პუნქტების დანიშნულების ეკრანები (რედაქტირება, ჩემი მოთხოვნები, დაფარვის რაიონები და ა.შ.) ჯერ TODO placeholder-ებია.
**სამუშაოს დასრულება/შეფასება** (product-spec.md პუნქტი #14, Rating screen) — **არ არის აშენებული**. Job Detail-ის ეკრანებში (B2/C3-C4) ეს ნაწილი შეგნებულად გამოტოვებულია.
**Notifications** — **არ არის აშენებული** (Bell ღილაკები ყველგან TODO placeholder-ია)

## ცნობილი ტექნიკური თავისებურებები ამ მანქანაზე

- **JDK 25 (Android Studio-ს ჩაშენებული) ვერ ვარგისობს Android native build-ისთვის** — გამოიყენე Eclipse Temurin JDK 17 (`C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`)
- **ძველი Metro პროცესი port 8081-ზე** შეიძლება მალავდეს ახალ ფაილებს "unresolvable module" შეცდომით — შეამოწმე `Get-NetTCPConnection -LocalPort 8081` პროცესის დაწყების დროით
