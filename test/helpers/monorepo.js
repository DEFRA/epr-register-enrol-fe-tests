import { docker, mongosh as mongoshVia, OPERATOR_DATABASE } from './docker.js'

/**
 * Helpers for the @monorepo specs (test/specs/monorepo), which run from this
 * machine against the DEFRA/epr-register-enrol monorepo's local stack
 * (`docker compose up` at its root) rather than this repo's own sandbox:
 * the operator frontend on localhost:3000, its backend, and the real case
 * management services in place of the sandbox's stub. See wdio.monorepo.conf.js.
 */

export const MONOREPO_TAG = '@monorepo'

/**
 * Set by wdio.monorepo.conf.js, and only by it, for its workers. Not
 * ENVIRONMENT: wdio loads .env on every run, and a local .env commonly sets
 * ENVIRONMENT for the integration runs.
 */
export const MONOREPO_RUN_FLAG = 'MONOREPO_RUN'

/**
 * Skips the suite unless it was started by wdio.monorepo.conf.js (npm run
 * test:monorepo). The monorepo specs clear and submit applications through
 * the local stack's MongoDB and Docker, so must never run on a deployed
 * environment such as test - not even named directly with --spec under
 * another config, since the test image carries the whole test folder.
 * Register as the first `before` hook.
 *
 * @param {Mocha.Context} context the `this` of a `before` hook
 */
export function skipUnlessMonorepoRun(context) {
  if (process.env[MONOREPO_RUN_FLAG] !== 'true') {
    context.skip()
  }
}

/**
 * The stub organisations the specs apply for. Both are e2e test organisations
 * in the operator frontend's stub fixtures (src/server/common/stub-operator-orgs.js),
 * not the dev seed user's own organisation or the perf-test ones, so clearing
 * their applications loses nobody's manual work.
 */
export const MONOREPO_ORGS = {
  reprocessor: {
    organisationId: '50016',
    registrationId: 'aaa000000000000000050016',
    material: 'Plastic',
    name: 'Section Lock Test Recycling Ltd'
  },
  exporter: {
    organisationId: '50015',
    registrationId: 'aaa000000000000000050015',
    material: 'Plastic',
    name: 'Exporter Accreditation Test Exports Ltd'
  }
}

const CASE_MANAGEMENT_DATABASE = 'epr-register-case-management'

/**
 * The monorepo's MongoDB container: the compose service named mongodb that
 * publishes 27017 on this machine (this repo's sandbox keeps its MongoDB
 * unpublished, so it never matches). MONOREPO_MONGO_CONTAINER overrides it.
 * Looked up once per worker.
 */
let container

async function mongoContainer() {
  container ??= await findMongoContainer()
  return container
}

async function findMongoContainer() {
  if (process.env.MONOREPO_MONGO_CONTAINER) {
    return process.env.MONOREPO_MONGO_CONTAINER
  }

  const ids = (
    await docker([
      'ps',
      '--quiet',
      '--filter',
      'label=com.docker.compose.service=mongodb',
      '--filter',
      'publish=27017'
    ])
  )
    .split('\n')
    .filter(Boolean)

  if (ids.length !== 1) {
    throw new Error(
      `Expected one running MongoDB container publishing 27017 (the monorepo's), found ${ids.length}. ` +
        'Start the monorepo stack, or set MONOREPO_MONGO_CONTAINER.'
    )
  }
  return ids[0]
}

/**
 * Runs a mongosh script in the monorepo's MongoDB container and returns what
 * it prints as JSON.
 *
 * @param {string} script must end by printing one JSON value
 */
async function mongosh(script) {
  return mongoshVia(['exec', await mongoContainer()], script)
}

/**
 * Deletes every accreditation application the organisation has for the
 * registration, and the case management work items raised for it, so the
 * journey starts from NOT STARTED. Visiting the accreditation page afterwards
 * creates a fresh application.
 *
 * @param {{ organisationId: string, registrationId: string }} org
 * @returns {Promise<{ applications: number, workItems: number }>} how many were deleted
 */
export async function clearApplications({ organisationId, registrationId }) {
  const filter = JSON.stringify({ organisationId, registrationId })
  const workItemFilter = JSON.stringify({
    'payload.operatorRegistrationId': registrationId
  })

  return mongosh(`
    const applications = db.getSiblingDB('${OPERATOR_DATABASE}')
      .accreditationApplications.deleteMany(${filter}).deletedCount
    const workItems = db.getSiblingDB('${CASE_MANAGEMENT_DATABASE}')
      .workItems.deleteMany(${workItemFilter}).deletedCount
    print(JSON.stringify({ applications, workItems }))
  `)
}

/**
 * The case management work items raised for the registration.
 *
 * @param {{ registrationId: string }} org
 * @returns {Promise<Array<{ typeId: string, stateId: string, applicationReference: string }>>}
 */
export async function workItemsFor({ registrationId }) {
  const filter = JSON.stringify({
    'payload.operatorRegistrationId': registrationId
  })

  return mongosh(`
    print(JSON.stringify(
      db.getSiblingDB('${CASE_MANAGEMENT_DATABASE}').workItems
        .find(${filter})
        .toArray()
        .map((w) => ({
          typeId: w.typeId,
          stateId: w.stateId,
          applicationReference: w.payload.applicationReference
        }))
    ))
  `)
}

/** The case management work item type an add-ORS change request raises. */
export const ADD_OVERSEAS_SITE_TYPE_ID = 'add-overseas-site'

// RA-682: ORS changes are add-ORS or ORS update work items. A request holding
// both is sent as one submission per type, the update one under
// `{requestId}:update-overseas-site`.
export const UPDATE_OVERSEAS_SITE_TYPE_ID = 'update-overseas-site'
const ORS_CHANGE_TYPE_IDS = [
  ADD_OVERSEAS_SITE_TYPE_ID,
  UPDATE_OVERSEAS_SITE_TYPE_ID
]

/**
 * Deletes every in-year change request the organisation has, the add-ORS
 * and ORS update work items case management raised for them, and the
 * submissions those came in, so the organisation's ORSs can be added or
 * changed afresh.
 *
 * @param {{ organisationId: string }} org
 * @returns {Promise<{ changeRequests: number, workItems: number, submissions: number }>} how many were deleted
 */
export async function clearChangeRequests({ organisationId }) {
  const filter = JSON.stringify({ organisationId })
  const workItemFilter = JSON.stringify({
    typeId: { $in: ORS_CHANGE_TYPE_IDS },
    'payload.operatorOrganisationId': organisationId
  })

  return mongosh(`
    const changeRequests = db.getSiblingDB('${OPERATOR_DATABASE}')
      .accreditationChangeRequests.deleteMany(${filter}).deletedCount
    const caseManagement = db.getSiblingDB('${CASE_MANAGEMENT_DATABASE}')
    const requestIds = caseManagement.workItems
      .distinct('payload.operatorRequestId', ${workItemFilter})
    const submissions = caseManagement.submissions
      .deleteMany({ _id: { $in: requestIds } }).deletedCount
    const workItems = caseManagement.workItems
      .deleteMany(${workItemFilter}).deletedCount
    print(JSON.stringify({ changeRequests, workItems, submissions }))
  `)
}

/** An item no longer being decided: granted, refused or withdrawn. */
const FINAL_ITEM_STATUSES = ['Approved', 'Rejected', 'Withdrawn']

/**
 * RA-495: each submitted add-ORS item's case management work item id, by
 * site id, read from the operator backend's own store: the change requests
 * view does not show it, and case management's status pushes are keyed by it.
 * Only items still being decided, so a site requested again after a refusal
 * gives its new item's work item.
 *
 * @param {{ organisationId: string }} org
 * @returns {Promise<Record<string, string>>}
 */
export async function changeRequestWorkItemIdsFor({ organisationId }) {
  const filter = JSON.stringify({ organisationId, status: 'Submitted' })
  const final = JSON.stringify(FINAL_ITEM_STATUSES)

  return mongosh(`
    const ids = {}
    db.getSiblingDB('${OPERATOR_DATABASE}').accreditationChangeRequests
      .find(${filter})
      .forEach((r) => r.sites
        .filter((s) => s.caseManagementWorkItemId && !${final}.includes(s.status))
        .forEach((s) => { ids[s.siteId] = String(s.caseManagementWorkItemId) }))
    print(JSON.stringify(ids))
  `)
}

/**
 * RA-495: puts a granted ORS back to registered only on the organisation's
 * accreditation applications, as the dev seed leaves it, so a spec that
 * grants it can run again. Only the legacy application: the monorepo stack
 * runs without dual-write, so the domain model holds no grant.
 *
 * @param {{ organisationId: string, siteId: number, unanswered?: string[] }} site
 *   unanswered: the fields the seed leaves the site without (operationCodes,
 *   conditionsOfExport, coordinates, country), cleared again
 * @returns {Promise<{ applications: number }>} how many were changed
 */
export async function unaccreditOverseasSite({
  organisationId,
  siteId,
  unanswered = []
}) {
  const filter = JSON.stringify({
    organisationId,
    'overseasSites.sites.siteId': siteId
  })
  // RA-495 (3bb.29): a grant also writes the answers the operator supplied on
  // the request, so a site seeded without them is put back without them.
  // Operation codes are an empty list when unanswered; the others are absent.
  const field = (name) => `overseasSites.sites.$[site].${name}`
  const update = JSON.stringify({
    $set: {
      [field('selected')]: false,
      ...(unanswered.includes('operationCodes')
        ? { [field('operationCodes')]: [] }
        : {})
    },
    $unset: Object.fromEntries(
      [
        'validFrom',
        ...unanswered.filter((name) => name !== 'operationCodes')
      ].map((name) => [field(name), ''])
    )
  })
  const arrayFilters = JSON.stringify([{ 'site.siteId': siteId }])

  return mongosh(`
    const applications = db.getSiblingDB('${OPERATOR_DATABASE}')
      .accreditationApplications
      .updateMany(${filter}, ${update}, { arrayFilters: ${arrayFilters} })
      .modifiedCount
    print(JSON.stringify({ applications }))
  `)
}

/**
 * RA-495 (3bb.38): gives an ORS on the organisation's accreditation
 * applications the BES evidence files named, Clean, as if uploaded on the
 * application, so a spec can check a change request's upload against the
 * files the site already holds. No names removes them again, as the dev seed
 * leaves the site. Only the legacy application.
 *
 * @param {{ organisationId: string, siteId: number, filenames?: string[] }} site
 * @returns {Promise<{ applications: number }>} how many were changed
 */
export async function setOverseasSiteBesEvidence({
  organisationId,
  siteId,
  filenames = []
}) {
  const filter = JSON.stringify({
    organisationId,
    'overseasSites.sites.siteId': siteId
  })
  const field = 'overseasSites.sites.$[site].besEvidence'
  const update = JSON.stringify(
    filenames.length === 0
      ? { $unset: { [field]: '' } }
      : {
          $set: {
            [field]: {
              besEvidenceUploads: filenames.map((filename, index) => ({
                fileId: `e2e-held-${siteId}-${index + 1}`,
                filename,
                contentType: 'application/pdf',
                scanStatus: 'Clean',
                besEvidenceValidFromDate: '2026-01-01T00:00:00.000Z',
                besEvidenceExpiryDate: '2027-12-31T00:00:00.000Z',
                s3Key: `bes-evidence/e2e-held-${siteId}-${index + 1}`,
                s3Bucket: 'bes-evidence'
              })),
              doYouWantToUploadMoreEvidence: false
            }
          }
        }
  )
  const arrayFilters = JSON.stringify([{ 'site.siteId': siteId }])

  return mongosh(`
    const applications = db.getSiblingDB('${OPERATOR_DATABASE}')
      .accreditationApplications
      .updateMany(${filter}, ${update}, { arrayFilters: ${arrayFilters} })
      .modifiedCount
    print(JSON.stringify({ applications }))
  `)
}

/**
 * RA-495 (3bb.48): gives the organisation's accreditation applications the
 * sampling plan files named, as if uploaded on the application, so a spec can
 * check a change request's BES upload against a name the operator frontend
 * cannot see. Only files this helper added are replaced; no names removes
 * them again. Only the legacy application.
 *
 * @param {{ organisationId: string, filenames?: string[] }} org
 * @returns {Promise<{ applications: number }>} how many were changed
 */
export async function setSamplingPlanFiles({ organisationId, filenames = [] }) {
  const filter = JSON.stringify({ organisationId })
  const pull = JSON.stringify({
    $pull: { 'samplingPlan.files': { fileId: { $regex: '^e2e-plan-' } } }
  })
  const push = JSON.stringify({
    $push: {
      'samplingPlan.files': {
        $each: filenames.map((filename, index) => ({
          fileId: `e2e-plan-${index + 1}`,
          filename,
          contentType: 'application/pdf',
          uploadedByUserId: 'e2e',
          s3Key: `sampling-plan/e2e-plan-${index + 1}`
        }))
      }
    }
  })

  return mongosh(`
    const collection = db.getSiblingDB('${OPERATOR_DATABASE}').accreditationApplications
    collection.updateMany(${filter}, ${pull})
    const applications = ${filenames.length} === 0
      ? 0
      : collection.updateMany(${filter}, ${push}).modifiedCount
    print(JSON.stringify({ applications }))
  `)
}

/**
 * RA-495 (3bb.49): completes a site on the organisation's in-progress change
 * request directly, with the answers given and Clean BES evidence files of
 * the names given, as a draft uploaded before the upload-time checks would
 * be. Skips the CDP uploader, so a spec can set up a draft the upload would
 * now refuse.
 *
 * @param {{ organisationId: string, siteId: number,
 *   answers: object, besFilenames: string[] }} site
 * @returns {Promise<{ changeRequests: number }>} how many were changed
 */
export async function setChangeRequestSite({
  organisationId,
  siteId,
  answers,
  besFilenames
}) {
  const filter = JSON.stringify({ organisationId, status: 'InProgress' })
  const update = JSON.stringify({
    $set: {
      'sites.$[site].answers': answers,
      'sites.$[site].besEvidence': {
        besEvidenceUploads: besFilenames.map((filename, index) => ({
          fileId: `e2e-request-${siteId}-${index + 1}`,
          filename,
          contentType: 'application/pdf',
          scanStatus: 'Clean',
          besEvidenceValidFromDate: '2026-01-01T00:00:00.000Z',
          besEvidenceExpiryDate: '2027-12-31T00:00:00.000Z',
          s3Key: `accreditation-changes/bes-evidence/e2e-request-${siteId}-${index + 1}`,
          s3Bucket: 'bes-evidence'
        })),
        doYouWantToUploadMoreEvidence: false
      }
    }
  })
  const arrayFilters = JSON.stringify([{ 'site.siteId': siteId }])

  return mongosh(`
    const changeRequests = db.getSiblingDB('${OPERATOR_DATABASE}')
      .accreditationChangeRequests
      .updateMany(${filter}, ${update}, { arrayFilters: ${arrayFilters} })
      .modifiedCount
    print(JSON.stringify({ changeRequests }))
  `)
}

/**
 * The ORS work items case management raised for the organisation, one per
 * site: add-ORS and ORS update ones, or only those of the types given. Update
 * items carry what they propose; add-ORS ones the submission they came in.
 *
 * @param {{ organisationId: string, typeIds?: string[] }} org
 * @returns {Promise<Array<{ id: string, typeId: string, stateId: string,
 *   siteId: number, orsId: string, operatorRequestId: string,
 *   applicationReference: string, submissionReference: string,
 *   submissionSize: number, chargePence: number | null,
 *   proposed: object | null, interimSiteChanges: string[] }>>}
 */
export async function orsWorkItemsFor({
  organisationId,
  typeIds = ORS_CHANGE_TYPE_IDS
}) {
  const filter = JSON.stringify({
    typeId: { $in: typeIds },
    'payload.operatorOrganisationId': organisationId
  })

  return mongosh(`
    print(JSON.stringify(
      db.getSiblingDB('${CASE_MANAGEMENT_DATABASE}').workItems
        .find(${filter})
        .toArray()
        .map((w) => ({
          id: String(w._id),
          typeId: w.typeId,
          stateId: w.stateId,
          siteId: w.payload.site.siteId,
          orsId: w.payload.site.orsId,
          operatorRequestId: w.payload.operatorRequestId,
          applicationReference: w.payload.applicationReference,
          submissionReference: w.payload.submissionReference,
          submissionSize: w.payload.submissionSize,
          chargePence: w.payload.site.chargePence ?? null,
          proposed: w.payload.site.proposed ?? null,
          interimSiteChanges: (w.payload.site.interimSiteChanges ?? []).map((c) => c.action)
        }))
    ))
  `)
}

/**
 * RA-782: puts accredited ORSs back as given (the dev seed's copy), so a spec
 * that grants an update to one (its details, interim sites or BES evidence)
 * can run again:
 *
 * - on the organisation's accreditation applications, each site replaces the
 *   one with its site id, keeping the domain model id the migration gave it;
 * - in the domain model (the monorepo stack runs dual-write, so the first
 *   write migrates the application), each of those ORSs' versions a grant
 *   wrote are deleted and the version before made current again. Nothing
 *   there until the application has been migrated.
 *
 * @param {{ organisationId: string, sites: object[] }} org
 * @returns {Promise<{ applications: number, orsVersions: number }>} how many
 *   applications were changed and granted ORS versions deleted
 */
export async function resetOverseasSites({ organisationId, sites }) {
  return mongosh(`
    const database = db.getSiblingDB('${OPERATOR_DATABASE}')
    const seeded = ${JSON.stringify(sites)}
    let applications = 0
    let orsVersions = 0
    database.accreditationApplications
      .find({ organisationId: ${JSON.stringify(organisationId)} })
      .forEach((application) => {
        const current = application.overseasSites?.sites ?? []
        let changed = false
        const next = current.map((site) => {
          const seed = seeded.find((s) => s.siteId === site.siteId)
          if (!seed) return site
          changed = true
          return site.overseasSiteEntityId
            ? { ...seed, overseasSiteEntityId: site.overseasSiteEntityId }
            : seed
        })
        if (!changed) return
        applications += database.accreditationApplications.updateOne(
          { _id: application._id },
          { $set: { 'overseasSites.sites': next } }
        ).modifiedCount

        if (!application.registrationEntityId) return
        const versions = database.overseasSiteVersions
        for (const orsId of seeded.map((s) => s.orsId)) {
          const filter = { registrationId: application.registrationEntityId, orsId }
          orsVersions += versions.deleteMany({
            ...filter,
            'lastChange.reason': 'ChangeRequestGranted'
          }).deletedCount
          if (versions.countDocuments({ ...filter, isCurrent: true }) > 0) continue
          const [latest] = versions.find(filter).sort({ version: -1 }).limit(1).toArray()
          if (latest) {
            versions.updateOne(
              { _id: latest._id },
              { $set: { isCurrent: true, validTo: ISODate('9999-12-31T23:59:59.999Z') } }
            )
          }
        }
      })
    print(JSON.stringify({ applications, orsVersions }))
  `)
}
