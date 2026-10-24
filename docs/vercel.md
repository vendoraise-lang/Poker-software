# Publish PokerLab on Vercel Hobby

PokerLab uses Vercel's native Next.js hosting. No additional application code, database, paid API, storage service or environment variables are needed. The Node engine is pinned to `24.x`, matching the tested release. No custom build/output-directory override is necessary.

## Import from GitHub

1. Sign in to Vercel and use a **personal account on the free Hobby plan**. Do not select a Pro trial or a paid team. Hobby is for eligible personal/non-commercial use; use only where Vercel's current plan terms permit it.
2. Choose **Add New → Project → Import Git Repository** and select `vendoraise-lang/Poker-software`. If it is missing, grant Vercel's GitHub integration access to this repository.
3. Select the repository's `main` branch. Keep **Root Directory** at the repository root (`.`), **Framework Preset** at **Next.js**, and Node.js **24.x**.
4. Keep the build command `npm run build` and use `npm ci` for installation. Let Vercel detect the output directory. Leave environment variables empty.
5. Select **Deploy**. Do not add a database, analytics upgrade, domain purchase, paid add-on or other chargeable integration. Use the free assigned `*.vercel.app` domain.
6. Wait for a **Ready** production deployment. Open the exact URL reported by Vercel; do not assume a hostname from the project name. Check the deployment is for the intended Git commit.

## Verify after deployment

Open the application and run this journey: Academy Module 1 → interactive lesson → assessment → Play a completed hand → Review one decision → calculate equity → open Train → reload. Check an Equity royal-flush example yields 33.33% share for three tied players. Confirm the browser console has no application errors, card inputs reject duplicates, and a JSON backup can be exported and cancelled safely during import.

Check narrow mobile and desktop layouts. Confirm Next.js's static assets and the equity Web Worker load successfully from the production domain. A build marked Ready alone is not evidence of a successful browser walkthrough.

Saved progress belongs to each browser **origin**, including protocol, hostname and port. Before moving from a local/preview URL to the production domain, export a backup from Train → Data. Import it on the production domain and explicitly confirm replacement. Existing backup versions 2–5 remain supported. Vercel does not synchronize localStorage between domains or devices.

## Authentication and status

A successful local production build does not mean the GitHub push or Vercel deployment succeeded. The publishing report must separately state the GitHub branch/commit, Vercel deployment status, and a URL verified from a completed deployment. If authentication is unavailable, complete the repository preparation and report the exact blocker. Do not put GitHub/Vercel tokens in source files or environment files committed to Git; authenticate through the providers' normal login/integration flows.

For self-hosted installation, test details and known educational/accessibility limits, see [the release guide](release.md). This remains play-money education, with no claim of human educator review or professional training validity.
