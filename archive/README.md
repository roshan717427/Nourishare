# Archive

Unused / alternate backends kept for reference. **None of these are the live
backend.** The production backend is the Vercel serverless API in the
repo-root `api/` directory.

## `flask/`

An early Flask prototype of the backend.

- `app.py` — Flask application with the original route implementations.
- `firestore_connect.py` — Firestore client setup used by `app.py`.

Not deployed anywhere. It includes a couple of features that were never ported
to the Vercel API (e.g. like/comment on recipes, re-cook recipes).

## `functions/`

A Firebase Cloud Functions implementation (Python + a JS stub).

- Python: `main.py`, `kitchen_personality.py`, `index.py`, tests, `requirements.txt`
- JS: `index.js`, `.eslintrc.js`, `.gitignore`

### Note on `firebase.json`

The root `firebase.json` `functions.source` field has been updated to point at
`archive/functions` so it no longer references a nonexistent path. If Firebase
Functions deployment is ever resumed, move this directory back to the repo root
(or keep it here and confirm `firebase.json` still points at `archive/functions`).
