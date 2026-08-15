export const environment = process.env.ENVIRONMENT

export const backendUrl =
  process.env.API_BASE_URL ||
  (environment
    ? `https://epr-register-enrol-backend.${environment}.cdp-int.defra.cloud`
    : 'http://localhost:8080')

export const caseManagementUrl =
  process.env.CASE_MANAGEMENT_URL ||
  (environment
    ? `https://epr-register-enrol-management-fe.${environment}.cdp-int.defra.cloud`
    : 'http://localhost:5001')

// RA-439: the second frontend container compose.yml runs with
// REGULATOR_QUERY_TEXT_DISABLED=true, used only by the banner-hidden e2e
// case. Only resolvable inside this repo's own docker-compose sandbox (see
// compose.yml) - there's no equivalent in a real CDP environment, where the
// deployed frontend's flag value is controlled by that environment's own
// config, not by this suite.
export const regulatorQueryDisabledFrontendUrl =
  process.env.REGULATOR_QUERY_DISABLED_FRONTEND_URL ||
  'http://epr-register-enrol-frontend-query-disabled:3000'
