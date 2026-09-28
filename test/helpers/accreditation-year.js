import { listApplications } from './case-management.js'

// Allocates the disposable accreditation year a journey seeds its own draft
// against, replacing the `String(3000 + (Date.now() % 1000))` several specs
// used to draw independently.
//
// The clock version looked unique but was not. The backend derives an
// application's reference at submit time from
// `AP{year % 100}{agency}{orgNumber}{postcodeSuffix}{material}`
// (StubCaseWorkingApiAdapter.GenerateReference), and that reference carries a
// unique index in Mongo. Only the last two digits of the year reach it, so
// 1000 apparently-distinct years collapsed to 100 distinct references per
// org + material - and several specs drew from that same 100 independently,
// against the same orgs, while the full-journey specs submit the static 2027
// (residue 27) on those orgs too.
//
// Years are therefore allocated rather than drawn:
//
//   - every journey owns a slot below, and each slot owns its own private,
//     contiguous block of EVEN residues, so no two journeys can ever share an
//     application reference - in the same run or any later one;
//   - leaving the odd residues unused keeps 2027 (residue 27, the static year
//     behind every /operator link, submitted by operator-accreditation and
//     exporter-accreditation) permanently out of reach, and leaves `year + 1`
//     free for restart-withdrawn-application.e2e.js's assertion that the
//     following year holds nothing;
//   - Mongo persists between local runs (compose.yml's named `mongodb-data`
//     volume), so a slot takes the first year in its block that the
//     org + material has not used yet. A fresh CI stack always hands every
//     journey the first year in its block.
const JOURNEY_SLOTS = [
  'status-push:approved',
  'status-push:rejected',
  'status-push:withdrawn',
  'regulator-query-banner',
  'sampling-plan-back-button',
  'withdraw-application',
  'restart-withdrawn-application',
  'ra-570-amend-bes-evidence',
  'ra-583-bes-status-after-resubmit',
  'ra-588-bes-amend-back-link'
]

// Years run 3000-3098, so `year % 100` is the residue itself. The band is the
// one the clock-drawn years already used, well clear of any real accreditation
// year the seeded fixtures hold.
const YEAR_BASE = 3000
const EVEN_RESIDUES = 50

// Blocks are carved by integer division, so they stay disjoint whatever the
// slot count - no coprimality argument to get wrong when a journey is added.
// At ten slots each block holds five years, which is how many times a single
// journey can seed a fresh application before the stack needs resetting. Most
// take one per run; regulator-query-banner.e2e.js takes one per test.
const YEARS_PER_SLOT = Math.floor(EVEN_RESIDUES / JOURNEY_SLOTS.length)

export async function disposableYear(journey, organisationId, materialType) {
  const slot = JOURNEY_SLOTS.indexOf(journey)
  if (slot === -1) {
    throw new Error(
      `Unknown journey "${journey}" - give it its own slot in JOURNEY_SLOTS (test/helpers/accreditation-year.js)`
    )
  }

  const takenResidues = new Set(
    (await listApplications(organisationId))
      .filter((application) => application.materialType === materialType)
      .map((application) => application.year % 100)
  )

  for (let offset = 0; offset < YEARS_PER_SLOT; offset++) {
    const residue = 2 * (slot * YEARS_PER_SLOT + offset)
    if (!takenResidues.has(residue)) {
      return String(YEAR_BASE + residue)
    }
  }

  throw new Error(
    `No disposable accreditation year left for "${journey}" on organisation ${organisationId} / ${materialType}: ` +
      `all ${YEARS_PER_SLOT} of its years are in use. Reset the stack with \`docker compose down -v\`.`
  )
}
