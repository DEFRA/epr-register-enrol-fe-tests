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

// ── Integration journey ─────────────────────────────────────────────────────
// Used only by test/specs/integration/**, which drives a deployed environment
// (ENVIRONMENT, dev when unset) rather than this repo's docker-compose
// sandbox. The journey starts on the Re-Ex frontend (epr-frontend) and hands
// off to epr-register-enrol-frontend through the "apply for <year>
// accreditation" link on a material's registration page, so only the Re-Ex
// URL is configured here.
const integrationEnvironment = environment || 'dev'

export const reexFrontendUrl =
  process.env.REEX_FRONTEND_URL ||
  `https://epr-frontend.${integrationEnvironment}.cdp-int.defra.cloud`

// GOV.UK One Login account for dev, which has no Defra ID stub. On test the
// operator signs in through the stub as the organisation seeded for the run
// (test/helpers/integration-organisation), so these go unused there.
export const reexUsername = process.env.REEX_USERNAME
export const reexPassword = process.env.REEX_PASSWORD

// The accreditation year the journey reapplies for. Drives both the link text
// matched on the registration page and the period asserted on the landing page.
export const accreditationYear = process.env.ACCREDITATION_YEAR || '2027'

// Case management (regulator) frontend for the same deployed environment.
export const caseManagementFrontendUrl =
  process.env.CASE_MANAGEMENT_FRONTEND_URL ||
  `https://epr-register-enrol-management-fe.${integrationEnvironment}.cdp-int.defra.cloud`
