import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Every organisation one integrated run touched, and what became of it, for
// the Allure report. Unlike created-organisations.jsonl, which only lists what
// is still to delete, this keeps a line per event (created, reused, deleted,
// failed to delete) for the whole run, whichever process it happened in: the
// launcher seeds and deletes the run's organisation, spec workers seed and
// delete their own. onPrepare starts it afresh, and onComplete folds it into
// the report's Environment section, so the report says which organisations
// are still on the environment to delete later.

export const RUN_ORGANISATIONS_FILE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../.integration/run-organisations.jsonl'
)

const STATUS_BY_EVENT = {
  created: 'kept',
  // Its Defra ID user and organisation, once seeding has linked it.
  linked: 'kept',
  reused: 'reused (never deleted)',
  deleted: 'deleted',
  'delete-failed': 'still on the environment: delete failed'
}

/** Starts the log afresh for a new run. */
export function startRunOrganisationsLog() {
  mkdirSync(dirname(RUN_ORGANISATIONS_FILE), { recursive: true })
  writeFileSync(RUN_ORGANISATIONS_FILE, '')
}

/**
 * @param {'created' | 'linked' | 'reused' | 'deleted' | 'delete-failed'} event
 * @param {{orgId: number, id?: string, email?: string, defraOrganisation?: {id: string, name: string} | null}} organisation
 * @param {string} [error] why a delete failed
 */
export function logRunOrganisation(event, organisation, error) {
  mkdirSync(dirname(RUN_ORGANISATIONS_FILE), { recursive: true })
  appendFileSync(
    RUN_ORGANISATIONS_FILE,
    `${JSON.stringify({
      event,
      orgId: organisation.orgId,
      id: organisation.id,
      email: organisation.email,
      defraOrganisation: organisation.defraOrganisation ?? null,
      environment: process.env.ENVIRONMENT,
      error,
      at: new Date().toISOString()
    })}\n`
  )
}

/**
 * The run's organisations in the order first seen, each with what is known
 * about it and its latest status.
 */
export function runOrganisations() {
  if (!existsSync(RUN_ORGANISATIONS_FILE)) {
    return []
  }
  const byOrgId = new Map()
  for (const line of readFileSync(RUN_ORGANISATIONS_FILE, 'utf8').split('\n')) {
    if (!line.trim()) {
      continue
    }
    const { event, error, at, ...organisation } = JSON.parse(line)
    const known = byOrgId.get(organisation.orgId) ?? {}
    byOrgId.set(organisation.orgId, {
      ...known,
      ...Object.fromEntries(
        Object.entries(organisation).filter(([, value]) => value != null)
      ),
      status: `${STATUS_BY_EVENT[event]}${error ? ` (${error.split('\n')[0]})` : ''}`
    })
  }
  return [...byOrgId.values()]
}

// Allure reads environment.properties as Java properties: a key may not hold
// unescaped spaces, colons or equals signs.
const propertyKey = (key) => key.replace(/([ :=\\])/g, '\\$1')
const propertyValue = (value) => String(value).replace(/\n/g, ' ')

/**
 * Lists the run's organisations in the Allure report's Environment section,
 * one entry per organisation: its ids, the Defra ID user and organisation it
 * is linked to, and whether it was deleted.
 *
 * @param {string} resultsDir the allure-results directory
 */
export function writeRunOrganisationsToAllure(resultsDir) {
  const organisations = runOrganisations()
  const lines = organisations.map((organisation) => {
    const defra = organisation.defraOrganisation
    const value = [
      `id ${organisation.id ?? 'unknown'}`,
      `env ${organisation.environment}`,
      `Defra ID user ${organisation.email ?? 'unknown'}`,
      defra ? `Defra organisation ${defra.name} (${defra.id})` : null,
      organisation.status
    ]
      .filter(Boolean)
      .join(' | ')
    return `${propertyKey(`Organisation ${organisation.orgId}`)}=${propertyValue(value)}`
  })
  if (!lines.length) {
    lines.push(`${propertyKey('Organisations')}=none created this run`)
  }
  mkdirSync(resultsDir, { recursive: true })
  writeFileSync(
    resolve(resultsDir, 'environment.properties'),
    `${lines.join('\n')}\n`
  )
  return organisations
}
