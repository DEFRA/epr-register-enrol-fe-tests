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
  if (!materialType) return ''

  const glassLabel = GLASS_RECYCLING_PROCESS_LABELS[glassRecyclingProcess]
  if (materialType === 'Glass' && glassLabel) return glassLabel

  return materialType
}

export function expectedSiteName(application) {
  return application.isExporter
    ? 'Exporter'
    : (application.siteAddress ?? 'Not set')
}
