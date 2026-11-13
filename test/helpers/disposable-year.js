import { randomInt } from 'node:crypto'

// A year for a disposable application: the landing controller seeds a fresh
// application on a year it has not seen, so a spec can own one without
// touching anyone else's.
//
// Specs used to pick `3000 + (Date.now() % 1000)` each. Five of them start
// applications for the same org (50006, Glass exporter) in parallel workers,
// and with ten or so picks from 1000 years, two landing on the same year
// happened in a few percent of runs. They then shared one application, and
// one spec's regulator query showed up in another's task list as QUERIED.
//
// wdio runs each spec file in its own worker and gives it an id ("0-15"). The
// number after the dash is the spec's index in the run, and each index gets
// its own block of 100 years in 5000-9999, so two spec files in the same run
// cannot pick the same year. That holds for up to 50 spec files: past that
// the blocks wrap and two spec files share one.
//
// Which block an index gets is shifted by an offset chosen once per run (see
// chooseDisposableYearOffset), so a rerun, even of a single spec (always index
// 0), lands in a different block. That matters because Mongo persists between
// local runs (compose.yml's named volume): a year an earlier run used finds
// that run's records, and withdraw-application and restart-withdrawn break on
// it, as withdrawal is final. Within a block the year is random, and one
// process never hands out the same year twice. A retried spec is a new
// process with the same index, so it can get the failed attempt's year back
// (1 in 100). Four digits, because stubs build dates like `${year}-01-01`.
const FIRST_YEAR = 5000
const BLOCK_SIZE = 100
const BLOCKS = 50 // 5000-9999
const OFFSET_ENV = 'DISPOSABLE_YEAR_OFFSET'

const handedOut = new Set()

/**
 * Chooses this run's block offset, unless one is already set. Call it at the
 * top level of each wdio config: the launcher loads the config first and sets
 * it, and the workers it spawns inherit its environment, so every spec in the
 * run uses the same offset.
 */
export function chooseDisposableYearOffset() {
  process.env[OFFSET_ENV] ??= String(randomInt(BLOCKS))
}

function workerBlockIndex() {
  const specIndex = Number(process.env.WDIO_WORKER_ID?.split('-').pop())
  if (!Number.isInteger(specIndex)) {
    return randomInt(BLOCKS)
  }

  // No offset (a config that does not call chooseDisposableYearOffset) still
  // keeps spec files apart within the run; it only stops varying between runs.
  const offset = Number(process.env[OFFSET_ENV] ?? 0)
  return (offset + specIndex) % BLOCKS
}

/**
 * A run-unique year for a disposable application, as a string for the URL.
 * @returns {string}
 */
export function disposableYear() {
  const start = FIRST_YEAR + workerBlockIndex() * BLOCK_SIZE
  if (handedOut.size >= BLOCK_SIZE) {
    throw new Error('disposableYear: this worker has used its whole block')
  }

  let year
  do {
    year = start + randomInt(BLOCK_SIZE)
  } while (handedOut.has(year))
  handedOut.add(year)
  return String(year)
}
