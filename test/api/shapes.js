import assert from 'node:assert/strict'

import {
  assertAbsent,
  assertOneOf,
  assertStatusHistory,
  assertLatestStatus,
  assertLatestStatusMatchesHistory
} from './status-history.js'
import { year } from './support.js'

// The response shapes, as docs/openapi/registration-accreditation-api.v2.yaml
// in epr-register-enrol-backend describes them. Shared by the contract and
// search tests.

export const MATERIALS = [
  'Steel',
  'Wood',
  'Aluminium',
  'Fibre',
  'Glass',
  'Paper',
  'Plastic'
]
export const BANDS = ['up_to_500', 'up_to_5000', 'up_to_10000', 'over_10000']
export const GLASS = ['glass_re_melt', 'glass_other']

export function assertSummary(item) {
  assert.equal(typeof item.organisationNumber, 'number')
  assert.equal(typeof item.registrationNumber, 'string')
  assert.equal(typeof item.accreditationNumber, 'string')
  assert.equal(typeof item.accreditationYear, 'number')
  assertOneOf(item.material, MATERIALS, 'material')
  assertOneOf(item.wasteProcessingType, ['reprocessor', 'exporter'], 'type')
  if ('tonnageBand' in item) {
    assertOneOf(item.tonnageBand, BANDS, 'tonnageBand')
  }
  if ('glassRecyclingProcess' in item) {
    assertOneOf(item.glassRecyclingProcess, GLASS, 'glassRecyclingProcess')
  }
  // v1 names and application data, removed in v2.
  assertAbsent(
    item,
    [
      'accreditationReference',
      'year',
      'prnIssuance',
      'businessPlan',
      'siteAddress',
      'submitterContactDetails',
      'applicationStatus',
      'samplingPlan',
      'samplingInspectionPlan',
      'besEvidence',
      'formSubmissionTime'
    ],
    'accreditation'
  )
}

// An interim site's shape, and its status (RA-781): approved from when its
// overseas site was, then withdrawn and approved again each time it is
// withdrawn and restored. Its statusHistory and latestStatus have an
// accreditation's shape and date rules. Withdrawn interim sites are always
// returned, so there is no removedAt.
export function assertInterimSite(site, accreditationYear = year) {
  assert.equal(typeof site.siteId, 'number')
  assert.equal(typeof site.siteNumber, 'string')
  assert.equal(typeof site.siteName, 'string')
  for (const field of ['line1', 'town', 'country']) {
    assert.equal(
      typeof site.address?.[field],
      'string',
      `interim address.${field}`
    )
  }
  for (const field of ['fullName', 'email', 'phone']) {
    assert.equal(
      typeof site.contact?.[field],
      'string',
      `interim contact.${field}`
    )
  }
  assert.ok(Array.isArray(site.operationCodes))
  const what = `interim site ${site.siteName}`
  assertAbsent(
    site,
    ['isNewSite', 'addressLine1', 'contactName', 'removedAt'],
    what
  )
  assertLatestStatus(site, what)
  assertStatusHistory(site.statusHistory, what, accreditationYear)
  assertLatestStatusMatchesHistory(site, what)
  site.statusHistory.forEach(({ status }, index) => {
    assert.equal(
      status,
      index % 2 === 0 ? 'approved' : 'withdrawn',
      `${what} history is approved, then alternates withdrawn and approved`
    )
  })
}

// accreditationYear is the year of the accreditation the site is on: the
// response's own, or the year the path was built with (support.js's year).
export function assertOverseasSite(site, { accreditationYear = year } = {}) {
  const what = `site ${site.orsId ?? site.siteName}`
  assert.equal(typeof site.siteId, 'number')
  if (site.orsId) {
    assert.match(site.orsId, /^\d{3}$/)
  }
  assert.equal(typeof site.siteName, 'string')
  assert.ok(Array.isArray(site.operationCodes))
  assert.equal(typeof site.isEu, 'boolean')
  assert.equal(typeof site.isOecd, 'boolean')
  if ('address' in site) {
    assert.equal(typeof site.address, 'object')
  }
  if ('contact' in site) {
    assert.equal(typeof site.contact, 'object')
  }
  // validFrom is no longer served: the status history carries the dates.
  assertAbsent(site, ['validFrom'], what)
  assertStatusHistory(site.statusHistory, what, accreditationYear)
  assert.ok(Array.isArray(site.interimSites))
  for (const interim of site.interimSites) {
    assertInterimSite(interim, accreditationYear)
  }
  assertAbsent(
    site,
    [
      'code1',
      'code2',
      'code3',
      'isNewSite',
      'selected',
      'registeredNowAccredited',
      'interimSiteIds',
      'siteAddress'
    ],
    what
  )
}
