import { listApplications } from './case-management.js'

// Allocates the disposable accreditation year a journey seeds its own draft
// against, replacing the `String(3000 + (Date.now() % 1000))` several specs
// used to draw independently.
//
// The clock version looked unique but was not. The backend builds an
// application's reference at submit time as
// `AP{year % 100}{agency}{orgNumber}{postcodeSuffix}{material}`
// (StubCaseWorkingApiAdapter.GenerateReference), and that reference carries a
// unique index in Mongo. Only the last two digits of the year reach it, so
// 1000 apparently-distinct years collapsed to 100 distinct references per
// org + material. Two journeys on the same org landing on years 100 apart -
// or on the static 2027 the /operator links use - made the second submit fail
// with a duplicate-key 500, which the spec could only see as a confirmation
// panel that never rendered.
//
// Years are therefore allocated rather than drawn:
//
//   - every journey owns a slot below, and slots map to distinct EVEN
//     residues, so no two journeys in a run can ever share a reference;
//   - leaving the odd residues unused keeps 2027 (residue 27, the static year
//     behind every /operator link, submitted by operator-accreditation and
//     exporter-accreditation) permanently out of reach, and keeps `year + 1`
//     free for restart-withdrawn-application.e2e.js's assertion that the
//     following year holds nothing;
//   - Mongo persists between local runs (compose.yml's named `mongodb-data`
//     volume), so each slot walks its own lane of even residues and takes the
//     first one that org + material has not used yet. A fresh CI stack always
//     hands every journey its first choice.
const JOURNEY_SLOTS = [
  'status-push:approved',
  'status-push:rejected',
  'status-push:withdrawn',
  'regulator-query-banner',
  'sampling-plan-back-button',
  'withdraw-application',
  'restart-withdrawn-application',
  'ra-570-amend-bes-evidence',
  'ra-583-bes-status-after-resubmit'
]

// Years run 3000-3098, so `year % 100` is the residue itself. The band is the
// one the clock-drawn years already used, well clear of any real accreditation
// year the seeded fixtures hold.
const YEAR_BASE = 3000
const EVEN_RESIDUES = 50

// `JOURNEY_SLOTS.length` is coprime with EVEN_RESIDUES, so a slot's lane walk
// visits every even residue before repeating. A journey that seeds more than
// one application per run (regulator-query-banner.e2e.js does - each of its
// tests takes a fresh one) simply walks to its next lane, because the residue
// it used first is already taken.
//
// Lanes only start overlapping between slots eleven lanes apart (9 * 11 = 99
// = -1 mod 50), so a fresh stack - which every CI run gets - always hands each
// journey a residue no other journey can reach. Locally, the lane walk is what
// makes reruns work against the persistent `mongodb-data` volume, and it keeps
// doing so for roughly ten reruns before neighbouring slots can start
// competing for the same free residue.
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

  for (let lane = 0; lane < EVEN_RESIDUES; lane++) {
    const residue = 2 * ((slot + lane * JOURNEY_SLOTS.length) % EVEN_RESIDUES)
    if (!takenResidues.has(residue)) {
      return String(YEAR_BASE + residue)
    }
  }

  throw new Error(
    `No disposable accreditation year left for "${journey}" on organisation ${organisationId} / ${materialType}: ` +
      `all ${EVEN_RESIDUES} reference slots are in use. Reset the stack with \`docker compose down -v\`.`
  )
}
