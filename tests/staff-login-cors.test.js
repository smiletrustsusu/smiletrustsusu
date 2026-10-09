/**
 * Browsers, the Capacitor WebView and Electron pages call the staff-login Edge Function cross-origin,
 * so every request header the client sends must be in the function's CORS allow-list or the
 * preflight fails and cloud sign-in is unavailable. The function writes with its own service key,
 * so it does not need the 048 write-protocol declaration.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { staffCloudLogin } from "../src/sync/staff-session.js";
import { createStaffLoginHandler } from "../supabase/functions/staff-login/handler.js";
import { supabaseKeyHeaders } from "../src/sync/supabase-headers.js";

const state = { settings: { cloudUrl: "https://example.supabase.co", cloudKey: "sb_publishable_x", businessId: "SMILE-TRUST" } };

async function allowedHeaders() {
  const handler = createStaffLoginHandler({ env: { SUPABASE_URL: "https://example.supabase.co" }, fetchImpl: async () => { throw new Error("no network"); } });
  const response = await handler(new Request("https://example.supabase.co/functions/v1/staff-login", {
    method: "OPTIONS",
    headers: { Origin: "https://localhost", "Access-Control-Request-Method": "POST" }
  }));
  return new Set(String(response.headers.get("Access-Control-Allow-Headers") || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean));
}

test("every header sent to the staff-login function passes its CORS preflight", async () => {
  let sent = null;
  await staffCloudLogin(state, { username: "kwame", password: "x" }, {
    fetchImpl: async (url, options) => { sent = { url, headers: options.headers }; return new Response("{}", { status: 401 }); }
  });
  assert.ok(sent && /\/functions\/v1\/staff-login$/.test(sent.url));
  const allowed = await allowedHeaders();
  const notAllowed = Object.keys(sent.headers).map((h) => h.toLowerCase()).filter((h) => !allowed.has(h));
  assert.deepEqual(notAllowed, [], "headers the browser would have to preflight but the function does not allow");
});

test("REST requests still declare the 048 write protocol", () => {
  assert.equal(supabaseKeyHeaders("sb_publishable_x", { bearer: "staff-token" })["x-smile-write-protocol"], "048-v1");
  assert.equal(supabaseKeyHeaders("legacy-key")["x-smile-write-protocol"], "048-v1");
});
