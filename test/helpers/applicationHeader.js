// Mirrors materialDisplayName.js and applicationHeader.js in
// epr-register-enrol-frontend (RA-309), so e2e assertions can derive the
// expected persistent-header text from the live application data returned
// by getApplication() rather than hardcoding fixture copy that can drift.

const GLASS_RECYCLING_PROCESS_LABELS = {
  glass_re_melt: 'Glass - Remelt',
  glass_other: 'Glass - Other'
}

export function expectedMaterialDisplay(application) {
  const { materialType, glassRecyclingProcess } = application
  if (!materialType) {
    return ''
  }

  const glassLabel = GLASS_RECYCLING_PROCESS_LABELS[glassRecyclingProcess]
  if (materialType === 'Glass' && glassLabel) {
    return glassLabel
  }

  return materialType
}

// RA-424: exporters show their UK registered address in place of the
// overseas/reprocessing site address, which the backend never populates for
// them — not the literal string "Exporter". The backend already formats and
// returns it as application.companyRegisteredAddress (see
// AccreditationApplicationModel.CompanyRegisteredAddress), so no separate
// organisation lookup is needed.
export function expectedSiteName(application) {
  return application.isExporter
    ? (application.companyRegisteredAddress ?? 'Not set')
    : (application.siteAddress ?? 'Not set')
}

// RA-506: mirrors composeApplicationCaption in
// epr-register-enrol-frontend's applicationHeader.js — every present part
// is comma-joined, and siteName is the RAW (pre-"Not set"-fallback) value,
// omitted entirely when the application has none.
export function expectedCaptionText(application) {
  const rawSiteName = application.isExporter
    ? application.companyRegisteredAddress
    : application.siteAddress

  const parts = [
    application.year,
    expectedMaterialDisplay(application),
    rawSiteName
  ].filter((part) => part !== null && part !== undefined && part !== '')

  return `${application.organisationName} (${parts.join(', ')})`
}
