import { randomUUID } from 'node:crypto'
import { request } from 'undici'

import {
  EntraAuthClient,
  ReexApi,
  assertStatus,
  assertSuccessResponse
} from './api.js'
import config from './config.js'

// Links a seeded organisation to a Defra ID user, so the operator can sign in
// to the Re/Ex frontend and see it. Ported from epr-re-ex-journey-tests
// (test/support/defra-id-linking.js, defra-id-stub.js, users.js).
//
// The backend only links an approved organisation for a user whose email is
// the organisation's contact email (its "initial user"), so the email is set
// on the organisation first. The user then signs in through the Defra ID stub
// and makes the link call with the token it issues.

const CLIENT_ID = '63983fc2-cfff-45bb-8ec2-959e21062b9a'

async function stubCall(method, path, { body, headers = {} } = {}) {
  return request(`${config.defraIdUri}/epr-re-ex-defra-id-stub${path}`, {
    method,
    headers: { ...config.apiHeaders, ...headers },
    body,
    dispatcher: config.dispatcher
  })
}

/**
 * Registers a user with the Defra ID stub, with one relationship to a Defra
 * organisation, which is what the link records.
 *
 * @returns {Promise<{userId: string, email: string}>}
 */
export async function registerDefraIdUser(email, defraOrgName = 'ACME ltd') {
  const user = {
    userId: randomUUID(),
    email,
    firstName: 'Test',
    lastName: 'User',
    loa: '1',
    aal: '1',
    enrolmentCount: 1,
    enrolmentRequestCount: 1,
    relationships: [
      {
        organisationName: defraOrgName,
        relationshipRole: 'Employee',
        roleName: 'Some role',
        roleStatus: '1'
      }
    ]
  }
  const response = await stubCall('POST', '/API/register', {
    body: JSON.stringify(user)
  })
  await assertSuccessResponse(response, 'Defra ID stub register')
  return { userId: user.userId, email }
}

/**
 * Signs a registered user in through the stub.
 *
 * @returns {Promise<string>} the user's access token
 */
export async function signInDefraIdUser(email) {
  const query = new URLSearchParams({
    user: email,
    // eslint-disable-next-line camelcase
    client_id: CLIENT_ID,
    // eslint-disable-next-line camelcase
    response_type: 'code',
    // eslint-disable-next-line camelcase
    redirect_uri: 'http://0.0.0.0:3001/health',
    state: 'state',
    scope: 'email'
  })
  const authorise = await stubCall('GET', `/authorize?${query}`)
  await authorise.body.dump()
  const sessionId = String(authorise.headers.location).split('sessionId=')[1]
  if (!sessionId) {
    throw new Error(
      `Defra ID stub authorise returned ${authorise.statusCode} with no session for ${email}`
    )
  }

  const token = await stubCall('POST', '/token', {
    body: JSON.stringify({
      // eslint-disable-next-line camelcase
      client_id: CLIENT_ID,
      // eslint-disable-next-line camelcase
      client_secret: 'test_value',
      // eslint-disable-next-line camelcase
      grant_type: 'authorization_code',
      code: sessionId
    })
  })
  const json = await assertSuccessResponse(token, 'Defra ID stub token')
  return json.access_token
}

/**
 * Makes email the contact (initial user) of an organisation, registers it with
 * the Defra ID stub as a member of the Defra organisation defraOrgName, and
 * links the organisation to that Defra organisation.
 *
 * @returns {Promise<{orgId: number, refNo: string, email: string, userId: string, linkedDefraOrganisation: object}>}
 */
export async function linkOrganisationToDefraId(refNo, email, defraOrgName) {
  const api = new ReexApi()
  const auth = new EntraAuthClient()
  await auth.authenticate()

  const data = await assertSuccessResponse(
    await api.get(`/v1/organisations/${refNo}`, auth.authHeader()),
    `GET /v1/organisations/${refNo}`
  )
  if (data.submitterContactDetails.email !== email) {
    data.submitterContactDetails.email = email
    await assertSuccessResponse(
      await api.put(
        `/v1/dev/organisations/${refNo}`,
        JSON.stringify({ version: Number(data.version), updateFragment: data }),
        auth.authHeader()
      ),
      `PUT /v1/dev/organisations/${refNo}`
    )
  }

  const { userId } = await registerDefraIdUser(email, defraOrgName)
  const accessToken = await signInDefraIdUser(email)

  const response = await api.post(`/organisations/${data.orgId}/link`, '', {
    Authorization: `Bearer ${accessToken}`
  })
  const linked = JSON.parse(
    await assertStatus(response, 200, `POST /organisations/${data.orgId}/link`)
  )

  return {
    orgId: data.orgId,
    refNo,
    email,
    userId,
    linkedDefraOrganisation: linked.linkedDefraOrganisation
  }
}
