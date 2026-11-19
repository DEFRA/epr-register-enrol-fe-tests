// The accreditation API's fixed test data (RA-646, RA-647): the records
// epr-register-enrol-backend seeds on startup in dev, test and ext-test
// (TestData__SeedOnStartup), as the "Test data" table in its
// docs/reex-api-onboarding.md lists them. Every value here follows
// EprRegisterEnrolBackend/TestData/AccreditationApiTestData.cs, so each test
// can check a response field for field.

// Every fixed record is recorded at this instant, and its status applies from
// 1 January of its accreditation year.
export const RECORDED_AT = '2026-10-01T00:00:00Z'
export const WITHDRAWN_AT = '2026-10-15T00:00:00Z'

/**
 * @typedef {object} Fixture
 * @property {number} orgId
 * @property {string} registrationNumber
 * @property {string | null} accreditationNumber null when never granted
 * @property {number} year
 * @property {string} material
 * @property {'reprocessor' | 'exporter'} wasteProcessingType
 * @property {number} overseasSites accredited overseas sites
 * @property {number} interimSitesPerSite
 * @property {number} [unaccreditedOverseasSites] registered, not accredited
 * @property {boolean} [withdrawnInterimSite] a withdrawn interim site on 001
 * @property {boolean} served whether the API serves it
 * @property {string} what the doc's description
 */

function fixture({
  orgId,
  materialCode,
  material,
  exporter,
  year = 2027,
  granted = true,
  overseasSites = 0,
  interimSitesPerSite = 0,
  unaccreditedOverseasSites = 0,
  withdrawnInterimSite = false,
  what
}) {
  const kind = exporter ? 'EX' : 'ER'
  const tail = `${orgId}${exporter ? '0002' : '0000'}${materialCode}`
  return {
    orgId,
    registrationNumber: `R26${kind}${tail}`,
    accreditationNumber: granted ? `A${year % 100}${kind}${tail}` : null,
    year,
    material,
    wasteProcessingType: exporter ? 'exporter' : 'reprocessor',
    overseasSites,
    interimSitesPerSite,
    unaccreditedOverseasSites,
    withdrawnInterimSite,
    served: granted && year >= 2027,
    what
  }
}

/** @type {Record<string, Fixture>} */
export const FIXTURES = {
  exporterPaper: fixture({
    orgId: 990001,
    materialCode: 'PA',
    material: 'Paper',
    exporter: true,
    overseasSites: 1,
    interimSitesPerSite: 1,
    what: 'exporter, paper, 1 overseas site (001) with 1 interim site'
  }),
  exporterFibre: fixture({
    orgId: 990002,
    materialCode: 'FB',
    material: 'Fibre',
    exporter: true,
    overseasSites: 10,
    interimSitesPerSite: 2,
    what: 'exporter, fibre, 10 overseas sites (001 to 010) each with 2 interim sites'
  }),
  reprocessorPlastic: fixture({
    orgId: 990003,
    materialCode: 'PL',
    material: 'Plastic',
    exporter: false,
    what: 'reprocessor, plastic'
  }),
  reprocessorSteel: fixture({
    orgId: 990004,
    materialCode: 'ST',
    material: 'Steel',
    exporter: false,
    what: 'reprocessor, steel (the metal example)'
  }),
  exporterWood: fixture({
    orgId: 990005,
    materialCode: 'WD',
    material: 'Wood',
    exporter: true,
    overseasSites: 2,
    interimSitesPerSite: 1,
    unaccreditedOverseasSites: 1,
    withdrawnInterimSite: true,
    what: 'exporter, wood, 001 and 002 accredited, 003 registered only, a withdrawn interim site on 001'
  }),
  reprocessorAluminium2027: fixture({
    orgId: 990006,
    materialCode: 'AL',
    material: 'Aluminium',
    exporter: false,
    what: 'reprocessor, aluminium, 2027'
  }),
  reprocessorAluminium2028: fixture({
    orgId: 990006,
    materialCode: 'AL',
    material: 'Aluminium',
    exporter: false,
    year: 2028,
    what: 'reprocessor, aluminium, 2028'
  }),
  notGranted: fixture({
    orgId: 990007,
    materialCode: 'PL',
    material: 'Plastic',
    exporter: false,
    granted: false,
    what: 'an application submitted but never granted'
  }),
  before2027: fixture({
    orgId: 990008,
    materialCode: 'ST',
    material: 'Steel',
    exporter: false,
    year: 2026,
    what: 'approved for 2026, before the first year served'
  })
}

export const ALL = Object.values(FIXTURES)
export const SERVED = ALL.filter(({ served }) => served)
export const EXPORTERS = SERVED.filter(
  ({ wasteProcessingType }) => wasteProcessingType === 'exporter'
)

export const label = (f) =>
  `${f.orgId} ${f.accreditationNumber ?? f.registrationNumber} (${f.year})`

export const detailPath = (f, year = f.year) =>
  `/v1/organisations/${f.orgId}/registrations/${f.registrationNumber}/accreditations/${year}`

export const sitesPath = (f) => `${detailPath(f)}/overseas-sites`

/** The one status entry every fixed record has. */
export const statusEntry = (year) => ({
  status: 'approved',
  effectiveFromDate: `${year}-01-01`,
  effectiveToDate: null,
  recordedAt: RECORDED_AT
})

/** A search item: the summary, in the documented fields. */
export function expectedSummary(f) {
  return {
    organisationNumber: f.orgId,
    registrationNumber: f.registrationNumber,
    accreditationNumber: f.accreditationNumber,
    accreditationYear: f.year,
    material: f.material,
    wasteProcessingType: f.wasteProcessingType,
    latestStatus: statusEntry(f.year),
    tonnageBand: 'up_to_5000'
  }
}

function expectedInterimSite(f, orsId, siteId, i, withdrawn) {
  return {
    siteId: siteId * 10 + i,
    siteNumber: `TD-${f.orgId}-${orsId}-${i}`,
    siteName: withdrawn
      ? `Test Data Withdrawn Interim Site ${orsId}-${i}`
      : `Test Data Interim Site ${orsId}-${i}`,
    address: {
      line1: `${i} Tussenstraat`,
      town: 'Rotterdam',
      country: 'Netherlands',
      postcode: '3011 AA'
    },
    contact: {
      fullName: 'Test Data Interim Contact',
      email: 'test.interim@example.com',
      phone: '+31 10 000 0000'
    },
    operationCodes: ['R12'],
    createdAt: RECORDED_AT,
    ...(withdrawn && { removedAt: WITHDRAWN_AT })
  }
}

/** Accredited overseas site number (1-based), as the API returns it. */
export function expectedSite(f, number, { includeWithdrawn = false } = {}) {
  const orsId = String(number).padStart(3, '0')
  const siteId = f.orgId * 100 + number
  const interimSites = Array.from({ length: f.interimSitesPerSite }, (_, i) =>
    expectedInterimSite(f, orsId, siteId, i + 1, false)
  )
  if (includeWithdrawn && f.withdrawnInterimSite && number === 1) {
    interimSites.push(
      expectedInterimSite(f, orsId, siteId, f.interimSitesPerSite + 1, true)
    )
  }
  return {
    siteId,
    orsId,
    siteName: `Test Data Overseas Site ${orsId}`,
    formattedAddress: `${number} Hafenstrasse, Hamburg, Germany`,
    address: {
      line1: `${number} Hafenstrasse`,
      town: 'Hamburg',
      country: 'Germany'
    },
    contact: {
      fullName: 'Test Data Site Contact',
      email: 'test.site@example.com',
      phone: '+49 40 000000'
    },
    operationCodes: ['R3'],
    isEu: true,
    isOecd: true,
    latestStatus: statusEntry(f.year),
    statusHistory: [statusEntry(f.year)],
    interimSites
  }
}

/** Every accredited site, in orsId order. */
export const expectedSites = (f, options) =>
  Array.from({ length: f.overseasSites }, (_, i) =>
    expectedSite(f, i + 1, options)
  )

/** The whole accreditation, as the detail route returns it. */
export function expectedDetail(f, options) {
  return {
    ...expectedSummary(f),
    statusHistory: [statusEntry(f.year)],
    tonnageBandHistory: [
      { tonnageBand: 'up_to_5000', recordedAt: RECORDED_AT }
    ],
    signatories: [
      { fullName: 'Test Data Authoriser', email: 'test.authoriser@example.com' }
    ],
    ...(f.wasteProcessingType === 'exporter' && {
      overseasSites: expectedSites(f, options)
    })
  }
}
