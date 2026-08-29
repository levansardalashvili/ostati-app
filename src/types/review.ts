// ოსტატის მიღებული ერთი შეფასება
export type Review = {
  name: string;
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
