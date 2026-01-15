import { createClient } from '@supabase/supabase-js';

// Priority: Vite Env -> Optional Fallback
const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string) || '';
const supabaseKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ Supabase URL or Key not found in environment variables. Application cannot function correctly without them.');
    // In a production environment, you might want to throw an error or disable Supabase functionality.
    // For now, we'll export a dummy client or handle it gracefully.
    // throw new Error('Supabase environment variables are missing.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
