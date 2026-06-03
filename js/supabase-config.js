/**
 * ekRAAH - Supabase Configuration
 *
 * IMPORTANT: Replace the placeholder values below with your actual
 * Supabase project URL and anon key from your Supabase dashboard.
 *
 * You can find these at: https://app.supabase.com → Your Project → Settings → API
 */

const SUPABASE_URL = 'https://mmegcrceiixduqpwixoe.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tZWdjcmNlaWl4ZHVxcHdpeG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzOTIyNjgsImV4cCI6MjA5NTk2ODI2OH0.S82-Qh0xGH2ZkPMKBNMt-VlVBB2ZiaBWH3JV-1y4zXM';

// Initialize Supabase client
const supabase = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!supabase) {
    console.error('Supabase client library not loaded. Please check the CDN link.');
}

// Export for use across the application
window.EkraahDB = supabase;
