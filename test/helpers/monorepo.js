import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

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
 * RA-782: the work item's status pushes to the operator backend, read from
 * case management's audit log: every `status-push*` entry (sent, skipped or
 * failed), oldest first, as { action, actionId, toStateId }.
 *
 * @param {string} workItemId
 * @returns {Promise<Array<{ action: string, actionId: string, toStateId: string }>>}
 */
export async function statusPushesFor(workItemId) {
  return mongosh(`
    const workItem = db.getSiblingDB('${CASE_MANAGEMENT_DATABASE}').workItems
      .findOne({ _id: ${JSON.stringify(workItemId)} }, { auditLog: 1 })
    print(JSON.stringify(
      (workItem?.auditLog ?? [])
        .filter((e) => e.action.startsWith('status-push'))
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((e) => ({
          action: e.action,
          actionId: e.details?.actionId,
          toStateId: e.details?.toStateId
        }))
    ))
  `)
}

/**
 * Where an organisation's ORS snapshot is kept between `resetOverseasSites`
 * calls: outside the repo, and on disk rather than in memory, so a run that
 * is killed before its `after` hook leaves it for the next run to restore.
 */
const snapshotPath = (organisationId) =>
  path.join(
    os.tmpdir(),
    'epr-register-enrol-fe-tests',
    `ors-snapshot-${organisationId}.json`
  )

/**
 * The versions a grant writes, in the domain model, are rolled back to the
 * one before the first grant. Mongosh source, for the reset script below:
 * `rollBackGrants(versions, filter, label)` deletes the entity's first
 * ChangeRequestGranted version and every version after it (a version written
 * on top of a grant carries the grant's changes), makes the version before
 * current again and returns how many it deleted. Anything unexpected (a
 * non-grant version on top of a grant, no version before the grant, not
 * exactly one current version, a current version that is itself a grant) is
 * pushed onto `mismatches` rather than skipped silently.
 */
const ROLL_BACK_GRANTS = `
  const GRANTED = 'ChangeRequestGranted'
  const mismatches = []
  function rollBackGrants(versions, filter, label) {
    let deleted = 0
    // Not migrated: nothing in the model to roll back.
    if (versions.countDocuments(filter) === 0) return 0
    const [firstGrant] = versions
      .find({ ...filter, 'lastChange.reason': GRANTED })
      .sort({ version: 1 })
      .limit(1)
      .toArray()
    if (firstGrant) {
      versions
        .find({
          ...filter,
          version: { $gt: firstGrant.version },
          'lastChange.reason': { $ne: GRANTED }
        })
        .forEach((v) => mismatches.push(
          label + ' version ' + v.version + ' (' + v.lastChange?.reason +
            ') was written on top of a grant and is deleted with it'
        ))
      deleted = versions
        .deleteMany({ ...filter, version: { $gte: firstGrant.version } })
        .deletedCount
      const [before] = versions.find(filter).sort({ version: -1 }).limit(1).toArray()
      if (before) {
        versions.updateOne(
          { _id: before._id },
          { $set: { isCurrent: true, validTo: ISODate('9999-12-31T23:59:59.999Z') } }
        )
      } else {
        mismatches.push(label + ' has no version before its first grant')
      }
    }
    const current = versions.find({ ...filter, isCurrent: true }).toArray()
    if (current.length !== 1) {
      mismatches.push(label + ' has ' + current.length + ' current versions')
    } else if (current[0].lastChange?.reason === GRANTED) {
      mismatches.push(label + ' version ' + current[0].version + ', now current, is a grant')
    }
    return deleted
  }
`

/**
 * The organisation's ORSs with the site ids given, as they stand now on each
 * of its accreditation applications, as an EJSON string.
 *
 * @param {{ organisationId: string, siteIds: number[] }} org
 * @returns {Promise<string>}
 */
async function readOverseasSites({ organisationId, siteIds }) {
  return mongosh(`
    const siteIds = ${JSON.stringify(siteIds)}
    const applications = db.getSiblingDB('${OPERATOR_DATABASE}')
      .accreditationApplications
      .find({ organisationId: ${JSON.stringify(organisationId)} })
      .toArray()
      .map((a) => ({
        _id: a._id,
        sites: (a.overseasSites?.sites ?? []).filter((s) => siteIds.includes(s.siteId))
      }))
      .filter((a) => a.sites.length > 0)
    print(JSON.stringify(EJSON.stringify(applications)))
  `)
}

/**
 * RA-782: puts the organisation's accredited ORSs with the site ids given
 * back as they were before the spec changed them, so a spec that grants an
 * update to one (its details, interim sites or BES evidence) can run again:
 *
 * - on the organisation's accreditation applications, each site is replaced
 *   by its snapshot, keeping the domain model id the migration gave it (the
 *   first write migrates the application when dual-write is on);
 * - in the domain model, when dual-write is on (it is off on the committed
 *   monorepo stack; only a local compose override turns it on), each ORS's
 *   versions and the Accreditation's versions are rolled back to before the
 *   first grant (a grant that adds BES evidence writes an Accreditation
 *   version too). Nothing there until the application has been migrated.
 *
 * The snapshot is the one an earlier call left on disk, if any (a run killed
 * before its `after` hook), otherwise the sites as they are now, saved to disk
 * for the `after` hook. `discardOverseasSitesSnapshot` removes it once the
 * spec has finished. A first run on an organisation already changed by a run
 * of a version of this suite that kept no snapshot would snapshot the changed
 * sites: the spec checks the names it starts from.
 *
 * @param {{ organisationId: string, siteIds: number[] }} org
 * @returns {Promise<{ snapshot: 'saved earlier' | 'taken now',
 *   applications: number, orsVersions: number, accreditationVersions: number,
 *   mismatches: string[], sites: object[] }>} how many applications were
 *   changed and model versions deleted, anything unexpected in the model, and
 *   the restored sites
 */
export async function resetOverseasSites({ organisationId, siteIds }) {
  const file = snapshotPath(organisationId)
  let snapshot = await readFile(file, 'utf8').catch(() => null)
  const source = snapshot ? 'saved earlier' : 'taken now'
  if (!snapshot) {
    snapshot = await readOverseasSites({ organisationId, siteIds })
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, snapshot)
  }

  const result = await mongosh(`
    const database = db.getSiblingDB('${OPERATOR_DATABASE}')
    const snapshot = EJSON.parse(${JSON.stringify(snapshot)})
    ${ROLL_BACK_GRANTS}
    let applications = 0
    let orsVersions = 0
    let accreditationVersions = 0
    for (const saved of snapshot) {
      const application = database.accreditationApplications.findOne({ _id: saved._id })
      if (!application) {
        mismatches.push('accreditation application ' + saved._id + ' is gone')
        continue
      }
      const next = (application.overseasSites?.sites ?? []).map((site) => {
        const copy = saved.sites.find((s) => s.siteId === site.siteId)
        if (!copy) return site
        return site.overseasSiteEntityId
          ? { ...copy, overseasSiteEntityId: site.overseasSiteEntityId }
          : copy
      })
      applications += database.accreditationApplications.updateOne(
        { _id: application._id },
        { $set: { 'overseasSites.sites': next } }
      ).modifiedCount

      if (application.registrationEntityId) {
        for (const { orsId } of saved.sites) {
          orsVersions += rollBackGrants(
            database.overseasSiteVersions,
            { registrationId: application.registrationEntityId, orsId },
            'ORS ' + orsId
          )
        }
      }
      if (application.accreditationEntityId) {
        accreditationVersions += rollBackGrants(
          database.accreditationVersions,
          { entityId: application.accreditationEntityId },
          'Accreditation'
        )
      }
    }
    print(JSON.stringify({ applications, orsVersions, accreditationVersions, mismatches }))
  `)
  if (result.mismatches.length > 0) {
    process.stdout.write(
      `resetOverseasSites(${organisationId}): ${result.mismatches.length} domain model mismatch(es):\n  ${result.mismatches.join('\n  ')}\n`
    )
  }
  const sites = JSON.parse(snapshot).flatMap((application) => application.sites)
  return { snapshot: source, ...result, sites }
}

/**
 * Deletes the snapshot `resetOverseasSites` saved, once the spec has put the
 * sites back, so the next run snapshots them afresh.
 *
 * @param {string} organisationId
 */
export async function discardOverseasSitesSnapshot(organisationId) {
  await rm(snapshotPath(organisationId), { force: true })
}
