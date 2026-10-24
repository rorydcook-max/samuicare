// Full Supabase client — imported only by the admin area so it stays out of the public bundle.
import { createClient } from "@supabase/supabase-js";
import { DEMO, SB_KEY, SB_URL } from "./api";

export const supabase = DEMO ? null : createClient(SB_URL, SB_KEY);
