import fs from 'fs';
let c = fs.readFileSync('src/lib/supabase.ts', 'utf8');
let start = c.indexOf('async function ensureCompanyExists');
let end = c.indexOf('}', start + 100);
while (c.substring(start, end).split('{').length !== c.substring(start, end).split('}').length) {
    end = c.indexOf('}', end + 1);
}
console.log(c.substring(start, end + 1));
