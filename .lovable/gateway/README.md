# Lovable Gateway Worker

This Cloudflare Worker provides lightweight `test` and `usage` endpoints that your app's Troubleshooter can call from the browser. The Worker proxies or calls provider-specific endpoints and normalizes responses so the browser can safely check connectivity and remaining-word credits without exposing provider keys.

Deployment

1. Install and configure Wrangler (https://developers.cloudflare.com/workers/cli-wrangler/).
2. Add provider bindings in your `wrangler.toml` (example below) or via the Cloudflare dashboard as plain text variables or secrets.

Example `wrangler.toml` bindings (replace URLs with the provider endpoints your project uses):

[[vars]]
# Not actual TOML syntax for vars—set these in the dashboard or as env bound variables per provider
# PROVIDER_GEMINI_TEST_URL = "https://.../health"
# PROVIDER_GEMINI_USAGE_URL = "https://.../usage"
# PROVIDER_GEMINI_API_KEY = "Bearer ..."

# PROVIDER_OPENROUTER_TEST_URL = "https://openrouter.ai/api/v1/"
# PROVIDER_OPENROUTER_USAGE_URL = "https://openrouter.ai/api/v1/user/usage"
# PROVIDER_OPENROUTER_API_KEY = "Bearer ..."

Usage

- Test: GET https://<your-worker>/test/<provider>
  - Example: /test/gemini
  - Returns: { ok: true, status: 200, latencyMs: 123 }

- Usage: GET https://<your-worker>/usage/<provider>
  - Example: /usage/openrouter
  - Returns normalized: { remainingWords: 12345 }

Notes

- The Worker looks for bindings named PROVIDER_<PROVIDER>_TEST_URL and PROVIDER_<PROVIDER>_USAGE_URL (e.g., PROVIDER_GEMINI_TEST_URL). Bindings must be configured in the worker environment.
- For providers that require authentication to access the usage endpoint, set PROVIDER_<PROVIDER>_API_KEY to the appropriate header value (e.g., "Bearer <token>").
- The Worker does basic normalization of common usage response shapes. If a provider returns an unusual shape, add a normalization step to the Worker or proxy the provider endpoint through your own server which returns { remainingWords }.
