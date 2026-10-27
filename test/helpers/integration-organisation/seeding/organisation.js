import { fakerEN_GB as fakerEnGb } from '@faker-js/faker'

import {
  EntraAuthClient,
  ReexApi,
  assertStatus,
  assertSuccessResponse
} from './api.js'
import { Accreditation, Organisation, Registration } from './generator.js'
import { generateNumbers, materialSuffix } from './reg-acc-number.js'

// Seeds an organisation in the Re/Ex service so an integrated run has one to
// sign in as: apply for it through the forms API, migrate the form submission
// into an organisation, then approve it with its registrations and
// accreditations. Ported from epr-re-ex-journey-tests
// (test/support/seeding/organisation.js); createApprovedOrganisation at the end
// runs the three steps in one call.
//
// A data row describes one registration, and the accreditation applied for
// beside it unless withoutAccreditation is set:
//   { wasteProcessingType: 'Reprocessor' | 'Exporter',
//     material: 'Plastic (R3)',          // as the form words it; '' = Paper
//     glassRecyclingProcess?: 'Glass re-melt' | 'Glass other',
//     street?, postcode?, town?, tonnageBand?, withoutAccreditation?,
//     companiesHouse?: true }   // first row only: apply as a registered company

const currentYear = () => new Date().getUTCFullYear()

// The date a seeded registration and accreditation both start from, and the
// day before, which the 'created' history entries are backdated to.
export const SEEDED_VALID_FROM = `${currentYear()}-01-01`
export const SEEDED_CREATED_ON = `${currentYear() - 1}-12-31`

function wasteProcessingTypeAnswer(dataRows) {
  const types = new Set(dataRows.map((row) => row.wasteProcessingType))
  return types.size > 1 ? 'Reprocessor and exporter' : [...types][0]
}

/**
 * Applies for an organisation, then a registration (and accreditation) per
 * data row, then migrates the submission into an organisation.
 *
 * @returns {Promise<{orgId: number, refNo: string, organisation: Organisation, registrations: Registration[]}>}
 */
export async function createLinkedOrganisation(dataRows) {
  const api = new ReexApi()

  // A reprocessor applies as a sole trader unless the first row asks for a
  // company registered with Companies House, which an exporter always is.
  const organisation = new Organisation()
  let payload =
    dataRows[0].wasteProcessingType === 'Reprocessor' &&
    !dataRows[0].companiesHouse
      ? organisation.toNonRegisteredUKSoleTraderPayload()
      : organisation.toPayload()
  // The organisation's own waste processing types come from this answer, which
  // the generator picks at random, so it is set to match the rows.
  payload.data.main.WVADkQ = wasteProcessingTypeAnswer(dataRows)

  let response = await api.post(
    '/v1/apply/organisation',
    JSON.stringify(payload)
  )
  const { orgId, referenceNumber: refNo } = JSON.parse(
    await assertStatus(response, 200, 'POST /v1/apply/organisation')
  )

  const registrations = []

  for (const dataRow of dataRows) {
    const material = dataRow.material || 'Paper or board (R3)'
    const glassRecyclingProcess = dataRow.glassRecyclingProcess?.trim()
    const registration = new Registration(
      orgId,
      refNo,
      dataRow.street || undefined,
      dataRow.postcode || undefined,
      dataRow.town || undefined
    )
    payload =
      dataRow.wasteProcessingType === 'Reprocessor'
        ? registration.toAllMaterialsPayload(material, glassRecyclingProcess)
        : registration.toExporterPayload(material, glassRecyclingProcess)
    response = await api.post('/v1/apply/registration', JSON.stringify(payload))
    await assertStatus(response, 201, 'POST /v1/apply/registration')
    registrations.push(registration)

    if (!dataRow.withoutAccreditation) {
      const accreditation = new Accreditation(orgId, refNo)
      accreditation.postcode = registration.postcode
      if (dataRow.tonnageBand) {
        accreditation.tonnageBand = dataRow.tonnageBand
      }
      payload =
        dataRow.wasteProcessingType === 'Reprocessor'
          ? accreditation.toReprocessorPayload(material, glassRecyclingProcess)
          : accreditation.toExporterPayload(material, glassRecyclingProcess)
      response = await api.post(
        '/v1/apply/accreditation',
        JSON.stringify(payload)
      )
      await assertStatus(response, 201, 'POST /v1/apply/accreditation')
    }
  }

  await migrateOrganisation(refNo)

  return { orgId, refNo, organisation, registrations }
}

/**
 * Turns the organisation's form submissions into an organisation record
 * (non-prod route). createLinkedOrganisation already calls this.
 */
export async function migrateOrganisation(refNo) {
  const response = await new ReexApi().post(
    `/v1/dev/form-submissions/${refNo}/migrate`,
    ''
  )
  await assertStatus(
    response,
    200,
    `POST /v1/dev/form-submissions/${refNo}/migrate`
  )
}

// Migration lands a moment after the migrate call returns, so the first read
// of a freshly migrated organisation can miss it.
async function readOrganisationOnceMigrated(api, authHeader, refNo) {
  const deadline = Date.now() + 5000
  let response
  while (Date.now() < deadline) {
    response = await api.get(`/v1/organisations/${refNo}`, authHeader)
    if (response.statusCode >= 200 && response.statusCode < 300) {
      break
    }
    await response.body.dump()
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  return assertSuccessResponse(response, `GET /v1/organisations/${refNo}`)
}

// Statuses and numbers seed through the non-prod twin of the organisation
// PUT: the public route rejects status changes and the transition endpoints
// enforce number uniqueness.
async function writeOrganisation(api, authHeader, refNo, data) {
  const response = await api.put(
    `/v1/dev/organisations/${refNo}`,
    JSON.stringify({ version: Number(data.version), updateFragment: data }),
    authHeader
  )
  await assertSuccessResponse(response, `PUT /v1/dev/organisations/${refNo}`)
}

const backdateCreated = (history = []) =>
  history.map((entry) =>
    entry.status === 'created'
      ? { ...entry, updatedAt: SEEDED_CREATED_ON }
      : entry
  )

/**
 * Approves a migrated organisation: sets each registration (and the
 * accreditation applied for beside it) to the row's status with the row's
 * numbers, and the organisation to the first row's status.
 *
 * Row: { status: 'approved', regNumber, accNumber?, accStatus?, validFrom?,
 *        reprocessingType?, glassRecyclingProcess?, withoutAccreditation?, email? }
 *
 * @returns {Promise<{email: string, registrationIds: string[], accreditationIds: string[]}>}
 */
export async function approveMigratedOrganisation(
  refNo,
  updateDataRows,
  submittedToRegulator,
  validFrom = SEEDED_VALID_FROM
) {
  const auth = new EntraAuthClient()
  const api = new ReexApi()
  await auth.authenticate()

  const data = await readOrganisationOnceMigrated(api, auth.authHeader(), refNo)

  const registrationIds = []
  const accreditationIds = []
  let accreditationIndex = 0

  updateDataRows.forEach((row, i) => {
    const registration = data.registrations[i]
    registration.status = row.status
    registration.validFrom = row.validFrom?.trim() || validFrom
    registration.registrationNumber = row.regNumber
    registration.statusHistory = backdateCreated([
      ...(registration.statusHistory || []),
      { status: row.status, updatedAt: validFrom }
    ])
    if (row.reprocessingType?.trim()) {
      registration.reprocessingType = row.reprocessingType
    }
    if (row.glassRecyclingProcess?.trim()) {
      registration.glassRecyclingProcess = [row.glassRecyclingProcess]
    }
    if (submittedToRegulator) {
      registration.submittedToRegulator = submittedToRegulator
    }
    registrationIds.push(registration.id)

    const accreditation = data.accreditations[accreditationIndex]
    if (row.withoutAccreditation || !accreditation) {
      return
    }
    // accStatus lets the accreditation differ from the registration, e.g. an
    // approved registration with a still-created accreditation.
    const accStatus = row.accStatus ?? row.status
    registration.accreditationId = accreditation.id
    accreditation.status = accStatus
    accreditation.validFrom = row.validFrom?.trim() || validFrom
    accreditation.validTo = `${currentYear() + 1}-01-01`
    accreditation.statusHistory = backdateCreated(
      accStatus === 'created'
        ? accreditation.statusHistory || []
        : [
            ...(accreditation.statusHistory || []),
            { status: accStatus, updatedAt: validFrom }
          ]
    )
    if (row.reprocessingType?.trim()) {
      accreditation.reprocessingType = row.reprocessingType
    }
    if (row.glassRecyclingProcess?.trim()) {
      accreditation.glassRecyclingProcess = [row.glassRecyclingProcess]
    }
    accreditation.accreditationNumber = row.accNumber
    if (submittedToRegulator) {
      accreditation.submittedToRegulator = submittedToRegulator
    }
    accreditationIds.push(accreditation.id)
    accreditationIndex++
  })

  if (submittedToRegulator) {
    data.submittedToRegulator = submittedToRegulator
  }

  // A deployed environment gets a fresh address each run, so a run does not
  // keep reusing the one the form fixture carries.
  const email =
    updateDataRows[0].email ||
    (process.env.ENVIRONMENT
      ? fakerEnGb.internet.email()
      : data.submitterContactDetails.email)
  data.submitterContactDetails.email = email

  data.status = updateDataRows[0].status
  data.statusHistory = [
    ...(data.statusHistory || []),
    { status: updateDataRows[0].status, updatedAt: validFrom }
  ]

  await writeOrganisation(api, auth.authHeader(), refNo, data)

  return { email, registrationIds, accreditationIds }
}

/**
 * Approves one registration of a migrated organisation, with the accreditation
 * applied for beside it, where approveMigratedOrganisation approves them all.
 * The organisation is approved with its first registration. Indices are
 * positions in the order the registrations and accreditations were applied for.
 *
 * @param {string} refNo
 * @param {{registrationIndex: number, accreditationIndex?: number}} indices
 * @param {{regNumber: string, accNumber?: string, reprocessingType?: 'input' | 'output', validFrom: string, validTo?: string, submittedToRegulator: string}} granted
 * @returns {Promise<{registrationId: string, accreditationId: string | null, email: string}>}
 */
export async function approveMigratedRegistration(
  refNo,
  { registrationIndex, accreditationIndex },
  granted
) {
  const auth = new EntraAuthClient()
  const api = new ReexApi()
  await auth.authenticate()

  const data = await readOrganisationOnceMigrated(api, auth.authHeader(), refNo)
  const registration = data.registrations[registrationIndex]
  const accreditation =
    accreditationIndex === undefined
      ? null
      : data.accreditations[accreditationIndex]

  registration.status = 'approved'
  registration.validFrom = granted.validFrom
  registration.registrationNumber = granted.regNumber
  registration.submittedToRegulator = granted.submittedToRegulator
  if (granted.reprocessingType) {
    registration.reprocessingType = granted.reprocessingType
  }

  if (accreditation) {
    registration.accreditationId = accreditation.id
    accreditation.status = 'approved'
    accreditation.validFrom = granted.validFrom
    accreditation.validTo = granted.validTo
    accreditation.accreditationNumber = granted.accNumber
    accreditation.submittedToRegulator = granted.submittedToRegulator
    if (granted.reprocessingType) {
      accreditation.reprocessingType = granted.reprocessingType
    }
  }

  // Linking a Defra ID user moves an approved organisation on to active, so a
  // later registration's approval leaves it there.
  if (!['approved', 'active'].includes(data.status)) {
    data.status = 'approved'
    data.submittedToRegulator = granted.submittedToRegulator
  }

  await writeOrganisation(api, auth.authHeader(), refNo, data)

  return {
    registrationId: registration.id,
    accreditationId: accreditation?.id ?? null,
    email: data.submitterContactDetails.email
  }
}

/**
 * Creates, migrates and approves an organisation in one call: one approved
 * registration and accreditation per data row, numbered in the Re/Ex format.
 * The organisation is given contactEmail (a random address when unset).
 *
 * @returns {Promise<{orgId: number, refNo: string, email: string, numbers: {regNumber: string, accNumber: string}[], registrationIds: string[], accreditationIds: string[]}>}
 */
export async function createApprovedOrganisation(
  dataRows = [{ wasteProcessingType: 'Reprocessor', material: 'Plastic (R3)' }],
  { contactEmail = process.env.ORG_CONTACT_EMAIL } = {}
) {
  const { orgId, refNo } = await createLinkedOrganisation(dataRows)
  const approved = await approveSeededOrganisation(refNo, dataRows, {
    contactEmail
  })
  return { orgId, ...approved }
}

// The form answers a glass recycling process in words; the organisation
// stores it as a code.
const GLASS_RECYCLING_PROCESS_CODES = {
  'Glass re-melt': 'glass_re_melt',
  'Glass other': 'glass_other'
}

/**
 * Approves an organisation createLinkedOrganisation seeded from dataRows, with
 * a fresh registration and accreditation number per row.
 *
 * @returns {Promise<{refNo: string, email: string, numbers: {regNumber: string, accNumber: string}[], registrationIds: string[], accreditationIds: string[]}>}
 */
export async function approveSeededOrganisation(
  refNo,
  dataRows,
  { contactEmail = process.env.ORG_CONTACT_EMAIL } = {}
) {
  const numbers = dataRows.map((row) =>
    generateNumbers({
      wasteProcessingType: row.wasteProcessingType.toLowerCase(),
      materialSuffix: materialSuffix(
        row.material || 'Paper or board (R3)',
        row.glassRecyclingProcess
      )
    })
  )
  // A reprocessor registration is approved as an input site, as the source
  // suite's own seeds do. Applying had to use the one address Notify may send
  // to (EMAIL_ADDRESS), so the contact email wanted is set here instead.
  const approved = await approveMigratedOrganisation(
    refNo,
    dataRows.map((row, i) => ({
      status: 'approved',
      email: i === 0 ? contactEmail : undefined,
      ...numbers[i],
      reprocessingType:
        row.wasteProcessingType === 'Reprocessor' ? 'input' : undefined,
      glassRecyclingProcess:
        GLASS_RECYCLING_PROCESS_CODES[row.glassRecyclingProcess],
      withoutAccreditation: row.withoutAccreditation
    }))
  )

  return { refNo, numbers, ...approved }
}
