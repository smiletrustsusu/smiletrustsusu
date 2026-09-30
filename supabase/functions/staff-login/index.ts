// Supabase Edge Function: staff-login
// Deploy: supabase functions deploy staff-login --no-verify-jwt
// Uses SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY from the function environment
// (injected by Supabase). Projects that use the new API keys can instead set the function secrets
// STAFF_LOGIN_PUBLIC_KEY (sb_publishable_...) and STAFF_LOGIN_SERVICE_KEY (sb_secret_...).
// Optional: STAFF_EMAIL_DOMAIN for the synthetic Auth identities.
import { createStaffLoginHandler } from "./handler.js";

Deno.serve(createStaffLoginHandler({ env: Deno.env.toObject(), fetchImpl: fetch }));
