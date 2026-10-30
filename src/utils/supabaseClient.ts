/**
 * Supabase Client Configuration
 * Provides direct connection to Supabase PostgreSQL & Auth services.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_URL.trim() !== '' &&
    !SUPABASE_URL.includes('[YOUR-PROJECT-REF]') &&
    SUPABASE_ANON_KEY &&
    SUPABASE_ANON_KEY.trim() !== ''
  );
};

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Jurisdiction Query Scoping Helper (Data Privacy Act / RA 10173 Compliance)
 * Ensures that client-side queries strictly scope to the active barangay jurisdiction
 * so records from other barangays never leave the Supabase database server.
 *
 * Example:
 *   const { data } = await queryJurisdiction('households', currentBarangay);
 */
export const queryJurisdiction = (tableName: string, barangay: string) => {
  if (!supabase) return null;
  return supabase.from(tableName).select('*').eq('barangay', barangay);
};
