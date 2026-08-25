import fs from 'fs';
const raw = fs.readFileSync('src/lib/supabase.ts', 'utf8');
console.log(raw.match(/fetchAllRemoteCompanies[\s\S]*?(?=\n  async)/)[0]);
