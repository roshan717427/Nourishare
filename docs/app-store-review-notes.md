# App Store Connect checklist (Nourishare)

## Before submit

- [ ] Publish Privacy Policy + Terms of Service as one public Google Doc (“Publish to web” or anyone-with-link view). Confirm the HTTPS URL opens without signing in.
- [ ] Point `config/legal.js` (`PRIVACY_POLICY_URL` and `TERMS_OF_SERVICE_URL`) at that Google Doc URL (same URL for both is fine).
- [ ] Publish Support Google Doc from `docs/nourishare-support.md`; set `SUPPORT_URL` in `config/legal.js` and App Store Connect → Support URL to that link.
- [ ] App Store Connect → App Privacy → set Privacy Policy URL to the Google Doc link.
- [ ] Age rating questionnaire: target **13+** (UGC with filtering + report/block; no unrestricted mature content).
- [ ] Review Notes: paste text from [moderation-sop.md](./moderation-sop.md); include demo username/password.
- [ ] Confirm Firestore quota reset or Blaze so reviewers are not blocked at 50k reads/day.
- [ ] Redeploy Vercel API after merging safety changes.
- [ ] Ship a new iOS build that includes Terms acceptance, Report/Block, AI disclaimer, and delete-account UX.

## Reviewer walkthrough

1. Sign up or use demo account (accept Terms).
2. Open Home feed → post menu → **Report**.
3. Open a profile → **Block** (content from that user should disappear from feed).
4. AI Suggestions → read food-safety disclaimer; generate suggestions.
5. Profile → Account Settings → **Delete account** (use a disposable test account).
