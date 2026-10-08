import { request } from 'undici'
import { backendUrl, frontendSharedSecret } from '../config.js'

function apiUrl(path) {
  return `${backendUrl}/api/v1/accreditation-applications${path}`
}

// Every route in this file except raiseQuery/pushStatusChanged (below) sits behind
// FrontendAuthenticationHandler — impersonate epr-register-enrol-frontend's own outbound
// header. See config.js's frontendSharedSecret for why this is a no-op locally.
function frontendAuthHeaders() {
  return frontendSharedSecret
    ? { authorization: `Bearer ${frontendSharedSecret}` }
    : {}
}

export async function getApplication(organisationId, applicationId) {
  const { statusCode, body } = await request(
    apiUrl(`/${organisationId}/${applicationId}`),
    { headers: frontendAuthHeaders() }
  )
  if (statusCode !== 200) {
    throw new Error(
      `Failed to fetch application ${applicationId}: HTTP ${statusCode}`
    )
  }
  return body.json()
}

// Every application the backend holds for an organisation, newest first.
// Withdrawn records are included, so this is the accessor to reach for when a
// journey needs to prove what a year now holds rather than just what the
// landing page chose to render.
export async function listApplications(organisationId) {
  const { statusCode, body } = await request(apiUrl(`/${organisationId}`), {
    headers: frontendAuthHeaders()
  })
  if (statusCode !== 200) {
    throw new Error(
      `Failed to list applications for organisation ${organisationId}: HTTP ${statusCode}`
    )
  }
  return body.json()
}

// One accreditation year can hold more than one application — restarting after
// a withdrawal keeps the withdrawn record and adds a live one alongside it — so
// callers need the whole set for a year, not a single "the" application.
export async function listApplicationsForYear(
  organisationId,
  { registrationId, materialType, year }
) {
  const applications = await listApplications(organisationId)
  return applications.filter(
    (application) =>
      application.registrationId === registrationId &&
      application.materialType === materialType &&
      application.year === Number(year)
  )
}

// Direct-API accessor for the overseas sites nested under an application, so
// isNewSite (RA-297) can be asserted without a dashboard — management-fe is
// out of scope for this suite, see the RA-311 precedent above. Each site may
// itself carry a nested `interimSite` (RA-294's 1:1 add-interim-site wizard
// result), which also carries its own isNewSite.
export async function getOverseasSites(organisationId, applicationId) {
  const application = await getApplication(organisationId, applicationId)
  return application.overseasSites?.sites ?? []
}

// RA-597: every overseas site in the application must have everything a fresh
// add asks for, and ReEx supplies only a name, address and coordinates - never
// contact details, recycling operations, Basel/OECD codes or repatriated loads.
// The stub seeds some organisations' applications with such sites already
// selected, so a journey that is about something else would be stopped at the
// site list. This fills in whatever is missing, through the backend, so those
// journeys can carry on; a journey about the completeness check itself leaves
// the seeded sites alone and goes through the UI.
const COMPLETE_SITE_DETAILS = {
  addressLine1: '1 Hafenstrasse',
  townOrCity: 'Hamburg',
  coordinates: '53.5511, 9.9937',
  contactName: 'Greta Schmidt',
  contactEmail: 'greta.schmidt@example.com',
  code1: 'A1181',
  repatriatedLoads: 'Rejected loads are returned within 30 days.'
}

// The "material" recycling code each material accepts (R3/R4/R5).
const CORE_RECYCLING_CODE = {
  Aluminium: 'R4',
  Fibre: 'R3',
  Glass: 'R5',
  Paper: 'R3',
  Plastic: 'R3',
  Steel: 'R4',
  Wood: 'R3'
}

const NEEDS_CONDITIONS_OF_EXPORT = new Set(['Steel', 'Aluminium'])

function fillMissingDetails(site, materialType) {
  const filled = { ...site }
  for (const [field, value] of Object.entries(COMPLETE_SITE_DETAILS)) {
    filled[field] = filled[field] || value
  }
  if (!filled.operationCodes?.length) {
    filled.operationCodes = [CORE_RECYCLING_CODE[materialType]]
  }
  if (
    NEEDS_CONDITIONS_OF_EXPORT.has(materialType) &&
    typeof filled.conditionsOfExport !== 'boolean'
  ) {
    filled.conditionsOfExport = true
  }
  return filled
}

export async function completeOverseasSites(organisationId, applicationId) {
  const application = await getApplication(organisationId, applicationId)
  const sites = (application.overseasSites?.sites ?? []).map((site) =>
    site.selected === false
      ? site
      : fillMissingDetails(site, application.materialType)
  )

  const { statusCode, body } = await request(
    apiUrl(`/${organisationId}/${applicationId}/overseas-sites`),
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...frontendAuthHeaders()
      },
      body: JSON.stringify({ sites })
    }
  )
  if (statusCode !== 200) {
    const text = await body.text()
    throw new Error(
      `Failed to complete the overseas sites of application ${applicationId}: HTTP ${statusCode} ${text}`
    )
  }
  return body.json()
}

// Simulates case-management-backend raising a query against an application,
// bypassing the management-fe UI (out of scope for this repo, see RA-311).
//
// case-management/* routes sit behind CaseManagementAuthenticationHandler (HMAC
// signature + timestamp + nonce, not the Bearer scheme frontendAuthHeaders() sends),
// same as before FrontendAuthenticationHandler existed — this call has never carried
// that signature and relies entirely on the backend's Development-mode bypass, same
// as it always has. Out of scope here; flagging rather than silently leaving unnoted.
export async function raiseQuery(
  organisationId,
  applicationId,
  { queryNote, sectionKeys }
) {
  const application = await getApplication(organisationId, applicationId)
  const workItemId = application.caseManagementWorkItemId
  if (!workItemId) {
    throw new Error(
      `Application ${applicationId} has no caseManagementWorkItemId to raise a query against`
    )
  }

  const { statusCode, body } = await request(
    apiUrl(`/case-management/${workItemId}/query`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queryNote, sectionKeys })
    }
  )
  if (statusCode !== 200) {
    const text = await body.text()
    throw new Error(
      `Failed to raise query against work item ${workItemId}: HTTP ${statusCode} ${text}`
    )
  }
  return body.json()
}

// Simulates case-management pushing a generic status change to OJ (RA-368),
// bypassing management-fe (out of scope for this repo, see RA-311 precedent
// above). Unlike raiseQuery, this covers the other CM transitions
// (duly-made, approved, rejected, ...) that OJ's ApplicationStatus now
// projects directly from CM state ids.
export async function pushStatusChanged(
  organisationId,
  applicationId,
  { toStateId, toStateDisplayName, actionId, actionDisplayName, occurredAt }
) {
  const application = await getApplication(organisationId, applicationId)
  const workItemId = application.caseManagementWorkItemId
  if (!workItemId) {
    throw new Error(
      `Application ${applicationId} has no caseManagementWorkItemId to push a status change against`
    )
  }

  const { statusCode, body } = await request(
    apiUrl(`/case-management/${workItemId}/status`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        toStateId,
        toStateDisplayName,
        actionId,
        actionDisplayName,
        occurredAt: occurredAt ?? new Date().toISOString()
      })
    }
  )
  if (statusCode !== 200) {
    const text = await body.text()
    throw new Error(
      `Failed to push status change against work item ${workItemId}: HTTP ${statusCode} ${text}`
    )
  }
  return body.json()
}

// Calls the OJ Withdraw endpoint directly, the same bypass-the-UI approach
// as patchSection below, to prove the backend's own withdraw guard - not
// just the frontend withdraw link's visibility - accepts the request. Added
// for RA-368: the guard used to wrongly 409 once AwaitingDecision became a
// reachable status (see status-push.e2e.js).
export async function withdrawApplication(
  organisationId,
  applicationId,
  { reason }
) {
  const { statusCode, body } = await request(
    apiUrl(`/${organisationId}/${applicationId}/withdraw`),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...frontendAuthHeaders() },
      body: JSON.stringify({ reason })
    }
  )
  return { statusCode, text: await body.text() }
}

// Calls a section PATCH endpoint directly, to prove the backend's own
// status/section-editability gate rejects the write server-side — the
// frontend redirect is a UX affordance only, not the real enforcement.
export async function patchSection(
  organisationId,
  applicationId,
  sectionPath,
  payload = {}
) {
  const { statusCode, body } = await request(
    apiUrl(`/${organisationId}/${applicationId}/${sectionPath}`),
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...frontendAuthHeaders() },
      body: JSON.stringify(payload)
    }
  )
  return { statusCode, text: await body.text() }
}
