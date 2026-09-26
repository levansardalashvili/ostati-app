// attack-site.sql-ის შედეგის კომპაქტური ჩვენება (stdin-ზე CLI-ის JSON)
let s = '';
process.stdin.on('data', (d) => (s += d)).on('end', () => {
  const i = s.indexOf('{');
  try {
    const j = JSON.parse(s.slice(i));
    if (!j.rows) { console.log(s.slice(0, 3000)); return; }
    const rows = j.rows;
    const bad = rows.filter((r) => r.r.startsWith('ᲨᲔᲡ'));
    const warn = rows.filter((r) => r.r.startsWith('გაფრ'));
    console.log('სულ:', rows.length, '| ხვრელი:', bad.length, '| გაფრთხილება:', warn.length);
    bad.forEach((r) => console.log('!!', r.t, '=>', r.r));
    warn.forEach((r) => console.log('~~', r.t, '=>', r.r));
    console.log('--- დანარჩენი');
    rows.filter((r) => !r.r.startsWith('ᲨᲔᲡ') && !r.r.startsWith('გაფრ')).forEach((r) => console.log(r.t, '=>', r.r));
  } catch (e) {
    console.log(s.slice(0, 3000));
  }
});
