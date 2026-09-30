// Supabase Edge Function: staff-login
// Deploy: supabase functions deploy staff-login
// Uses SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the function environment
// (injected by Supabase). Optional: STAFF_EMAIL_DOMAIN for the synthetic Auth identities.
import { createStaffLoginHandler } from "./handler.js";

Deno.serve(createStaffLoginHandler({ env: Deno.env.toObject(), fetchImpl: fetch }));
