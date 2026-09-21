/**
 * Wave 3 repository factory — local SoT + optional Wave 2 RPC dual-write.
 */

import { createLocalRepository } from "./local-repository.js";
import { createSupabaseRpcRepository, cloudPersistenceEnabled } from "./supabase-rpc-repository.js";

export { createLocalRepository, createSupabaseRpcRepository, cloudPersistenceEnabled };

export function createRepositories(state) {
  return {
    local: createLocalRepository(state),
    supabase: createSupabaseRpcRepository(state),
    cloudEnabled: () => cloudPersistenceEnabled(state)
  };
}
