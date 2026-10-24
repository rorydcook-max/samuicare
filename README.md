# Samui Care

Marketing site + instant-quote booking for Samui Care (Koh Samui cleaning).

- Frontend: Vite + React + Tailwind (`src/`), hosted on Netlify (`netlify.toml`).
- Backend: Supabase project `tqeylnllbmptwzyelqkn` (Singapore). Public site talks only to the
  `public-api` edge function (`supabase/functions/public-api`).
- Pricing and slot engines live in `src/lib/pricing.ts` and `src/lib/slots.ts`; run `npm run sync`
  to copy them into the edge function, and `npm test` to run the checks.

Notification secrets (set in Supabase → Edge Functions → Secrets): RESEND_API_KEY, FROM_EMAIL,
TEAM_EMAIL, LINE_CHANNEL_TOKEN, LINE_GROUP_ID.
