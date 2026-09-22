import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures')

// Every path this process has handed out via uniqueFixtureCopy, so the
// exit hook below knows what to remove. wdio's local runner executes each
// spec file in its own worker process, so this only ever needs to track
// (and clean up) the copies made by the current process — no cross-process
// coordination, and no per-spec afterEach/afterAll needed.
const createdCopies = new Set()
let cleanupRegistered = false

function registerCleanupOnExit() {
  if (cleanupRegistered) {
    return
  }
  cleanupRegistered = true
  process.once('exit', () => {
    for (const copyPath of createdCopies) {
      try {
        fs.unlinkSync(copyPath)
      } catch {
        // Best-effort: already removed, or the process is exiting too
        // abruptly to reach the filesystem. Either way there is nothing
        // further to do here.
      }
    }
  })
}

// RA-571: the frontend now rejects two files sharing a filename anywhere on
// the same application submission (sampling plan + every overseas site's
// BES evidence together). Several specs upload the same on-disk fixture
// (e.g. business-plan.pdf) more than once per application — once per
// overseas site via BesEvidencePage.uploadAllEvidence, or once for the
// sampling plan and again as BES evidence — and a `<input type="file">`
// always submits the file's own OS basename, so the browser would
// otherwise send that identical filename every time. Copying the fixture
// to a uniquely-named temp file per call gives each upload a filename the
// backend accepts, without every spec having to invent (and commit) its
// own distinct binary fixture.
//
// Each copy is removed when this process exits (see registerCleanupOnExit)
// so repeated runs on a long-lived CI runner or dev machine don't
// accumulate orphaned business-plan-<uuid>.pdf files in the OS temp dir
// (review: slorek).
export function uniqueFixtureCopy(fixtureFilename) {
  const sourcePath = path.resolve(FIXTURES_DIR, fixtureFilename)
  const ext = path.extname(fixtureFilename)
  const base = path.basename(fixtureFilename, ext)
  const uniquePath = path.join(os.tmpdir(), `${base}-${randomUUID()}${ext}`)
  fs.copyFileSync(sourcePath, uniquePath)
  createdCopies.add(uniquePath)
  registerCleanupOnExit()
  return uniquePath
}
