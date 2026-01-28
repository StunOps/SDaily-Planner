import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Check if we have valid Supabase credentials (not placeholders)
const hasValidCredentials = supabaseUrl &&
  supabaseAnonKey &&
  (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))

// Mock client for SSR/build time when env vars aren't available or invalid
const mockClient = {
  from: () => ({
    select: () => ({ order: () => Promise.resolve({ data: [], error: null }), eq: () => Promise.resolve({ data: [], error: null }), single: () => Promise.resolve({ data: null, error: null }) }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    eq: () => Promise.resolve({ data: [], error: null }),
    order: () => Promise.resolve({ data: [], error: null }),
  }),
} as unknown as SupabaseClient

// Export supabase client - uses mock if env vars not configured properly
export const supabase: SupabaseClient = hasValidCredentials
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : mockClient

// Helper for runtime access
export function getSupabase(): SupabaseClient {
  return supabase
}

