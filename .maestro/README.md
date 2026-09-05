# E2E ტესტები (Maestro)

## გაშვება

```bash
maestro test .maestro/flows/customer_core_journey.yaml
maestro test .maestro/flows/provider_core_journey.yaml
maestro test .maestro/flows/cross_role_job_lifecycle.yaml
maestro test .maestro/flows/chat_price_offer.yaml
maestro test .maestro/flows/favorite_providers.yaml
maestro test .maestro/flows/job_cancellation.yaml
maestro test .maestro/flows/job_reports.yaml
maestro test .maestro/flows/provider_verification.yaml
maestro test .maestro/flows/notifications.yaml
maestro test .maestro/flows/password_change.yaml
maestro test .maestro/flows/chat_image_upload.yaml
```

**`chat_image_upload.yaml`-ს დამატებით სჭირდება ტესტ-სურათი ემულატორის გალერეაში, ერთხელ, გაშვებამდე:**
```bash
adb push assets/icon.png //sdcard/Pictures/e2e_test_photo.png
adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE -d file:///sdcard/Pictures/e2e_test_photo.png
```

**წინაპირობები:**
- Android emulator (ან რეალური მოწყობილობა) გაშვებული და `adb devices`-ში ხილული.
- აპი დაინსტალირებული (`expo run:android` ერთხელ) და Metro (`npx expo start`) გაშვებული.
- Windows-ზე: Georgian ტექსტი Maestro-ს ლოგებში/YAML-ის დამუშავებაში სწორად რომ დამუშავდეს, საჭიროა:
  ```bash
  export JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8 -Dsun.jnu.encoding=UTF-8"
  ```
  ამის გარეშე Maestro ვერ პოულობს ქართულ ტექსტს ("???????"-ად იქცევა შიდა regex-შიც, არა მხოლოდ ლოგში).
- **`provider_core_journey.yaml`-ის express-interest ნაბიჯს სჭირდება მინიმუმ ერთი რეალური ღია (`status='pending'`) job** — `customer_core_journey.yaml` ყოველ გაშვებაზე ტოვებს ერთს ("სანტექნიკა") — თუ dev ბაზა სუფთაა, ჯერ Customer-ის flow გაუშვი.
- **`cross_role_job_lifecycle.yaml`/`chat_price_offer.yaml`/`favorite_providers.yaml` თავად ქმნიან ორივე (Customer + Provider) ანგარიშსაც** — არცერთ სხვა flow-ზე არ არიან დამოკიდებული, სუფთა ბაზაზეც დამოუკიდებლად გაეშვება. `favorite_providers.yaml`-ს job საერთოდ არ სჭირდება — favorites მთლიანად საჯარო Provider დირექტორიაზეა აგებული (#60).

## რატომ ასეა აწყობილი

- **ბექენდი რეალურია** — არცერთი mock/test-Supabase-პროექტი არ არსებობს. ყოველი გაშვება ქმნის ახალ ანგარიშს `e2e.customer.<timestamp>@example.com`/`e2e.provider.<timestamp>@example.com` ფორმატით (`evalScript`), რომ არასდროს დაეჯახოს წინა გაშვებას და ფიქსირებული seed-მონაცემები არ სჭირდებოდეს.
- **`launchApp` არ იყენებს `clearState`-ს** — ეს Expo dev-client build-ია, `clearState` ასევე წაშლიდა dev-client-ის საკუთარ "რომელ Metro server-თან დავუკავშირდე" preference-საც და "connect to server" ეკრანზე დააბრუნებდა, აპის ნაცვლად.
- **ორსაფეხურიანი wait `launchApp`-ის შემდეგ** — dev-client ყოველ ჯერზე ხელახლა იტვირთება ("Loading from ...") Metro-დან, და ამის შემდეგაც აპს სჭირდება დრო `authService.waitForSession()`-ის დასრულებამდე (RootNavigator-ის "booting" state) — მანამდე ეკრანზე მხოლოდ dev-client-ის floating debug ღილაკია, არაფერი რეალური. ორივე ეტაპი აშკარად ცალკეა დალოდებული.
- **Text-ის matching — `.*text.*` regex, არა exact-match shorthand** — ცალკეული ელემენტები (მაგ. bottom tab-ის ლეიბლები, ალბათ @react-navigation/bottom-tabs-ის composite accessibility label-ის გამო) ვერ იძებნება ზუსტი match-ით, თუმცა იმავე ტექსტი ეკრანზე პირდაპირ ჩანს. `.*text.*` ორივე შემთხვევას ფარავს.
- **ცალკეულ ადგილას საჭირო გახდა ANCHORED (`^text$`) match** — ისეთ ღილაკებზე, სადაც იმავე ეკრანის სათაურიც შეიცავს იმავე სიტყვას როგორც substring-ს (მაგ. "დასრულება" ღილაკი vs "პროფილის დასრულება" სათაური; "გამოქვეყნება" ღილაკი vs "მოთხოვნის გამოქვეყნება" სათაური; "პროფილის შექმნა" ღილაკი vs "შექმენი ოსტატის პროფილი" სათაური) — `.*text.*` ორივეს პოულობდა და შემთხვევით header-ს აჭერდა real ღილაკის ნაცვლად.
- **`testID` დამატებულია რამდენიმე ადგილას** (`Button`/`TextField` კომპონენტებზეც გავრცელდა) — მხოლოდ იქ, სადაც ტექსტური selector არასაიმედო/ბუნებრივად ორაზროვანი იყო (checkbox-ს ტექსტი საერთოდ არ აქვს; ორ პაროლის ველს იდენტური placeholder აქვს; ორ ეკრანზე ორივეს "გასვლა" ჰქვია; `OfferPriceSheet`-ის სათაური და submit-ღილაკი პირდაპირ ერთი და იგივე ტექსტია). ეს არის უცვლელი, არადესტრუქციული დამატება — არცერთი ვიზუალური/ქცევითი ცვლილება არ შესულა.
- **`ProviderProfileScreen`-ზე "გასვლა" scroll-ს საჭიროებს** — profile-completeness/verification card-ების გამო ეს row ხშირად fold-ის ქვემოთაა, განსხვავებით `CustomerProfileScreen`-ისგან — `scrollUntilVisible` წინ უსწრებს `tapOn`-ს.
- **`index: 0`** გამოყენებულია, სადაც selector-ი ბუნებრივად ერთზე მეტ ერთნაირ ელემენტს პოულობს (job feed-ის ბარათების "დაინტ. ვარ" ღილაკები — თითო ბარათზე ერთი).
- **`cross_role_job_lifecycle.yaml`-ს ორი ანგარიშის (Customer + Provider) მონაცვლე login/logout-ი სჭირდება ერთ, უწყვეტ flow-ში** — `output.*` ცვლადები (ორივე email, job-ის უნიკალური marker-ტექსტი აღწერაში) მხოლოდ ერთი flow-ფაილის შესრულების განმავლობაში ცოცხლობს, ამიტომ ეს ვერ გაიყოფოდა ცალკე ფაილებად ისე, როგორც customer/provider core journey-ები.
- **`below:` selector** გამოყენებულია Provider-ის მხრიდან **კონკრეტული** job-ის (unique marker-ტექსტით) "დაინტ. ვარ" ღილაკის საპოვნელად ღია feed-ში, სადაც შეიძლება სხვა job-ებიც არსებობდეს ერთდროულად.
- **`LoginScreen`-ს დაემატა testID (`login-email`/`login-password`/`login-submit-button`)** — ამ ეკრანზე სათაური Text-იც და submit-ღილაკიც სიტყვასიტყვით "შესვლა"-ა, ანუ ანარეგირებელი `.*text.*` თუ ანკერული `^text$` ვერცერთი ვერ განასხვავებდა (ორივე ელემენტს იდენტური ტექსტი აქვს ერთდროულად ეკრანზე).
- **root-stack ეკრანებიდან (`CustomerJobDetail`/`ProviderJobDetail`) chat-ში შესვლა/გამოსვლა ორ `back`-ს საჭიროებს ტაბ-ბარამდე დასაბრუნებლად, არა ერთს** — `back`-ი chat-იდან მხოლოდ job-დეტალის ეკრანზე გვაბრუნებს (თავადაც root-stack-შია, ტაბების გარეთ, #ნავიგაციის-არქიტექტურა), სადაც ხშირად თავად აქვს `.*პროფილი.*`-ს substring-ის შემცველი ტექსტი (მაგ. "ოსტატის პროფილი" ბმული) — ერთი `back` საკმარისი არაა ტაბ-ბარამდე დასაბრუნებლად.
- **`hideKeyboard` ჩატის (ტექსტური) კომპოზერში არასაიმედოა Android-ზე** — ორი დაპირისპირებული failure-ი დაფიქსირდა: ერთხელ Georgian Gboard-მა send-ღილაკი მთლიანად ეკრანს გარეთ დაფარა (`hideKeyboard` საჭირო აღმოჩნდა), მეორედ იგივე `hideKeyboard` ქცევა back-press-ად "გადაიქცა" და chat-ის ეკრანიდან სრულად გამოვიდა (keyboard უკვე ჩაკეტილი აღმოჩნდა იმ მომენტში). გადაწყვეტა — `hideKeyboard`-ის ნაცვლად `tapOn: { point: "50%, 25%" }` (ცარიელ, non-interactive კოორდინატზე ტაპი, chat-ის სრულეკრანიან layout-ში) — ეს ყოველთვის მხოლოდ input-ს აცილებს ფოკუსს (keyboard-ს კეტავს, თუ ღიაა), არასდროს არ ნავიგირებს, მიუხედავად keyboard-ის რეალური მდგომარეობისა.
- **იგივე `point:` tap-ის ხრიკი BottomSheet-ებში საშიშია** — `chat_price_offer.yaml`-ის ფასის sheet-ში (`BottomSheet`-ს, chat-ისგან განსხვავებით, არ აქვს `KeyboardAvoidingView`) `point: "50%, 25%"` სცადა backdrop-ის ზონაში მოხვედრა და მთლიანად დახურა sheet-ი (`onRequestClose`), თავად submit-ის მაგივრად. Numeric-keypad-იც საკმარისად მაღალია, რომ sheet-ის საკუთარი სათაურიც კი დაფაროს — ანუ "sheet-ის საკუთარ non-interactive ტექსტზე tap-იც" ვერ იმუშავებდა. აქ საბოლოოდ `hideKeyboard` აღმოჩნდა საიმედო (იგივე pattern, რაც `OfferPriceSheet`-ის (job-feed-ის ფასის prompt) numeric input-ს უკვე ჰქონდა, მრავალჯერ დამოწმებული) — ჩატის ტექსტური კომპოზერის flakiness specific აღმოჩნდა იმ კონკრეტულ multiline text-input/IME კომბინაციასთვის, არა ზოგადად `hideKeyboard`-ის ბრალი ყველგან.
- **ტექსტური `tapOn`/`assertVisible` selector-ი TextInput-ის საკუთარ, ახლახან ჩაწერილ მნიშვნელობასაც დაემთხვევა** — `favorite_providers.yaml`-ში Home-ის ძებნის ველში ჩაწერილი უნიკალური Provider-ის სახელი (`${output.providerFirstName}`) TextInput-ის accessibility-ხის ნაწილადაც ითვლება, ამიტომ `.*firstName.*` selector-ს შეეძლო თავად search-ველი დაერტყა, ბარათის მაგივრად — გადაწყვეტა: ტაპის pattern-ს დაემატა `" Test"` (გვარი) სუფიქსი, რომელიც მხოლოდ ბარათის სრულ სახელშია, search-ველის (მხოლოდ firstName-იანი) მნიშვნელობაში არა.
- **icon-only, სახელის/ტექსტის გარეშე ღილაკებს ყოველთვის სჭირდება testID, თუნდაც ერთადერთი ასეთი ჩანდეს ეკრანზე ერთდროულად** — `ViewProviderProfileScreen`-ის ❤️ (favorite-toggle) და back/share ღილაკები ერთი და იმავე `iconButton` style-ისაა, `SavedProvidersScreen`-ის ბარათის ❤️ (unfavorite-toggle) ანალოგიურად — testID დაემატა ორივეს.

## ნაპოვნი რეალური ბაგები (E2E-ის თავად ამ პროცესში აღმოჩენილი)

- **`job_posts.provider_name` column missing** — `supabase/migrations/0068`. Live-DB-ის drift `job_posts`-ის CREATE TABLE-სა და ცოცხალ ბაზას შორის.
- **`provider_profiles`-ის UPDATE grant** — `supabase/migrations/0069`. ცოცხალ ბაზაზე 0026-ის column-scoped grant არასდროს ჩაირთო სრულად.
- **`userService.upsertProviderProfileRecord`-ის `.upsert()` სისტემურად ვერასდროს იმუშავებდა column-scoped UPDATE grant-ით** — დადასტურებულია REST-ით პირდაპირ: plain `.insert()`/`.update()` მუშაობს, `INSERT ... ON CONFLICT DO UPDATE` კი Postgres-ს ყოველთვის ითხოვს table-level UPDATE-ს, column-level საკმარისი არაა. **გასწორებულია კოდში** (`src/services/userService.ts`) — update-პირველ, insert-fallback პატერნზე გადასვლით (ორივე plain statement-ია) — ეს იყო ის ბაგი, რის გამოც **ყოველი ახალი Provider-ის რეგისტრაცია რეალურად ვერასდროს სრულდებოდა production-ში** მანამ, სანამ Maestro-ს ეს flow არ დაწერილა და გაშვებულა.
- **`ProviderJobDetailScreen`-ის `job.cancellationActor` არასდროს ახლდებოდა Provider-ის საკუთარი გაუქმების შემდეგ** — `job` root-level `useState` მხოლოდ screen mount-ზეა fetch-ილი; `provider_cancel_job()` RPC-ის წარმატების შემდეგ `setStatus(...)`-ს არ ჰქონდა შესაბამისი `setJob(...)` — ბანერი/footer ტექსტი ყოველთვის "მომხმარებელმა... გააუქმა"-ს აჩვენებდა, თუნდაც Provider-მა TVE გაუქმებულიყო job. **გასწორებულია** — RPC-ის წარმატებაზე ემატება `setJob((j) => ({ ...j, cancellationActor: 'provider' }))`.

## ცნობილი შეზღუდვები

- **Google Sign-In flow-ები E2E scope-ს გარეთაა** — Google-ის საკუთარი ბოტ-დაცვა ბლოკავს ავტომატიზაციას საიმედოდ.
- **ცალკეული, იშვიათი ქსელური "blip"-ები** (Supabase auth-ის მოთხოვნა ჩავარდება ერთხელ, retry-ზე მუშაობს) — დაფიქსირდა რამდენჯერმე მთელი სესიის განმავლობაში (`customer_core_journey`/`provider_core_journey`-ის ტესტვისას, და `cross_role_job_lifecycle`-ის აშენებისას — ერთხელ registration-ზე, ერთხელ login-ზე), ყოველთვის დამოუკიდებელი raw REST call-ით დადასტურდა, რომ ბექენდი თავად ჯანმრთელი იყო იმ მომენტში (200 OK, retry-ზე flow-იც უცვლელად გაივლიდა) — ეს დამახასიათებელია ცოცხალ ქსელზე დამოკიდებული E2E ტესტისთვის, არა კოდის ხარვეზი.
- **ჩატის სურათის ატვირთვა (#68) — საბოლოოდ დამატებულია, Google Sign-In-ისგან განსხვავებით native picker-იც აღმოჩნდა საკმაოდ ავტომატიზირებადი.** თავდაპირველად ვივარაუდე, რომ native OS picker (Google Sign-In-ის იგივე კატეგორია) E2E scope-ის გარეთ დარჩებოდა — მაგრამ Android-ის თანამედროვე Photo Picker (`ACTION_PICK_IMAGES`, Android 13+) საერთოდ არ ითხოვს READ_MEDIA_IMAGES permission dialog-ს (სწორედ ეს არის ამ API-ის მთელი აზრი) და პირდაპირ იხსნება როგორც ჩვეულებრივი Android UI, Maestro-ს ჩვეულებრივი `tapOn`/`point`-ით სრულად მისადგომი. `chat_image_upload.yaml`-ს ესაჭიროება ერთი ხელით ნაბიჯი გაშვებამდე — ტესტ-სურათის `adb push` ემულატორის გალერეაში (README-ის თავშივე დოკუმენტირებული ბრძანება).
- **`provider_verification.yaml`-მა მხოლოდ ELIGIBILITY-GATING (უარყოფითი) გზა დაფარა, არა რეალური მოთხოვნის გაგზავნა** — `getVerificationEligibility()` მოითხოვს პროფილის ფოტოს (Task 3/#87), ფოტოს ატვირთვა კი native OS camera/gallery picker-ს საჭიროებს — იგივე მიზეზით, რის გამოც Google Sign-In-იც E2E scope-ის გარეთაა (native picker-ის ავტომატიზაცია არასაიმედოა). ეს flow ამოწმებს, რომ ახალი Provider-ისთვის (ფოტოს გარეშე) "დაასრულე პროფილი" გაფრთხილება სწორად ჩნდება, "პროფილის ფოტო" სიაშია, და ღილაკი რეალურად disabled-ია (ტაპი confirm-sheet-ს არ ხსნის) — თავად `request_provider_verification()` RPC-ის წარმატებული გაგზავნა/`pending`-ზე გადასვლა ცალკე, დაუმატებელი scope-ია.
- **`ProviderMyJobsScreen`-ის "დასრულებული" ტაბი E2E-ით არ დატესტილა** — `cross_role_job_lifecycle.yaml` job-ს `confirmed_awaiting_rating`-მდე (და `completed`-მდე, შეფასების გაგზავნის შემდეგ) მიჰყავს, მაგრამ Provider-ის მხრიდან ამ საბოლოო `completed` მდგომარეობის დათვალიერება ცალკე არ დამოწმებულა.
- **`post-job-fab`/`job-detail-menu-button`-ის fab/bubble collision — საბოლოოდ გადაწყვეტილია root cause-დონეზე.** dev-client-ის მუდმივი floating debug-ბუშტი ეკრანის ზედა-მარჯვენა კუთხეში ფიზიკურად, თითქმის სრულად ემთხვევა ორივე ამ icon-only ღილაკის `bounds`-ს (`uiautomator dump`-ით დადასტურებული — bubble `[902,174][1039,311]`, fab `[933,158][1038,263]`) — Maestro-ს `tapOn: id:` ბუშტს ეჯახებოდა **დეტერმინისტულად** (არა probabilistically — retry იმავე ცენტრზე არასდროს არ შველოდა), ხოლო identical raw `adb shell input tap`-ს იმავე კოორდინატებზე ეს პრობლემა არასდროს ჰქონდა (Maestro-ს accessibility-დაფუძნებული gesture dispatch სხვანაირად ურთიერთქმედებს ამ ოვერლეისთან). დადასტურებულია, რომ **არ არის აპის ბაგი** (იგივე მოხდა სრულად წაშლილ+ხელახლა დაინსტალირებულ აპზეც და მთლიანად `wipe`-ილ ემულატორზეც). **გადაწყვეტილება** — orივე ღილაკზე `tapOn: { id: "..." }`-ის ნაცვლად `tapOn: { point: "91-92%, 7%" }` (ღილაკის ზედა კიდე, ბუშტის sa `bounds`-ის ზემოთ) — ამან საბოლოოდ, სტაბილურად გაასწორა `job_cancellation.yaml`/`job_reports.yaml`/`chat_price_offer.yaml`/`cross_role_job_lifecycle.yaml`/`customer_core_journey.yaml`, ყველა ერთდროულად რამდენჯერმე ზედიზედ სუფთად გავლილი ამ ფიქსის შემდეგ.
