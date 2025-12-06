// supabase-config.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Replace with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://bzniniijmwrakgwjthyo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bmluaWlqbXdyYWtnd2p0aHlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTE0MjUsImV4cCI6MjA3ODk2NzQyNX0.Zn7qQ0EUixt5132FjrAhvjqQMoyB30Cl7D7LHLk8xU8';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
