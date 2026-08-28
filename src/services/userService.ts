import type { CustomerProfile } from '../types/user';
import type { Provider, ProviderProfile } from '../types/provider';
import { PROVIDERS } from '../data/mockHomeData';

const DEFAULT_CUSTOMER_PROFILE: CustomerProfile = {
  firstName: 'ნინო',
  lastName: 'სულაბერიძე',
  email: 'nino.sulaberidze@gmail.com',
  defaultAddress: 'ვაკე, თბილისი',
};

const DEFAULT_PROVIDER_PROFILE: ProviderProfile = {
  firstName: 'გიორგი',
  lastName: 'ბერიძე',
  specialty: [{ id: 'plumber', label: 'სანტექნიკოსი' }],
  areas: ['ვაკე', 'საბურთალო', 'ვერა'],
  experience: '10plus',
  about: 'ვარ სანტექნიკოსი 15 წლიანი გამოცდილებით. ვასრულებ ყველა სახის სანტექნიკის სამუშაოს სწრაფად და ხარისხიანად.',
  hasPhoto: false,
  certificates: [{ id: 1, bg: '#DBEAFE' }],
  portfolio: [
    { id: 1, bg: '#D1FAE5' },
    { id: 2, bg: '#FEF3C7' },
    { id: 3, bg: '#FCE7F3' },
  ],
  sqmPrices: {},
};

// მარტივი module-level "in-memory db" — ერთადერთი ლოკალური მომხმარებელია
// დღევანდელ დემოში (auth ჯერ არ არსებობს), ამიტომ საკმარისია React state-ის
// გარეთ. CustomerProfileContext/ProviderProfileContext კვლავ თავად ინახავენ
// რეაქტიულ ასლს (useState) და ამ სერვისის მეშვეობით კითხულობენ/წერენ —
// განზრახ სინქრონული, რომ Context-ის setState-ის timing არ შეიცვალოს.
let customerProfile: CustomerProfile = { ...DEFAULT_CUSTOMER_PROFILE };
let providerProfile: ProviderProfile = { ...DEFAULT_PROVIDER_PROFILE };

export interface UserService {
  getCustomerProfile(): CustomerProfile;
  updateCustomerProfile(patch: Partial<CustomerProfile>): CustomerProfile;
  getProviderProfile(): ProviderProfile;
  updateProviderProfile(patch: Partial<ProviderProfile>): ProviderProfile;
  // საჯარო Provider დირექტორია (Customer-ის მხრიდან ხილული ოსტატები).
  listProviders(): Provider[];
  getProviderById(id: string): Provider | undefined;
}

// TODO: ჩანაცვლდება Firestore-ის users/{uid} და providerProfiles/{uid}
// დოკუმენტებით (auth-ის დაკავშირების შემდეგ). დღეს — ლოკალური mock state
// + PROVIDERS-ის საჯარო დირექტორია.
export const userService: UserService = {
  getCustomerProfile: () => customerProfile,
  updateCustomerProfile: (patch) => {
    customerProfile = { ...customerProfile, ...patch };
    return customerProfile;
  },
  getProviderProfile: () => providerProfile,
  updateProviderProfile: (patch) => {
    providerProfile = { ...providerProfile, ...patch };
    return providerProfile;
  },
  listProviders: () => PROVIDERS,
  getProviderById: (id) => PROVIDERS.find((p) => p.id === id),
};
