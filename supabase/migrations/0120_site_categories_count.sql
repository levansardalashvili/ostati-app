-- 0120: მთავარი გვერდის ბლოკი "15 კატეგორია" ჰარდქოდილი იყო, კატეგორიები კი ადმინიდან იცვლება ("სხვა" დაემატა → 16).
-- {{categories}} საიტზე აქტიური კატეგორიების რაოდენობით იცვლება.
update public.site_blocks set title = replace(title, '15', '{{categories}}')
 where block_key = 'home_features' and title like '15 კატეგორია%';

-- support გვერდის FAQ: შეკითხვა და პასუხი ცალკე აბზაცებად (markdown-ში ერთი ხაზის გადატანა ერთ აბზაცად ერწყმოდა)
update public.site_pages set content = replace(content, E'?**
', E'?**

')
 where slug = 'support' and position(E'?**

' in content) = 0;
