// TODO: ჩანაცვლდება Firestore-ის conversations/messages collections-ით.
// ჯერჯერობით — დიზაინის რეფერენსის mock მონაცემების ზუსტი ასლი (D1/D2).
import type { JobStatus } from '../components/StatusPill';

export type MsgState = 'sending' | 'sent' | 'read' | 'failed';

export type ChatMsg = {
  id: string;
  type: 'text' | 'image' | 'date';
  from: 'me' | 'other';
  text?: string;
  imgColor?: string;
  t?: string;
  state?: MsgState;
  label?: string;
};

export type ChatEntry = {
  id: string;
  name: string;
  initials: string;
  color: string;
  last: string;
  time: string;
  unread: number;
  online: boolean;
  jobId?: string;
  jobTitle?: string;
  jobCategory?: string;
  jobDistrict?: string;
  jobDate?: string;
  jobStatus?: JobStatus;
  jobBudget?: string;
};

export const CHATS_LIST: ChatEntry[] = [
  {
    id: 'p1',
    name: 'გიორგი ბერიძე',
    initials: 'გბ',
    color: '#2563EB',
    last: 'ვიქნები 15:55-ზე. ღირებ...',
    time: '10:37',
    unread: 2,
    online: true,
    jobId: 'j1',
    jobTitle: 'სანტექნიკის შეკეთება',
    jobCategory: 'plumbing',
    jobDistrict: 'ვაკე',
    jobDate: 'დღეს, 16:00',
    jobStatus: 'active',
    jobBudget: '120₾',
  },
  {
    id: 'p2',
    name: 'ნინო კვარაცხელია',
    initials: 'ნკ',
    color: '#A855F7',
    last: 'კარგი, ფოტოებს ვნახავ და გიტ...',
    time: 'გუშინ',
    unread: 0,
    online: false,
    jobId: 'j2',
    jobTitle: 'ოთახის მოხატვა',
    jobCategory: 'painting',
    jobDistrict: 'საბ.',
    jobDate: '20 დეკ.',
    jobStatus: 'pending',
    jobBudget: '300₾',
  },
  {
    id: 'p3',
    name: 'დავით ჩიქოვანი',
    initials: 'დჩ',
    color: '#CA8A04',
    last: 'სამუშაო დასრულდა ✓',
    time: '2 დ.',
    unread: 0,
    online: true,
    jobId: 'j3',
    jobTitle: 'ელ. გაყვანილობა',
    jobCategory: 'electrical',
    jobDistrict: 'დიდუბე',
    jobDate: '5 დეკ.',
    jobStatus: 'completed',
    jobBudget: '200₾',
  },
];

export const CHAT_MESSAGES: Record<string, ChatMsg[]> = {
  p1: [
    { id: 'd0', type: 'date', from: 'other', label: 'გუშინ' },
    { id: 'm1', type: 'text', from: 'other', text: 'გამარჯობა! ვნახე თქვენი განცხადება სანტექნიკის შეკეთებაზე.', t: '10:30', state: 'read' },
    { id: 'm2', type: 'text', from: 'me', text: 'გამარჯობა! დიახ, ონკანი გაჟონავს სამზარეულოში.', t: '10:31', state: 'read' },
    { id: 'm3', type: 'text', from: 'other', text: 'გავიგე. მინდა ვნახო ვიდეო ან ფოტო, თუ შეიძლება.', t: '10:32', state: 'read' },
    { id: 'm4', type: 'text', from: 'me', text: 'კარგი, ახლავე გამოგიგზავნი.', t: '10:33', state: 'read' },
    { id: 'm4i', type: 'image', from: 'me', imgColor: '#DBEAFE', t: '10:33', state: 'read' },
    { id: 'd1', type: 'date', from: 'other', label: 'დღეს' },
    { id: 'm5', type: 'text', from: 'other', text: 'ვნახე. შედარებით მარტივია. შემიძლია დღეს 16:00-ზე.', t: '10:35', state: 'read' },
    { id: 'm6', type: 'text', from: 'me', text: 'შესანიშნავია! 16:00 სრულიად შესაფერისია.', t: '10:36', state: 'read' },
    { id: 'm7', type: 'text', from: 'other', text: 'გავიგე. ვიქნები 15:55-ზე. ღირებულება დაახლ. 80–120₾.', t: '10:37', state: 'read' },
    { id: 'm8', type: 'text', from: 'me', text: 'ძალიან კარგი! გელოდებით.', t: '10:38', state: 'sent' },
  ],
  p2: [
    { id: 'd0', type: 'date', from: 'other', label: 'გუშინ' },
    { id: 'm1', type: 'text', from: 'me', text: 'გამარჯობა, გაქვთ გამოცდილება ოთახის მოხატვაში?', t: '14:20', state: 'read' },
    { id: 'm2', type: 'text', from: 'other', text: 'კი, 8 წელია ამ სფეროში ვარ. გამოგიგზავნეთ ფოტო?', t: '14:25', state: 'read' },
    { id: 'm3', type: 'text', from: 'me', text: 'კარგი, ფოტოებს ვნახავ და გიტყვი ფასს.', t: '14:30', state: 'read' },
  ],
  p3: [
    { id: 'd0', type: 'date', from: 'other', label: '5 დეკემბერი' },
    { id: 'm1', type: 'text', from: 'other', text: 'გამარჯობა, ვნახე განცხადება ელ. გაყვანილობაზე.', t: '09:00', state: 'read' },
    { id: 'm2', type: 'text', from: 'me', text: 'კი, სამ ოთახში განათება არ მუშაობს.', t: '09:05', state: 'read' },
    { id: 'm3', type: 'text', from: 'other', text: 'გასაგებია. შემიძლია დღეს 14:00-ზე.', t: '09:10', state: 'read' },
    { id: 'm4', type: 'text', from: 'me', text: 'შესანიშნავია, გელოდებით!', t: '09:12', state: 'read' },
    { id: 'm5', type: 'text', from: 'other', text: 'სამუშაო დასრულდა ✓', t: '17:06', state: 'read' },
    { id: 'm6', type: 'text', from: 'me', text: 'გმადლობთ, ყველაფერი კარგადაა!', t: '17:10', state: 'read' },
  ],
};
