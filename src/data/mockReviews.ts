// TODO: ჩანაცვლდება Firestore-ის reviews collection-ით.
// ზუსტად აღებულია დიზაინის რეფერენსის (ზიპის App.tsx)
// PROVIDER_REVIEWS/PROVIDER_COMPLETED_JOBS-იდან.
// ტიპები src/types/review.ts და src/types/job.ts-შია (domain models
// refactor) — ეს ფაილი მხოლოდ მონაცემებია, reviewService.ts/jobService.ts-ის
// მეშვეობით გამოყენებული.
import type { CompletedJob, MyJobRow } from '../types/job';
import type { Review } from '../types/review';

export const PROVIDER_REVIEWS: Record<string, Review[]> = {
  p1: [
    { name: 'ნინო', stars: 5, date: '2 დ. წინ', text: 'ძალიან კარგი ოსტატი. სწრაფად მოვიდა და პრობლემა 30 წუთში გადაჭრა.' },
    { name: 'გიორგი', stars: 5, date: '1 კვ. წინ', text: 'კარგი სამუშაო, ფასი გონივრულია, ვადებს იცავს.' },
    { name: 'ანა', stars: 4, date: '3 კვ. წინ', text: 'ოდნავ დაგვიანდა, მაგრამ სამუშაო ხარისხიანია.' },
  ],
  p2: [
    { name: 'ლელა', stars: 5, date: '5 დ. წინ', text: 'შესანიშნავი შედეგი! ოთახი ძალიან ლამაზი გამოვიდა.' },
    { name: 'მარინე', stars: 5, date: '2 კვ. წინ', text: 'ეკო-საღებავებით სამუშაოს ხარისხი მაღალია, ძალიან კმაყოფილი ვარ.' },
  ],
  p3: [
    { name: 'ბესო', stars: 5, date: '1 დ. წინ', text: 'სერტიფიცირებული პროფი. სამუშაო ჩაიდინა სტანდარტის შესაბამისად.' },
    { name: 'ნუნუ', stars: 4, date: '1 კვ. წინ', text: 'კარგი ელექტრიკოსი, სწრაფი და სანდო.' },
    { name: 'ირა', stars: 5, date: '2 კვ. წინ', text: 'ძალიან გამოცდილი, ახსნა ყველაფერი რაც გააკეთა.' },
  ],
  p4: [
    { name: 'სოფია', stars: 5, date: '3 დ. წინ', text: 'ავეჯი ზუსტად ისე მოეწყო, როგორც გვინდოდა. პროფესიონალი.' },
    { name: 'ეკა', stars: 5, date: '2 კვ. წინ', text: 'რესტავრაცია შესანიშნავი გამოვიდა, ძველი ავეჯი ახალივით.' },
  ],
};

export const PROVIDER_COMPLETED_JOBS: CompletedJob[] = [
  { id: 'c1', category: 'plumbing', title: 'ონკანის გამოცვლა სამზარეულოში', district: 'ვაკე', date: '2 დ. წინ', rating: 5 },
  { id: 'c2', category: 'plumbing', title: 'სანტექნიკის სისტემის მონტაჟი', district: 'საბურთალო', date: '1 კვ. წინ', rating: 5 },
  { id: 'c3', category: 'plumbing', title: 'გათბობის სისტემის შეკეთება', district: 'ვერა', date: '2 კვ. წინ', rating: 4 },
  { id: 'c4', category: 'plumbing', title: 'ვანის ოთახის სრული გადაკეთება', district: 'მთაწმინდა', date: '1 თვ. წინ', rating: 5 },
  { id: 'c5', category: 'plumbing', title: 'წყლის ლაინის შეკეთება', district: 'ისანი', date: '1.5 თვ. წინ', rating: null },
];

export const PROVIDER_MY_JOBS_ACTIVE: MyJobRow[] = [
  { title: 'ონკანის შეკეთება', customer: 'ნინო სულ.', addr: 'ვაკე, ჭავჭავ. 45', when: 'დღეს 16:00', pay: '120₾' },
  { title: 'გათბობის სისტ.', customer: 'ლევან მახ.', addr: 'საბ., გორგ. 7', when: 'ხვალ 10:00', pay: '800₾' },
];

export const PROVIDER_MY_JOBS_DONE: MyJobRow[] = [
  { title: 'ონკანის გამოც.', customer: 'ანა კობ.', addr: 'დიდუბე', when: '2 დ. წ.', pay: '90₾' },
  { title: 'სველი წ. სარ.', customer: 'გ. ახობ.', addr: 'ისანი', when: '5 დ. წ.', pay: '600₾' },
];
