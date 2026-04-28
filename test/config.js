export const environment = process.env.ENVIRONMENT

const username = process.env.TEST_USERNAME
const password = process.env.TEST_PASSWORD

export const frontendUrl = environment
  ? `https://${username}:${password}@epr-register-enrol-frontend.${environment}.cdp-int.defra.cloud`
  : 'http://localhost:3000'

export const backendUrl =
  process.env.API_BASE_URL ||
  (environment
    ? `https://epr-register-enrol-backend.${environment}.cdp-int.defra.cloud`
    : 'http://localhost:8080')
