import { createClient } from '@supabase/supabase-js';

// Hardcoded for direct deployment success. 
// Security is handled via Supabase RLS policies and E2EE.
const supabaseUrl = 'https://lbublvuplzgcuwlribth.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxidWJsdnVwbHpnY3V3bHJpYnRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMDQyOTQsImV4cCI6MjA5MjU4MDI5NH0.hIbEBXS7H3qJeqQGq31vnDCshcL_-LzZz-G2P3pYYJw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
