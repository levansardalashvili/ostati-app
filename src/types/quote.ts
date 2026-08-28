import type { Provider } from './provider';

// ფასის შეთავაზების სტატუსი — ორივე გამოვლინებისთვის საერთო (იხ. ქვემოთ).
// src/types/chat.ts-ის `OfferStatus` ამის ალიასია (ChatMsg-ის 'offer' ტიპის
// შეტყობინების status ველისთვის), რომ არსებული `mockChats.ts`/
// `ChatConversationScreen.tsx` ხელუხლებელი დარჩეს.
export type QuoteStatus = 'pending' | 'accepted' | 'declined';

// Provider-ის მიერ კონკრეტულ job-ზე გამოთქმული ინტერესი + არასავალდებულო
// ხელით შეთავაზებული ფასი ("დაინტერესებისას", ProviderJobDetailScreen-ის
// daინტერესების sheet-იდან) — INTERESTED_PROVIDERS-ის ჩანაწერის ფორმა.
// "quote"-ის მეორე გამოვლინებაა ჩატის სტრუქტურირებული ფასის შეთავაზების
// ბარათი (ChatMsg-ის type:'offer', src/types/chat.ts) — ეს ორი ცალკე
// ცხოვრობს (ერთი job-ის დონეზეა, მეორე კონკრეტულ საუბარშია), მაგრამ ერთი
// კონცეფციის ორი გამოვლინებაა.
export type JobQuote = {
  provider: Provider;
  offeredPrice?: string;
};
