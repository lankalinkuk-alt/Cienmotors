import { createClient } from '@supabase/supabase-js';

const rawCreds = localStorage.getItem('busy_ufo_supabase_creds') || 'null'; // We don't have local storage in Node.js
