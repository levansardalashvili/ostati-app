const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// მრავალ ეკრანზე გამოსაყენებელი შემოწმება, არის თუ არა id ნამდვილი Supabase
// UUID (auth.users.id) თუ mock-სტაბი (მაგ. 'p1', 'j2') — რომ რეალურ
// backend-ზე ჩაწერა/წაკითხვა მხოლოდ ნამდვილ ჩანაწერებზე ვცადოთ, mock
// demo-ს დაზიანების გარეშე.
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
