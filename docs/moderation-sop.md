# Nourishare UGC moderation SOP (24-hour)

**Goal:** Review user reports and remove abusive content within **24 hours**.  
**Tooling:** Firebase Console → Firestore → `reports` collection. No separate admin app.

## Daily checklist

1. Open [Firebase Console](https://console.firebase.google.com/) → project **munchable-465d2** → **Firestore**.
2. Open collection `reports`.
3. Filter or scan documents where `status == "open"` (sort by `createdAt` if needed).
4. For each open report:
   - Read `targetType`, `targetId`, `targetUsername`, `reason`, `reporterUsername`.
   - Inspect the reported post (`logs` / `recipe_posts`), comment (`post_comments/.../items`), or profile (`users/...`).
   - **Action options:**
     - Delete the offensive document(s).
     - Ban: delete or disable the offender’s Auth user and/or delete their `users/{username}` profile (prefer in-app Delete Account flow patterns / Auth console disable).
     - If not a violation: leave content, set report `status` to `dismissed`.
   - Set report fields: `status: "resolved"` or `"dismissed"`, `resolvedAt: <ISO timestamp>`, `moderatorNote: <short note>`.
5. Confirm no `status: "open"` reports older than 24 hours remain.

## App Review notes (paste into App Store Connect)

> Nourishare supports user-generated recipes, photos, and comments. Users must accept Terms at signup (zero tolerance for explicit images, bullying, and hate). In-app Report and Block are available on posts, comments, and profiles. Reports are stored in Firestore (`reports`) and reviewed in the Firebase Console within 24 hours. Automated profanity filtering and Gemini-based image checks reject severe content on upload when available. AI suggestions include a food-safety disclaimer.

## Image moderation (Spark-compatible)

Photo uploads are checked with the existing **Gemini API key** (`GEMINI_API_KEY` on Vercel), not Cloud Vision. That keeps Firebase on the **Spark** plan (no Blaze / Vision billing).

- Implementation: `api/_helpers/imageSafety.js`
- If Gemini is down or unset, uploads are allowed and Report/Block + your 24h Console review still apply.
- Optional: `SKIP_IMAGE_SAFETY=1` on Vercel only for emergency bypass (avoid for App Review).

