// The interim sites the integration workflow's exporter application (Test 2)
// gives each status history to, and the accreditation API tests look for once
// Test 4 has granted it (RA-781). Shared so the two agree on the names: the
// API tests run in a process of their own, after the frontend run.
//
// All three are on the new overseas site's interim sites, numbered from 1 as
// addNewSiteWithInterimSites names them.

export const SUBMISSION_INTERIM_SITE_NAME = 'Penang Interim Storage Yard'

export const INTERIM_SITE_STATUSES = {
  // Withdrawn, then restored: one interim site, approved, withdrawn, approved.
  restored: `${SUBMISSION_INTERIM_SITE_NAME} 1`,
  // Withdrawn and left so.
  withdrawn: `${SUBMISSION_INTERIM_SITE_NAME} 2`,
  // Added on the withdrawn one's overseas site after it was withdrawn: a
  // separate interim site.
  replacement: `${SUBMISSION_INTERIM_SITE_NAME} 3`
}
