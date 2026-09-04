# E2E ტესტები (Maestro)

## გაშვება

```bash
maestro test .maestro/flows/customer_core_journey.yaml
maestro test .maestro/flows/provider_core_journey.yaml
maestro test .maestro/flows/cross_role_job_lifecycle.yaml
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
- **`cross_role_job_lifecycle.yaml` თავად ქმნის ორივე (Customer + Provider) ანგარიშსაც და job-საც** — არცერთ სხვა flow-ზე არ არის დამოკიდებული, სუფთა ბაზაზეც დამოუკიდებლად გაეშვება.

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
- **`hideKeyboard` ჩატის კომპოზერში არასაიმედოა Android-ზე** — ორი დაპირისპირებული failure-ი დაფიქსირდა: ერთხელ Georgian Gboard-მა send-ღილაკი მთლიანად ეკრანს გარეთ დაფარა (`hideKeyboard` საჭირო აღმოჩნდა), მეორედ იგივე `hideKeyboard` ქცევა back-press-ად "გადაიქცა" და chat-ის ეკრანიდან სრულად გამოვიდა (keyboard უკვე ჩაკეტილი აღმოჩნდა იმ მომენტში). გადაწყვეტა — `hideKeyboard`-ის ნაცვლად `tapOn: { point: "50%, 25%" }` (ცარიელ, non-interactive კოორდინატზე ტაპი) — ეს ყოველთვის მხოლოდ input-ს აცილებს ფოკუსს (keyboard-ს კეტავს, თუ ღიაა), არასდროს არ ნავიგირებს, მიუხედავად keyboard-ის რეალური მდგომარეობისა.

## ნაპოვნი რეალური ბაგები (E2E-ის თავად ამ პროცესში აღმოჩენილი)

- **`job_posts.provider_name` column missing** — `supabase/migrations/0068`. Live-DB-ის drift `job_posts`-ის CREATE TABLE-სა და ცოცხალ ბაზას შორის.
- **`provider_profiles`-ის UPDATE grant** — `supabase/migrations/0069`. ცოცხალ ბაზაზე 0026-ის column-scoped grant არასდროს ჩაირთო სრულად.
- **`userService.upsertProviderProfileRecord`-ის `.upsert()` სისტემურად ვერასდროს იმუშავებდა column-scoped UPDATE grant-ით** — დადასტურებულია REST-ით პირდაპირ: plain `.insert()`/`.update()` მუშაობს, `INSERT ... ON CONFLICT DO UPDATE` კი Postgres-ს ყოველთვის ითხოვს table-level UPDATE-ს, column-level საკმარისი არაა. **გასწორებულია კოდში** (`src/services/userService.ts`) — update-პირველ, insert-fallback პატერნზე გადასვლით (ორივე plain statement-ია) — ეს იყო ის ბაგი, რის გამოც **ყოველი ახალი Provider-ის რეგისტრაცია რეალურად ვერასდროს სრულდებოდა production-ში** მანამ, სანამ Maestro-ს ეს flow არ დაწერილა და გაშვებულა.

## ცნობილი შეზღუდვები

- **Google Sign-In flow-ები E2E scope-ს გარეთაა** — Google-ის საკუთარი ბოტ-დაცვა ბლოკავს ავტომატიზაციას საიმედოდ.
- **ცალკეული, იშვიათი ქსელური "blip"-ები** (Supabase auth-ის მოთხოვნა ჩავარდება ერთხელ, retry-ზე მუშაობს) — დაფიქსირდა რამდენჯერმე მთელი სესიის განმავლობაში (`customer_core_journey`/`provider_core_journey`-ის ტესტვისას, და `cross_role_job_lifecycle`-ის აშენებისას — ერთხელ registration-ზე, ერთხელ login-ზე), ყოველთვის დამოუკიდებელი raw REST call-ით დადასტურდა, რომ ბექენდი თავად ჯანმრთელი იყო იმ მომენტში (200 OK, retry-ზე flow-იც უცვლელად გაივლიდა) — ეს დამახასიათებელია ცოცხალ ქსელზე დამოკიდებული E2E ტესტისთვის, არა კოდის ხარვეზი.
- **`cross_role_job_lifecycle.yaml`-ი ჩატის ერთ ტექსტურ შეტყობინებას (თითო მიმართულებით) ამოწმებს, არა ფასის შეთავაზებას/სურათს** — D3 (structured offer card, გადაწყვეტილება #2) და ჩატის სურათის ატვირთვა (#68) ცალკე, დამატებითი E2E scope-ია, ამ flow-ში არ შედის.
- **`ProviderMyJobsScreen`-ის "დასრულებული" ტაბი E2E-ით არ დატესტილა** — `cross_role_job_lifecycle.yaml` job-ს `confirmed_awaiting_rating`-მდე (და `completed`-მდე, შეფასების გაგზავნის შემდეგ) მიჰყავს, მაგრამ Provider-ის მხრიდან ამ საბოლოო `completed` მდგომარეობის დათვალიერება ცალკე არ დამოწმებულა.
