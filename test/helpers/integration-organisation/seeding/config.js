import { Agent, ProxyAgent } from 'undici'

// Where the Re/Ex service's own API (epr-backend) and the Entra identity it
// trusts live, for seeding organisations there before an integrated run.
// Ported from epr-re-ex-journey-tests (test/config/config.js), keeping only
// what seeding needs. This is not this repo's backend: see test/config.js.
//
// Local (ENVIRONMENT unset): the Re/Ex compose stack on localhost.
// Deployed (ENVIRONMENT=test, ...): epr-backend in that environment. From
//   outside CDP that host answers 403, so set X_API_KEY to go through the
//   ephemeral-protected gateway instead.

const environment = process.env.ENVIRONMENT
const xApiKey = process.env.X_API_KEY

if (environment === 'prod') {
  throw new Error('Organisations are never seeded in the prod environment')
}

// test and ext-test sign in to real Entra; dev and perf-test run its stub.
// ENTRA_MODE=real|stub overrides that for an environment that is rewired.
const ENTRA_REAL_IN = ['test', 'ext-test']

function usesRealEntra() {
  const mode = process.env.ENTRA_MODE
  if (mode === 'real') {
    return true
  }
  if (mode === 'stub') {
    return false
  }
  if (mode) {
    throw new Error(`ENTRA_MODE must be 'real' or 'stub', not '${mode}'.`)
  }
  return Boolean(environment) && ENTRA_REAL_IN.includes(environment)
}

const realEntra = usesRealEntra()

function apiUri() {
  if (xApiKey) {
    return `https://ephemeral-protected.api.${environment}.cdp-int.defra.cloud/epr-backend`
  }
  if (environment) {
    return `https://epr-backend.${environment}.cdp-int.defra.cloud`
  }
  return `http://localhost:${process.env.REEX_BACKEND_PORT || 3001}`
}

function authUri() {
  if (realEntra) {
    return 'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/oauth2/v2.0/token'
  }
  if (environment) {
    return `https://epr-re-ex-entra-stub.${environment}.cdp-int.defra.cloud`
  }
  return `http://localhost:${process.env.ENTRA_STUB_PORT || 3010}`
}

// A CDP test-suite run reaches the environment through its egress proxy.
const dispatcher = process.env.HTTP_PROXY
  ? new ProxyAgent({
      uri: process.env.HTTP_PROXY,
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    })
  : new Agent({ headersTimeout: 30000, bodyTimeout: 30000 })

// The admin frontend, where a regulator reviews and approves an organisation.
function adminUri() {
  return environment
    ? `https://epr-re-ex-admin-frontend.${environment}.cdp-int.defra.cloud`
    : `http://localhost:${process.env.ADMIN_PORT || 3002}`
}

// The Defra ID stub an operator signs in through: test and perf-test deploy
// one, and a local run has it in the compose stack.
function defraIdUri() {
  return environment
    ? `https://epr-re-ex-defra-id-stub.${environment}.cdp-int.defra.cloud`
    : `http://localhost:${process.env.DEFRA_ID_STUB_PORT || 3200}`
}

export default {
  adminUri: adminUri(),
  defraIdUri: defraIdUri(),
  apiUri: apiUri(),
  apiHeaders: xApiKey ? { 'x-api-key': xApiKey } : {},
  authUri: authUri(),
  usesRealEntra: realEntra,
  // The regulator (EA) identity the seeding calls run as. Against real Entra
  // the credentials are secrets; against the stub they are its fixed values.
  auth: {
    clientId: 'bd06da51-53f6-46d0-a9f0-ac562864c887',
    clientSecret: process.env.ENTRA_CLIENT_SECRET,
    username: realEntra ? process.env.ENTRA_USERNAME : 'ea@test.gov.uk',
    password: realEntra ? process.env.ENTRA_PASSWORD : 'pass',
    scope: 'api://bd06da51-53f6-46d0-a9f0-ac562864c887/.default',
    grantType: 'password'
  },
  dispatcher
}
