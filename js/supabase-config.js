/**
 * ekRAAH - Supabase Configuration
 * 
 * IMPORTANT: Replace the placeholder values below with your actual
 * Supabase project URL and anon key from your Supabase dashboard.
 * 
 * You can find these at: https://app.supabase.com → Your Project → Settings → API
 */

const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';

// Initialize Supabase client
const supabase = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (!supabase) {
  console.error('Supabase client library not loaded. Please check the CDN link.');
}

// Export for use across the application
window.EkraahDB = supabase;
