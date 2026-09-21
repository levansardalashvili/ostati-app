// ოსტატის მიღებული ერთი შეფასება
// ანონიმურია — ავტორის ვინაობა არასდროს ინახება/ჩანს (0085)
export type Review = {
  id?: string;
  reply?: string | null; // ოსტატის პასუხი (0100)
  stars: number;
  date: string;
  text: string;
};

// დასრულებული სამუშაოს ფოტო
export type RatingPhoto = {
  id: number;
  bg: string;
  uri?: string;
};

// Customer-ის მიერ job-ის დასრულებისას გაგზავნილი შეფასების ფორმა
export type RatingData = {
  stars: number;
  review: string;
  chips: string[];
  photos?: RatingPhoto[];
};
