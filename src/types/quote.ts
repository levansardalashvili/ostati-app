import type { Provider } from './provider';

// ფასის შეთავაზების სტატუსი — ორივე გამოვლინებისთვის საერთო (იხ. ქვემოთ).
// src/types/chat.ts-ის `OfferStatus` ამის ალიასია (ChatMsg-ის 'offer' ტიპის
// შეტყობინების status ველისთვის, `messages.offer_status`-ის ანარეკლი).
export type QuoteStatus = 'pending' | 'accepted' | 'declined';

// Provider-ის მიერ კონკრეტულ job-ზე გამოთქმული ინტერესი + სავალდებულო,
// კონკრეტული რიცხვითი ფასი ("დაინტერესებისას", ProviderJobDetailScreen-ის
// დაინტერესების sheet-იდან) — job_responses-ის ჩანაწერის ფორმა. #72-ის
// მიხედვით Provider ყოველთვის კონკრეტულ რიცხვს წარადგენს (არა
// თავისუფალი ტექსტი/optional) — "ფასი სამუშაოს ნახვის შემდეგ
// განისაზღვრება" აღარ არსებობს, როგორც ცნება.
// "quote"-ის მეორე გამოვლინებაა ჩატის სტრუქტურირებული ფასის შეთავაზების
// ბარათი (ChatMsg-ის type:'offer', src/types/chat.ts) — ეს ორი ცალკე
// ცხოვრობს (ერთი job-ის დონეზეა, მეორე კონკრეტულ საუბარშია), მაგრამ ერთი
// კონცეფციის ორი გამოვლინებაა.
export type JobQuote = {
  provider: Provider;
  // undefined მხოლოდ ისტორიულ (migration-მდელ) response-ებზეა შესაძლებელი,
  // რომლებსაც არასდროს ჰქონდათ ვალიდური ფასი — ასეთი response ვერასდროს
  // აირჩევა (select_provider() RPC-ი უარყოფს), მაგრამ სიაში კვლავ ჩანს.
  offeredPrice?: number;
};
