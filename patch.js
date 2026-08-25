const fs = require('fs');
let code = fs.readFileSync('src/lib/supabase.ts', 'utf8');
code = code.replace(/\/\/ --- AUTO-HEAL LEGACY BUG ---\n\s*\/\/ If the database was polluted by the old bug, immediately patch it in memory\.\n\s*if \(name === 'Default Company'\) \{\n\s*name = 'CIEN Motors';\n\s*short = 'CIEN';\n\s*\/\/ Fire and forget auto-heal back to Supabase\n\s*client\.from\('companies'\)\.update\(\{ company_name: name, short_name: short \}\)\.eq\('id', row\.id\)\.then\(\);\n\s*\}/, '');
fs.writeFileSync('src/lib/supabase.ts', code);
