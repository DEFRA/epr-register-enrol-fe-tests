export const environment = process.env.ENVIRONMENT

export const frontendUrl = environment
  ? `https://test:test123@epr-register-enrol-frontend.${environment}.cdp-int.defra.cloud`
  : 'http://localhost:3000'

export const backendUrl =
  process.env.API_BASE_URL ||
  (environment
    ? `https://epr-register-enrol-backend.${environment}.cdp-int.defra.cloud`
    : 'http://localhost:8080')
