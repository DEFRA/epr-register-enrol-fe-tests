import { request } from 'undici'
import { backendUrl } from '../config.js'

function apiUrl(path) {
  return `${backendUrl}/api/v1/accreditation-applications${path}`
}

export async function getApplication(organisationId, applicationId) {
  const { statusCode, body } = await request(
    apiUrl(`/${organisationId}/${applicationId}`)
  )
  if (statusCode !== 200) {
    throw new Error(
      `Failed to fetch application ${applicationId}: HTTP ${statusCode}`
    )
  }
  return body.json()
}

// Simulates case-management-backend raising a query against an application,
// bypassing the management-fe UI (out of scope for this repo, see RA-311).
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }
  )
  return { statusCode, text: await body.text() }
}
