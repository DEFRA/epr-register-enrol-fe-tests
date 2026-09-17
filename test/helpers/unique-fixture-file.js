import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures')

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
export function uniqueFixtureCopy(fixtureFilename) {
  const sourcePath = path.resolve(FIXTURES_DIR, fixtureFilename)
  const ext = path.extname(fixtureFilename)
  const base = path.basename(fixtureFilename, ext)
  const uniquePath = path.join(os.tmpdir(), `${base}-${randomUUID()}${ext}`)
  fs.copyFileSync(sourcePath, uniquePath)
  return uniquePath
}
