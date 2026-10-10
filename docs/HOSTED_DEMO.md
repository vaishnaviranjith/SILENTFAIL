# Hosted demo preview

The repository includes a Render Blueprint in `render.yaml` for a free, single-service preview.

## What the public preview supports

- Serves the built React frontend and API from one origin.
- Exposes the health check at `/api/health`.
- Allows analysis only when the request matches the committed built-in demo fixture.
- Rejects visitor-supplied source/test content in `SILENTFAIL_DEMO_ONLY=true` mode.
- Disables `POST /api/verify` in public demo mode because suggested-test verification accepts modified source/test input.
- Does not require or configure an AI provider key.

This is intentionally a limited product preview, not a hosted multi-user service. Buyers can download the source package to run the full workflow locally.

## Deploy it

1. Sign in to Render and connect the GitHub account that can access this repository.
2. Create a new Blueprint from the repository and select the `improve/product-ready-ci` branch.
3. Review the settings from `render.yaml`; keep `SILENTFAIL_DEMO_ONLY=true`.
4. Deploy and wait for the build and `/api/health` health check to pass.
5. Open the URL Render assigns to the service. Test the landing page, the built-in demo, the analysis result, and that custom source uploads are rejected.
6. Save the real public URL and a genuine browser screenshot for the marketplace listing.

Render free web services may spin down after inactivity and take about a minute to wake. A successful build alone is not proof that the public browser workflow is working.

## Security boundary

The public demo mode prevents submitted source/test files from being executed by the hosted demo endpoint. Do not turn this flag off for a public deployment unless the executor has been hardened with an appropriate container/microVM isolation boundary and resource controls.
