// ოსტატის მიღებული ერთი შეფასება (საჯარო პროფილზე/ჩემი შეფასებების
// ეკრანზე ჩანს).
export type Review = { name: string; stars: number; date: string; text: string };

// Customer-ის მიერ job-ის დასრულებისას გაგზავნილი შეფასების ფორმა
// (RatingScreen-ის შედეგი).
export type RatingData = {
  stars: number;
  review: string;
  chips: string[];
  // დასრულებული სამუშაოს ფოტო Customer-ისგან (არასავალდებულო) — RatingScreen-ზე
  // ატვირთული, MediaItem-ის იგივე {id, bg} mock ფორმატი.
  photos?: { id: number; bg: string }[];
};
