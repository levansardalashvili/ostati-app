-- 0136: 0135-ში დამატებული allowed_mime_types მოიხსნა public bucket-ებიდან (job-photos, user-media).
-- მიზეზი: აპი ფაილს ატვირთავს contentType = blob.type || 'image/jpeg'-ით, ხოლო React Native-ზე blob.type ზოგჯერ
-- სურათის ტიპი არ არის (მაგ. application/octet-stream) — შეზღუდვამ პროფილის/სერთიფიკატების ატვირთვა გატეხა
-- (Maestro provider_profile_extras აღმოაჩინა: "პროფილის შენახვა ვერ მოხერხდა"). ძველი აპის ვერსიები ცოცხალ
-- მომხმარებლებთან იგივე კოდს იყენებს, ამიტომ ბაზის მხრიდან ტიპის შეზღუდვა უსაფრთხოდ ვერ ჩაირთვება, სანამ
-- კლიენტი contentType-ს გაფართოებით (ext → image/*) არ დააზუსტებს და ყველა მომხმარებელი არ განახლდება.
-- ზომის ლიმიტი (15 მბ) რჩება.
update storage.buckets set allowed_mime_types = null where id in ('job-photos', 'user-media');
