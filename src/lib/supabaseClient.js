import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mcuvroeokrjefkywjpcz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jdXZyb2Vva3JqZWZreXdqcGN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMzc1OTcsImV4cCI6MjEwMjgxMzU5N30.wyPQdDsHhr7LcbNwI_fLNvq46VAe3MNGPACB0P8sNes';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
