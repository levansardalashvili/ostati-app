# Ostato (ostati-app) — პროექტის კონტექსტი

**ეს ფაილი აღწერს, როგორ მუშაობს აპი დღეს, და წესებს, რომლებიც კოდზე მუშაობისას უნდა დაიცვა.** როგორ მივედით აქამდე და რატომ, იხილე **`docs/decisions.md`**: გადაწყვეტილებების ისტორია #1–#200, ნომრებით. ამ ფაილში `#N` ნიშნავს იმ ფაილის ჩანაწერს.

**განახლების წესი:** როცა ერთად ვიღებთ ახალ არსებით არქიტექტურულ ან პროდუქტულ გადაწყვეტილებას, უნდა ვიკითხოთ: **„განვაახლო თუ არა CLAUDE.md?“**. ჩუმად არ განახლდეს და არც წვრილმან ცვლილებებზე. გადაწყვეტილება ემატება `docs/decisions.md`-ის ბოლოს შემდეგი ნომრით, ხოლო აქ იცვლება მხოლოდ ის, რაც მიმდინარე მდგომარეობას ან წესებს ცვლის.

## პროდუქტი

მობილური მარკეტპლეისი (iOS + Android) საქართველოსთვის: **მომხმარებელი** (Customer) აქვეყნებს სახლის სამუშაოს, **ოსტატი** (Provider) სთავაზობს ფასს, მომხმარებელი ირჩევს, შემდეგ მოდის შესრულება, დადასტურება და შეფასება.

- **ბრენდი:** „Ostato“ / „ოსტატო“ (#175). სიტყვა „ოსტატი“ აპში მხოლოდ როლს აღნიშნავს. დომენია `ostato.app`. bundle/package `com.ostato.app`. EAS-ის `slug`/`owner` განზრახ ისევ `ostati-app`-ია, ნუ შეცვლი.
- **ერთ ანგარიშს ერთი როლი აქვს**, როლის გადართვა არ არსებობს.
- **ყველა კომუნიკაცია აპის ჩატშია.** ტელეფონი ავტომატურად არსად ჩანს.
- **ფასს მხოლოდ ოსტატი ადგენს.** მომხმარებელს ბიუჯეტის ველი არ აქვს. „ფასი ვიზიტის შემდეგ“ ტიპის ვარიანტი არ არსებობს: ოსტატი ყოველთვის კონკრეტულ რიცხვს სთავაზობს.
- **გადახდა აპში არ არის.** `agreed_price` მხოლოდ საინფორმაციოა. ბარათით გადახდა დაგეგმილია, ამიტომ გაუქმების, ხელახლა გახსნის, ანგარიშის წაშლის და ფასის ლოგიკა გადახდის დასამატებლად მზად უნდა დარჩეს.
- **შეფასება სავალდებულოა.** შეფასების გარეშე სამუშაო ავტომატურად არ სრულდება (#184), რადგან ასე ოსტატის რეიტინგი არ დაგროვდებოდა.
- მუშაობს ერთი ადამიანი, React Native-ის საშუალო გამოცდილებით. მიზანია App Store და Play Store, ამიტომ არქიტექტურა სტაბილური უნდა იყოს და არა ერთჯერადი პროტოტიპი.

## რეპოები

- **`ostati-app`** (ეს რეპო): Expo აპი და Supabase-ის მიგრაციები, უსაფრთხოების ტესტები და Edge Function-ები (`supabase/`).
- **`ostati-site`** (`C:\Users\LS\Desktop\ostati-site`): Next.js. საჯარო საიტია `ostato.app`, ადმინ-პანელი `ostato.app/admin`. ორივე იმავე Supabase-ს იყენებს.
- **საწყისი სპეციფიკაციები:** `docs/design-reference/` (product-spec, app-states, notifications). ისინი ხშირად მოძველებულია, ამიტომ აპის რეალური ქცევა უფრო მნიშვნელოვანია.

## სტეკი

- **Expo SDK 57 + TypeScript**, React Navigation (native-stack + bottom-tabs; Expo Router არ გამოიყენება). EAS Build და dev-client (Expo Go არ გამოიყენება). New Architecture (Fabric) ჩართულია.
- **Supabase:** Auth, Postgres, Realtime, Storage, Edge Functions (Deno) და `pg_cron`. Firebase ამოღებულია (#52).
- **ბიბლიოთეკები:** `@react-native-google-signin/google-signin`, `expo-apple-authentication`, `expo-image-picker`, `expo-location`, `expo-notifications`, `lucide-react-native`, `expo-linear-gradient`. მისამართის ძებნა: OpenStreetMap Nominatim (უფასოა, key არ სჭირდება).
- **ანიმაცია:** მხოლოდ RN `Animated` (native driver), `src/utils/motion.ts`, `Reveal`. reanimated და haptics განზრახ არ არის, რადგან native rebuild სჭირდება (#169).
- **ელფოსტა:** Supabase Auth Resend-ის SMTP-ით (#176).
- **env:** `.env` (`EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY`), git-ში არ არის. service_role key კლიენტში არასდროს არ ჩანს.

## ავტორიზაცია

- **მეთოდები:**
  - ელფოსტა + პაროლი. რეგისტრაციისას სავალდებულოა 6-ციფრიანი კოდი ელფოსტაზე (`RegisterVerifyEmail`, #174).
  - Google.
  - Apple (მხოლოდ iOS).
  - ტელეფონის OTP. კოდი მზადაა, მაგრამ ღილაკები დამალულია (`PHONE_AUTH_ENABLED = false`, `src/config/features.ts`), სანამ SMS-პროვაიდერი არ ჩაირთვება (#194).
- **პაროლის აღდგენა** OTP-ით ხდება, ელფოსტითაც და ტელეფონითაც (#170).
- **როლი** ირჩევა რეგისტრაციამდე (`RoleSelect`). ავტორიზაციის შემდეგ ის `users.role`-დან იკითხება.
- **რეგისტრაციის ბოლო ეკრანი:** `CustomerSetup`/`ProviderSetup` → `RegistrationSuccess` → Home. ოსტატის setup სავალდებულოა: პროფესია, სამუშაო არეალი, ფოტო. პროფესია მხოლოდ კატეგორიების სიიდან ირჩევა; სიაში თუ არ არის, ირჩევს „სხვა“-ს. თავისუფალი ტექსტით დამატება აღარ არის (#195). UI-ში სიტყვა „პროფესია“ გამოიყენება.
- **მისამართი** მხოლოდ მომხმარებელს აქვს. სადარბაზო, ბინა და კარის კოდი ჩანს მხოლოდ მისთვის და არჩეული ოსტატისთვის, ხოლო „კერძო სახლი“ მათ მალავს (#173).
- **შესვლის დასრულება ერთ ადგილასაა:** `loadSignedInUser` (`src/utils/signInSession.ts`). მას იძახებს Login, PhoneLogin და RootNavigator-ის cold-start (#199). თანმიმდევრობით მოწმდება:
  1. `users` ჩანაწერი არ არის → signOut;
  2. `suspended` → signOut და მიზეზის ჩვენება;
  3. ოსტატს `provider_profiles` ჩანაწერი არ აქვს → `ProviderSetup`.

  შემდეგ ივსება Context. **ახალი `UserRecord` ველი, რომელიც Context-ს სჭირდება, მხოლოდ იქ ემატება.**
- **Google/Apple რეგისტრაცია** ერთ ეკრანზე სრულდება: `SocialCompleteScreen` (`provider: 'google' | 'apple'`). Apple სახელს მხოლოდ პირველ ავტორიზაციაზე აბრუნებს, ამიტომ ის route param-ით მოდის.
- **CAPTCHA (Turnstile) ვცადეთ და მომხმარებელმა უარყო** (#177). თავიდან ნუ შესთავაზებ.

## სამუშაოს ციკლი (მიმდინარე წესები)

სტატუსები: `draft → pending → active → awaiting_customer_confirmation → confirmed_awaiting_rating → completed`. ასევე `disputed` და `cancelled`. **სტატუსს მხოლოდ სერვერის ფუნქციები (RPC) და ტრიგერები ცვლის.** კლიენტს `job_posts`-ზე პირდაპირი INSERT/UPDATE უფლება არ აქვს.

- **გამოქვეყნება:**
  - `create_job` (draft) → ფოტოების ატვირთვა → `set_job_photos` → `set_job_district` → `finalize_job_publish`. ქსელის ჩავარდნისას ხელახალი ცდა იმავე draft-ს იყენებს.
  - სავალდებულოა: კატეგორია, აღწერა (20–500 სიმბოლო), მისამართი, რაიონი, თარიღი და დრო. დრო ერთსაათიანი შუალედია ან „ნებისმიერ დროს“ (#168).
  - წარსული თარიღი იბლოკება ტრიგერით, საქართველოს დროით (#183).
  - ფოტო 3-მდე, `private-media`-ში.
  - ერთდროულად ღია განცხადების ლიმიტი 10 (`app_settings`).
- **პირადი განცხადება** (`invited_provider_id`): „მიწერა“ ან „ხელახლა დაქირავება“ (`StartJobChatSheet`). მხოლოდ ერთ ოსტატს ჩანს და **მხოლოდ ვერიფიცირებულ ოსტატს ეგზავნება** (#189). ოსტატს შეუძლია `decline_invited_job`, მომხმარებელს `open_job_to_all` (#188).
- **დაინტერესება:** `express_interest`, ფასით. მხოლოდ **ვერიფიცირებულ** ოსტატს შეუძლია. ფასი შეიძლება შეიცვალოს ჩატის შეთავაზებით, ოსტატი თავის ინტერესს `withdraw_interest`-ით აუქმებს.
- **არჩევა:**
  - `select_provider`, ან ჩატში ფასზე „დათანხმება“. დათანხმებას ჯერ დადასტურების ფანჯარა სჭირდება, მერე ის `assign_job_provider`-ით აირჩევს ოსტატს.
  - არ-არჩეულ დაინტერესებულებს შეტყობინება მიდით.
  - დაბლოკილ ან შეჩერებულ ოსტატს ვერ აირჩევ.
- **`active`:**
  - მომხმარებელი დროს ცვლის `reschedule_active_job`-ით.
  - გაუქმება: მომხმარებელს მიზეზით, ოსტატს მიზეზის კოდით.
  - დაგეგმილი დროიდან 24 საათში ოსტატს ეგზავნება შეხსენება „დაასრულე?“ (cron).
  - დაგეგმილი დროის შემდეგ:
    - ოსტატი: `provider_request_completion`;
    - ან მომხმარებელი: `customer_mark_completed` (#185).
- **`awaiting_customer_confirmation`:**
  - მომხმარებელი ადასტურებს, ან „პრობლემა მაქვს“ ხსნის დავას. დავის ლიმიტი 2-ია.
  - 72 საათში ავტომატურად დადასტურდება, `completion_requested_at`-ით (#186).
  - ჩატში ჩნდება „სამუშაო დასრულებულია“ ბარათი.
- **`disputed`:** ოსტატი წერს თავის მხარეს (`provider_respond_to_dispute`), ადმინი კი წყვეტს: `reopen` ან `cancel`.
- **`confirmed_awaiting_rating`:**
  - **შეფასების ეკრანი იხსნება აპის ყოველ გახსნაზე, სანამ შეფასება არ გაიგზავნება** (`CustomerTabs`, #184).
  - `reviews`-ის INSERT ტრიგერი სამუშაოს `completed`-ზე გადაიყვანს. ეს ერთადერთი გზაა.
- **შეფასება:** ანონიმურია. ოსტატს ერთხელ შეუძლია პასუხი, ადმინს კი დამალვა. ოსტატს მიდის `new_review` შეტყობინება.
- **ვადები:**
  - მომლოდინე განცხადებას 30 დღე აქვს: მე-27 დღეს შეხსენება, მერე განახლება ან გაუქმება.
  - 48 საათში „არავინ დაინტერესდა“ შეხსენება.
  - ფასის შეთავაზება 7 დღე მოქმედებს.
  - ყველა რიცხვი `app_settings`-შია და დროზე დამოკიდებული წესები `run_time_rules()` cron-ში (15 წთ).
- **ხელახლა გახსნა:** თუ არჩეულმა ოსტატმა გააუქმა, მომხმარებელი `reopen_job`-ით ხელახლა ხსნის. გამქრალი ოსტატი `excluded_provider_ids`-ში ემატება.

## ბაზა და უსაფრთხოება — წესები

- **ცხრილები:**
  - მომხმარებლები და ოსტატები: `users`, `provider_profiles`, `provider_verification_requests`, `favorite_providers`, `user_blocks`.
  - სამუშაო და შეფასება: `job_posts`, `job_responses`, `reviews`, `job_reports`.
  - ჩატი: `messages`, `conversations`, `chat_reports`.
  - შეტყობინებები: `notifications`, `notification_preferences`, `push_tokens`.
  - ცნობარები და პარამეტრები: `categories`, `region_districts`, `app_settings`, `app_gate`.
  - ადმინისტრირება: `admin_audit_log`, `admin_broadcasts`, `client_errors`.
  - საიტი და დახმარება: `site_pages`, `site_blocks`, `site_settings`, `site_screenshots`, `help_categories`, `help_articles`, `support_requests`.
- **მიგრაციები:** `supabase/migrations/NNNN_*.sql`, ბოლოა `0158`. გაშვება ხდება `npx supabase@latest db query --linked -f <file>`-ით. ჯერ ცოცხალ ბაზაზე გაუშვი ტრანზაქციაში, რომელიც `rollback`-ით მთავრდება, მერე რეალურად.
- **არსებული ფუნქციის შეცვლისას ცოცხალი განმარტება აიღე** (`pg_get_functiondef`). ძველი მიგრაციის ფაილს ნუ ენდობი, ფუნქციები მრავალჯერ გადაიწერა.
- **RPC და SECURITY DEFINER:**
  - `set search_path = ''`.
  - აუცილებელი შემოწმებები: `auth.uid()`, როლი (`users.role`) და მფლობელი. სტრიქონი იკეტება `for update`-ით.
  - `revoke execute ... from public, anon`, ხოლო `grant` მხოლოდ საჭირო როლს.
  - ტრიგერისა და შიდა ფუნქციებზე EXECUTE არავის აქვს.
- **RLS:**
  - permissive policy-ები ერთმანეთს OR-ით უერთდება. ამიტომ ახალი მკაცრი policy-ის დაწერისას ძველი იმავე ბრძანებაზე წაშალე (#122).
  - policy-ში სხვა ცხრილის წაკითხვა caller-ის RLS-ით ხდება. ამიტომ ასეთი შემოწმება SECURITY DEFINER helper-ში გაიტანე, რომელიც boolean-ს აბრუნებს (#123).
- **ანონიმს ცხრილზე default უფლება არ აქვს** (#166). თუ ანონიმმა უნდა წაიკითხოს, ცალკე `grant select ... to anon` დაწერე.
- **ადმინი:**
  - შემოწმება ყოველთვის `is_admin()`-ით. ეს ფუნქცია MFA-ს (aal2) ამოწმებს, `users.role`-ის პირდაპირ შემოწმება კი MFA-ს გვერდს აუვლის (#167).
  - ადმინის ყოველი მოქმედება არის RPC, რომელიც `log_admin_action()`-ს იძახებს.
- **ლიმიტები და ვადები** ჰარდქოდით არ იწერება. ადგილია `app_settings` (`app_setting(key, default)`), ხოლო დიაპაზონი ჩაიწერება `admin_set_app_setting`-ში.
- **ზუსტი მისამართი** მხოლოდ მომხმარებელს და არჩეულ ოსტატს ჩანს. ლენტა `district` ან `area_label` აჩვენებს (`get_open_provider_feed`/`get_feed_job_by_id`). ლენტის ფუნქციის შეცვლისას ყველა ფილტრი შეინარჩუნე: invited, excluded, blocked, ვადა, კატეგორია და არეალი.
- **Storage:**
  - `private-media` (ჩატი, დასრულება, სამუშაოს ფოტოები, ვერიფიკაციის სელფი) ჩანს signed URL-ით (`SecureStorageImage`), ბაზაში კი ინახება `private-media://...` მარკერით. ეს მარკერი Storage API-ს პირდაპირ არ გადაეცემა.
  - `user-media`/`job-photos` საჯაროა, ფაილის ტიპის შეზღუდვის გარეშე (#166).
- **ანგარიშის წაშლა:** მთელი ლოგიკა ერთ ადგილასაა, `_delete_account_core`. დასრულებული სამუშაოები და შეფასებები ანონიმიზდება. ახალი პირადი ველი იქ დაამატე (#137).
- **ვერიფიკაცია:**
  - `request_provider_verification` სერვერზე ამოწმებს პროფილის სისრულეს და იმას, რომ სელფი გამომძახებლისაა და არსებობს (`PROFILE_INCOMPLETE`/`INVALID_SELFIE`).
  - ვერიფიცირებული ოსტატი თუ შეცვლის ფოტოს, სახელს ან გვარს, ტრიგერი `provider_profiles_reverify` მას `pending`-ზე აბრუნებს (`review_reason='profile_changed'`) და შეტყობინებას უგზავნის (#191).
  - ვერიფიკაციის მოხსნა შლის მის ფასის შეთავაზებებს მომლოდინე განცხადებებზე.
- **შეჩერება** (`suspended_at`) კეტავს შესვლას, ჩატს, განცხადებას, დაინტერესებას და არჩევას (#140, #143).
- **ყოველი მიგრაციის ან policy-ის ცვლილების შემდეგ** გაუშვი `supabase/security-tests/attack.sql` და `attack-site.sql`. შედეგი უნდა იყოს 0 ხვრელი (`ᲨᲔᲡᲐᲫᲚᲔᲑᲔᲚᲘᲐ!`). MFA-ს ცვლილებაზე დამატებით `mfa-admin.sql`. Storage-ის ცვლილებაზე ფოტოს ატვირთვის Maestro ტესტებიც.

## შეტყობინებები

- **`notifications`-ში მხოლოდ სერვერი წერს** (RPC და ტრიგერები). კლიენტს INSERT უფლება არ აქვს.
- **`type`** ემთხვევა `NotificationSettingsScreen`-ის გასაღებებს: `new_interest`, `new_chat_message`, `job_selected`, `completion_reminder`, `job_status_change`, `new_jobs_in_area`, `new_review`, `verification_status_change`, ასევე `announcement`, `account_suspension`, `profile_moderation`. გასაღები თუ არ არის ჩაწერილი, ჩართულად ითვლება.
- **Push:** webhook → Edge Function `send-push-notifications`. დაცულია `PUSH_WEBHOOK_SECRET`-ით და ჩანაწერს ბაზიდან თავიდან კითხულობს. პრეფერენცია მხოლოდ push-ს აჩერებს, აპის შიგნით შეტყობინება მაინც იქმნება.
- **`new_jobs_in_area`** იგზავნება `district = any(areas)`-ის შემთხვევაში, მხოლოდ ხელმისაწვდომ ოსტატზე. გამოტოვებულია excluded და დაბლოკილი ოსტატი. ძველი custom სპეციალობის ოსტატი არ იღებს (ახალი custom აღარ იქმნება, #195).

## ადმინ-პანელი (`ostati-site`)

**აპის მართვა:** მომხმარებლები (დეტალური გვერდი, მოდერაცია, წაშლა), განცხადებები, კატეგორიები, რეგიონები, ვერიფიკაციები (სელფი და ფოტო), რეპორტები, მიმართვები, შეფასებები, დავები (ორივე მხარე), შეტყობინება ყველასთვის, ლიმიტები, ვერსია და ტექნიკური რეჟიმი, ჟურნალი, აპის შეცდომები.

**საიტის მართვა:** გვერდები, სექციები, ეკრანები, დახმარების ცენტრი, პარამეტრები. სამართლებრივი ცენტრი არის `/legal`.

წესები:
- ადმინის კოდი არასდროს იყენებს `service_role`-ს, მხოლოდ ადმინის საკუთარ სესიას.
- დიალოგებისთვის `src/lib/dialog.tsx` (`ask`/`askText`), native `confirm`/`prompt` არა.
- Markdown მხოლოდ `renderMarkdown`-ით.
- ახალი ტექსტი საიტზე ემატება `SITE_TEXTS`-ში.
- ახალი გარე დომენი უნდა ჩაიწეროს CSP-ში (`next.config.ts`).
- კონფიდენციალურობის გვერდი (`site_pages`, slug `privacy`) მხოლოდ აპის რეალურ მონაცემებს აღწერს. ახალი პირადი მონაცემი, ნებართვა ან გარე სერვისი იქაც უნდა დაემატოს (#193).
- „პირობები“ (`site_pages`, slug `terms`) აღწერს აპის რეალურ ქცევას (#197). აპის წესის შეცვლისას იქაც განაახლე. რიცხვები (30 დღე, 72 საათი, დავა 2-ჯერ, 7 დღე, 10 განცხადება) `app_settings`-ის ასლია: ლიმიტის შეცვლისას ტექსტიც ხელით შეცვალე.
- საკონტაქტო ელფოსტა `contact@ostato.app` (`site_settings.contact_email`). ტექსტში იწერება `{{contact_email}}`, საიტი მას ბმულად ცვლის.
- deploy: `npx vercel --prod`. GitHub-იდან ავტომატური deploy არასანდოა.

## აპის კოდის წესები

- **სერვისები:** მონაცემები მხოლოდ `src/services/*`-იდან (Supabase). სერვისი უბრალო ობიექტია, ცალკე `interface`-ის გარეშე: ტიპები მეთოდებზევე წერია (#199). ტიპები `src/types/*`-ში. mock მონაცემები არსად არ არის.
- **კომენტარები:** ხსნის, *რატომ* წერია კოდი ასე და რაზე უნდა იყოს ფრთხილად. ისტორია („Task —“, „#NN“, „მანამდე…“) კოდში არ იწერება — ის `docs/decisions.md`-შია (#200). განზრახ გამარტივებული ადგილი აღინიშნება `ponytail:` კომენტარით.
- **ეკრანის სტრუქტურა:** ერთი მუდმივი JSX ხე (`{loading ? <Skeleton/> : …}`). ორი ცალკე `return` Fabric-ზე crash-ს იწვევს.
- **ტაბის ეკრანები:** სიებს `useFocusEffect` ანახლებს, რადგან ტაბები mounted რჩება.
- **Realtime:** `channel()`-ის სახელს ყოველთვის ემატება შემთხვევითი suffix.
- **`TextInput`:** `editable`-ს ნუ ცვლი. დაბლოკე ღილაკი და handler.
- **კლავიატურა:** ფორმა `KeyboardAwareForm`-ში, ველი `TextField`/`ScrollAwareTextInput`-ით (ფოკუსისას ავტომატურად ადის კლავიატურის ზემოთ). ჩასქროლვა ითვლება ველის ეკრანზე პოზიციით, კლავიატურის გამოჩენის შემდეგ; RN-ის `scrollResponderScrollNativeHandleToKeyboard` არ გამოიყენო (ScrollView-ს ზემოთ არსებულ ჰედერს არ ითვალისწინებს). `CurvedAuthHeader` კლავიატურის გახსნისას ვიწრო ზოლად იკეცება (#196).
- **ფოტოს არჩევა:** ერთი „დამატება“ ღილაკი + `PhotoSourceSheet` (`MediaUploadGrid.tsx`; კამერა/გალერეა). ორი ცალკე ღილაკი აღარ კეთდება (#195).
- **ოსტატების სია:** ლაგდება `compareProviders`-ით (ვერიფიცირებული პირველია). ვერიფიკაციის გარეშე ოსტატს „მიწერა“ არ აქვს.
- **თარიღი:** სამუშაოს თარიღის ტექსტი იგება `preferred_date`/`time_slot`-იდან (`displayDate`). ფარდობითი სიტყვები („დღეს“/„ხვალ“) ბაზაში არ ინახება.
- **`cancellation_actor`:** ახალი მნიშვნელობა ეკრანის ტექსტებშიც უნდა დაემატოს.
- **testID:** ახალი ინტერაქტიული ელემენტი იღებს `testID`-ს. ტაბს `tabBarAccessibilityLabel`-იც სჭირდება.
- **შეცდომები:** დაუჭერელი JS შეცდომები ავტომატურად იწერება `client_errors`-ში (`errorReporter`, `ErrorBoundary`). native ჩავარდნები არ იჭერება.
- **ენა:** ყველა ტექსტი ქართულია. მომხმარებელს ქართულად ესაუბრე.

## ნავიგაცია

- **Root:** ერთი `native-stack` (`RootNavigator.tsx`, `RootStackParamList`). ავტორიზაციის შემდეგ `navigation.reset()`.
- **ტაბები** (`CustomerTabs`/`ProviderTabs`) ზის `CustomerHome`/`ProviderHome` route-ზე. 4 ტაბია:
  - მომხმარებელი: მთავარი / განცხადებები / ჩატები / პროფილი;
  - ოსტატი: მთავარი / სამუშაოები / ჩატები / პროფილი.

  `backBehavior="history"`, ტაბ-ბარი `FloatingTabBar`.
- **ტაბის შიგნიდან:** root-stack-ის action იძახება `navigation.getParent()?.reset(...)`-ით.
- **დეტალის ეკრანები** (`ChatConversation`, `CustomerJobDetail`, `ProviderJobDetail`, `PostJob`, `RatingScreen`) root-stack-ზეა.

## სტრუქტურა

```
App.tsx               # providers, ErrorBoundary, AppGateOverlay, PushNotificationsBootstrap
src/components/       # საერთო UI (Button, BottomSheet, ProviderCard, StartJobChatSheet, ...)
src/data/             # მხოლოდ ოფლაინ fallback ცნობარები (categories, georgiaRegions, timeSlots, ...)
src/navigation/       # RootNavigator, CustomerTabs, ProviderTabs, types
src/screens/          # თითო ეკრანი, თითო ფაილი
src/services/         # Supabase წვდომა (auth, user, job, quote, chat, review, notification,
                      #   storage, category, region, block, report, pushToken, errorReporter, ...)
src/state/            # Context-ები (CustomerProfile, ProviderProfile, FavoriteProviders, JobStatus, TabBarScroll)
src/theme/            # ფერები, spacing, typography (scaleFont)
src/types/            # domain ტიპები
src/utils/            # providerRank, motion, notificationNavigation, ...
supabase/migrations/  # SQL მიგრაციები (ერთადერთი წყარო)
supabase/functions/   # Edge Functions (send-push-notifications, delete-account-files, send-sms-hook)
supabase/security-tests/  # attack.sql, attack-site.sql, mfa-admin.sql
.maestro/flows/       # E2E სცენარები
docs/decisions.md     # გადაწყვეტილებების ისტორია (#1–#200)
```

## ტესტირება და გამოშვება

- **ტიპები:** `npx tsc --noEmit` ორივე რეპოში.
- **ბაზა:** ცვლილება ჯერ ტრანზაქციაში მოწმდება, რომელიც rollback-ით მთავრდება, შემდეგ უსაფრთხოების ტესტები.
- **Maestro** (`.maestro/flows`, ~21 სცენარი, `~/runfull.sh`):
  - `launchApp: stopApp: false`;
  - ლოდინი `extendedWaitUntil`-ით;
  - `hideKeyboard` მხოლოდ მაშინ, როცა კლავიატურა ღიაა (სხვა შემთხვევაში BACK-ად გადაიქცევა და BottomSheet-ს ხურავს);
  - Welcome/Login-ის ტექსტის შეცვლისას ყველა სცენარის საერთო შესავალი ნაწილი ერთდროულად განაახლე (#170).
- **Maestro-ს ფიქსჩერები:**
  - ოსტატის ფიქსჩერი `verified.provider@e2e.example.com` (პაროლი `TestPass123`) არ წაიშალოს.
  - ელფოსტის OTP-ს `~/otp-server.js` სჭირდება (პორტი 7890) და რეალური დომენი (`@gmail.com`).
  - dev-client-ის ⚙ ღილაკი ⋮ მენიუს ფარავს, ამიტომ ⋮-ზე `point: "92%, 7%"`-ით დააჭირე.
- **სატესტო მონაცემები** ტესტის შემდეგ იშლება. ფრთხილად იყავი „ყველასთვის გახსნის“ ტიპის ტესტებთან, რადგან ისინი რეალურ ოსტატებს უგზავნიან შეტყობინებას.
- **გამოშვება:**
  - native ცვლილება (ნებართვები, ახალი native პაკეტი) → EAS build. JS-ის ცვლილება Metro/OTA-ით მიდის.
  - Edge Function: `npx supabase@latest functions deploy <name> --use-api`.
  - commit და push მხოლოდ მომხმარებლის თხოვნით.

## ღია საკითხები

- **iOS Google Sign-In:** OAuth client ძველ bundle ID-ზეა. მის შეცვლას App Check ბლოკავს (#179).
- **SMS-პროვაიდერი** შეჩერებულია: უფასო ვარიანტი არ არის. Bird-ში SMS საქართველოში $0.15-ია, წინასწარი ბალანსით (#194); `send-sms-hook` ჯერ Vonage-ზეა დაწერილი.
- **ბარათით გადახდა** დაგეგმილია, ჯერ არ არის.
- **გამოქვეყნებამდე:** იურისტის გადამოწმება, კომპანიის რეკვიზიტები, მაღაზიების ბმულები (`site_settings`), Leaked Password Protection (Pro გეგმა). `contact@ostato.app` წერილების მისაღებად უნდა მუშაობდეს (Resend მხოლოდ აგზავნის).
- **ბაზაში თითქმის ყველაფერი სატესტოა** (193 მომხმარებლიდან 185, 2026-10-10): გაშვებამდე გასუფთავება და Maestro-ს ცალკე სატესტო პროექტზე გადატანა საჭიროა. ვერიფიცირებული ოსტატი მხოლოდ ფიქსჩერია.
- **native ჩავარდნების აღრიცხვა** (Sentry) არ არის, მხოლოდ JS შეცდომები იწერება.
- **ვერიფიკაციის ხელით შემოწმება** ერთი ადმინის საქმეა. გაშვებისას ის დაბრკოლებად შეიძლება იქცეს, რადგან ფასის შეთავაზება მხოლოდ ვერიფიცირებულ ოსტატს შეუძლია.

## ცნობილი ტექნიკური თავისებურებები (ეს მანქანა)

- **Android native build:** გამოიყენე JDK 17 (`C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot`), Android Studio-ს JDK 25 არა.
- **ძველი Metro 8081-ზე** ახალ ფაილებს მალავს. შეამოწმე `Get-NetTCPConnection -LocalPort 8081`-ით.
- **Metro-მდე გახსნილი dev-client** აჩვენებს `Failed to connect to 10.0.2.2:8081`-ს. Metro-ს ჩატვირთვის შემდეგ ხელახლა გახსენი: `adb shell am start -a android.intent.action.VIEW -d "exp+ostati-app://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" com.ostato.app`.
- **adb Git Bash-ში:** remote ბილიკს სჭირდება `MSYS_NO_PATHCONV=1`, ლოკალური ბილიკი კი Windows-ის ფორმით (`C:\...`) უნდა იყოს. თუ prefix გამოგრჩა, `uiautomator dump` ძველ ფაილს ჩამოტვირთავს. ზუსტ კოორდინატებს `uiautomator dump`-ის `bounds` იძლევა. screenshot-ზე თვალით აღებული კოორდინატი შემცირებულ სივრცეშია (×1.2).
- **ემულატორის GPS** არასდროს მუშაობს (Pixel_8 AVD). GPS-ის ტესტი მხოლოდ ფიზიკურ მოწყობილობაზე.
- **`react-native-webview`-ს შიგნით** `adb input tap` არ აღწევს (#177).
- **`pm clear com.ostato.app`** სუფთა გაშვებას აკეთებს, მაგრამ dev-client-ის სერვერის ასარჩევ ეკრანს აჩენს.
- **Shell-ში დიდი SQL ან JS** ფაილში ჩაწერე და ფაილიდან გაუშვი. JS-ის `String.replace`-ში `$$` იჭრება, ამიტომ `split/join` გამოიყენე. ჩადგმულ `do $$`-ში შიდა ბლოკისთვის `$t$` გამოიყენე.
- **ჩაშენებულ ბრაუზერში** `127.0.0.1` და `localhost` ცალკე cookie-ს ინახავს. ეს მეორე ადმინ-სესიისთვის გამოგადგება.
