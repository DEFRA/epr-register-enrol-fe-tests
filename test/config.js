export const environment = process.env.ENVIRONMENT

export const backendUrl =
  process.env.API_BASE_URL ||
  (environment
    ? `https://epr-register-enrol-backend.${environment}.cdp-int.defra.cloud`
    : 'http://localhost:8080')

// Sent as `Authorization: Bearer <secret>` on the direct-to-backend calls in
// test/helpers/case-management.js, impersonating epr-register-enrol-frontend's own
// outbound header (see that repo's api-client.js) so those calls pass
// FrontendAuthenticationHandler. Only load-bearing outside the docker-compose sandbox:
// the backend there runs ASPNETCORE_ENVIRONMENT=Development, which bypasses the check
// regardless of this value — but a real CDP tier (ENVIRONMENT set, see backendUrl above)
// enforces it for real. Must match AUTH_SHARED_SECRET__FRONTEND on the backend for
// whichever environment these tests target.
export const frontendSharedSecret = process.env.AUTH_SHARED_SECRET__FRONTEND

// RA-439: the second frontend container compose.yml runs with
// REGULATOR_QUERY_TEXT_DISABLED=true, used only by the banner-hidden e2e
// case. Only resolvable inside this repo's own docker-compose sandbox (see
// compose.yml) - there's no equivalent in a real CDP environment, where the
// deployed frontend's flag value is controlled by that environment's own
// config, not by this suite.
export const regulatorQueryDisabledFrontendUrl =
  process.env.REGULATOR_QUERY_DISABLED_FRONTEND_URL ||
  'http://epr-register-enrol-frontend-query-disabled:3000'
