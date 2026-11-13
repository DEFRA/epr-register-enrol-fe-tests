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
// wdio runs each spec file in its own worker and gives it an id ("0-15"), so
// each worker gets its own block of 100 years in 5000-9999 and specs in
// different workers can never pick the same one. A retried spec keeps its
// worker id, so it stays in its own block. Within a block the year is
// random, because Mongo persists between local runs (compose.yml's named
// volume) and a fixed year would find last run's records, and a worker never
// hands out the same year twice. Four digits, because stubs build dates like
// `${year}-01-01` from it.
const FIRST_YEAR = 5000
const BLOCK_SIZE = 100
const BLOCKS = 50 // 5000-9999

const handedOut = new Set()

function workerBlock() {
  const runner = Number(process.env.WDIO_WORKER_ID?.split('-').pop())
  return Number.isInteger(runner) ? runner % BLOCKS : randomInt(BLOCKS)
}

/**
 * A run-unique year for a disposable application, as a string for the URL.
 * @returns {string}
 */
export function disposableYear() {
  const start = FIRST_YEAR + workerBlock() * BLOCK_SIZE
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
