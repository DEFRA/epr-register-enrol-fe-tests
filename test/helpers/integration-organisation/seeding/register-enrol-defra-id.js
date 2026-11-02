import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { request } from 'undici'

import config from './config.js'

// Registers a seeded operator with epr-register-enrol-frontend's own Defra ID
// stub (epr-register-enrol-defra-id-stub), as a member of the Defra
// organisation its Re/Ex organisation is linked to.
//
// The Re/Ex Defra ID stub that defra-id.js registers with only gets the
// operator as far as the Re-Ex frontend. The "apply for <year> accreditation"
// hand-off lands on epr-register-enrol-frontend, which signs in again through
// this second stub and allows the operator into an organisation only when one
// of their relationships names its linked Defra organisation id. Without this
// the journey ends in a 403 "You do not have access to this organisation".
//
// The stub has no JSON API, so this fills in its registration forms. A user
// it already knows by that email (say, one registered by hand) cannot be
// registered again, so their relationships are replaced instead.

const CLIENT_ID = 'epr-register-enrol-frontend'
// The stub's default client secret (see epr-register-enrol's README), not a
// real credential.
const CLIENT_SECRET =
  process.env.REGISTER_ENROL_DEFRA_ID_CLIENT_SECRET ||
  'operator-journey-stub-secret'

function baseUri() {
  if (!config.registerEnrolDefraIdUri) {
    throw new Error(
      'The register-enrol Defra ID stub is only deployed to CDP environments; set ENVIRONMENT.'
    )
  }
  return config.registerEnrolDefraIdUri
}

// Just enough of a browser for the stub's server-rendered forms: a cookie jar
// for its session (which carries the CSRF token), and no redirect following,
// so each step can see where the stub sends it.
class StubSession {
  #cookies = new Map()

  async send(method, path, form) {
    const url = new URL(path, baseUri())
    const headers = {}
    if (this.#cookies.size) {
      headers.cookie = [...this.#cookies]
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
    }
    let body
    if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams(form).toString()
    }

    const response = await request(url, {
      method,
      headers,
      body,
      dispatcher: config.dispatcher
    })
    for (const cookie of [response.headers['set-cookie'] ?? []].flat()) {
      const [pair] = cookie.split(';')
      const separator = pair.indexOf('=')
      this.#cookies.set(pair.slice(0, separator), pair.slice(separator + 1))
    }
    const text = await response.body.text()
    return {
      statusCode: response.statusCode,
      location: response.headers.location ?? null,
      text
    }
  }

  get(path) {
    return this.send('GET', path)
  }

  post(path, form) {
    return this.send('POST', path, form)
  }
}

function inputValue(html, name) {
  const input = html
    .replace(/\s+/g, ' ')
    .match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0]
  return input?.match(/value="([^"]*)"/)?.[1] ?? ''
}

function errorText(html) {
  return [...html.matchAll(/govuk-error-message"[^>]*>([\s\S]*?)<\/p>/g)]
    .map(([, message]) => message.replace(/<[^>]*>/g, ' ').trim())
    .join('; ')
}

/**
 * The stub's own user id for an email it already knows, read from the
 * subject of an id token it issues when that user signs in.
 *
 * @returns {Promise<string>}
 */
async function existingUserId(email) {
  const session = new StubSession()
  // The stub only authorises redirects to the frontend's own callback. The
  // code is read off that redirect rather than followed to it.
  const redirectUri = `${config.registerEnrolFrontendUri}/auth/operator/callback`
  const verifier = randomBytes(32).toString('base64url')
  const authorise = new URLSearchParams({
    // eslint-disable-next-line camelcase
    client_id: CLIENT_ID,
    // eslint-disable-next-line camelcase
    response_type: 'code',
    // eslint-disable-next-line camelcase
    redirect_uri: redirectUri,
    scope: 'openid',
    state: randomUUID(),
    nonce: randomUUID(),
    // eslint-disable-next-line camelcase
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    // eslint-disable-next-line camelcase
    code_challenge_method: 'S256'
  })
  const loginPage = await session.get(`/authorize?${authorise}`)
  const hidden = Object.fromEntries(
    [
      ...loginPage.text.matchAll(
        /type="hidden" name="([^"]*)" value="([^"]*)"/g
      )
    ].map(([, name, value]) => [name, value.replaceAll('&amp;', '&')])
  )
  const login = await session.post('/login', { ...hidden, email })
  if (!login.location) {
    throw new Error(
      `register-enrol Defra ID stub would not sign in ${email}: ${errorText(login.text) || login.statusCode}`
    )
  }
  const chosen = await session.get(login.location)
  const code =
    chosen.location && new URL(chosen.location).searchParams.get('code')
  if (!code) {
    throw new Error(
      `register-enrol Defra ID stub issued no code for ${email} (${chosen.statusCode}); does it have more than one relationship?`
    )
  }
  const token = await session.post('/token', {
    // eslint-disable-next-line camelcase
    grant_type: 'authorization_code',
    code,
    // eslint-disable-next-line camelcase
    redirect_uri: redirectUri,
    // eslint-disable-next-line camelcase
    client_id: CLIENT_ID,
    // eslint-disable-next-line camelcase
    client_secret: CLIENT_SECRET,
    // eslint-disable-next-line camelcase
    code_verifier: verifier
  })
  // eslint-disable-next-line camelcase
  const idToken = token.statusCode === 200 && JSON.parse(token.text).id_token
  if (!idToken) {
    throw new Error(
      `register-enrol Defra ID stub token for ${email} failed (${token.statusCode}): ${token.text.slice(0, 200)}`
    )
  }
  return JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url')).sub
}

/**
 * Leaves userId with exactly one relationship, to the given Defra
 * organisation, which then signs in as their current one.
 */
async function setOnlyRelationship(session, userId, defraOrganisation) {
  const path = `/register/${userId}/relationship`
  let page = await session.get(path)
  for (const [, relationshipId] of page.text.matchAll(
    /href="relationship\/([^/"]+)\/remove"/g
  )) {
    await session.get(`${path}/${relationshipId}/remove`)
  }

  page = await session.get(path)
  const added = await session.post(path, {
    csrfToken: inputValue(page.text, 'csrfToken'),
    userId,
    relationshipId: randomUUID(),
    organisationId: defraOrganisation.id,
    organisationName: defraOrganisation.name,
    relationshipRole: 'Employee'
  })
  page = await session.get(path)
  if (added.statusCode !== 302 || !page.text.includes(defraOrganisation.id)) {
    throw new Error(
      `register-enrol Defra ID stub did not add ${defraOrganisation.id} to user ${userId}: ${errorText(page.text) || added.statusCode}`
    )
  }
}

/**
 * Makes email a register-enrol Defra ID stub user whose only relationship is
 * to defraOrganisation, registering them first if the stub does not know them.
 *
 * @param {string} email
 * @param {{id: string, name: string}} defraOrganisation the Defra organisation
 *   the Re/Ex organisation is linked to (its linkedDefraOrganisation)
 * @returns {Promise<{userId: string, email: string}>}
 */
export async function registerWithRegisterEnrolDefraId(
  email,
  defraOrganisation
) {
  const session = new StubSession()
  const form = await session.get('/register')
  const userId = inputValue(form.text, 'userId')
  const registered = await session.post('/register', {
    csrfToken: inputValue(form.text, 'csrfToken'),
    userId,
    contactId: inputValue(form.text, 'contactId'),
    email,
    firstName: 'Test',
    lastName: 'User',
    uniqueReference: inputValue(form.text, 'uniqueReference'),
    loa: '1',
    aal: '1',
    enrolmentCount: '1',
    enrolmentRequestCount: '1'
  })

  if (registered.location?.endsWith(`/register/${userId}/relationship`)) {
    await setOnlyRelationship(session, userId, defraOrganisation)
    return { userId, email }
  }

  const rejected = await session.get('/register')
  if (!errorText(rejected.text).includes('already in use')) {
    throw new Error(
      `register-enrol Defra ID stub would not register ${email}: ${errorText(rejected.text) || registered.statusCode}`
    )
  }
  const knownUserId = await existingUserId(email)
  await setOnlyRelationship(new StubSession(), knownUserId, defraOrganisation)
  return { userId: knownUserId, email }
}
