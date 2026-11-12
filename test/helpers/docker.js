import { promisify } from 'node:util'
import { execFile as execFileCallback } from 'node:child_process'

const execFile = promisify(execFileCallback)

// A stalled Docker daemon fails the call rather than hanging the run.
const DOCKER_TIMEOUT_MS = 30000

/**
 * Runs the docker CLI on this machine and returns its stdout. Asynchronous, so
 * a slow Docker never blocks the worker: a waitUntil around these keeps its own
 * timeout, and the WebDriver session is not left idle.
 *
 * @param {string[]} args
 * @param {{ cwd?: string, timeout?: number }} [options]
 */
export async function docker(args, { cwd, timeout = DOCKER_TIMEOUT_MS } = {}) {
  const { stdout } = await execFile('docker', args, {
    encoding: 'utf8',
    cwd,
    timeout
  })
  return stdout
}

/**
 * The operator backend's MongoDB database (Mongo__DatabaseName in compose.yml,
 * and in the epr-register-enrol monorepo's stack).
 */
export const OPERATOR_DATABASE = 'epr'

/**
 * The docker arguments that run `script` in mongosh, after the `execArgs` that
 * reach the MongoDB container.
 *
 * @param {string[]} execArgs e.g. ['exec', containerId]
 * @param {string} script
 */
export function mongoshArgs(execArgs, script) {
  return [...execArgs, 'mongosh', '--quiet', '--eval', script]
}

/**
 * The JSON value a mongosh script printed last.
 *
 * @param {string} output the script's stdout
 */
export function lastJsonLine(output) {
  return JSON.parse(output.trim().split('\n').pop())
}

/**
 * Runs a mongosh script through `docker <execArgs> mongosh` and returns what it
 * prints as JSON.
 *
 * @param {string[]} execArgs the docker arguments that reach the MongoDB
 *   container, e.g. ['exec', containerId]
 * @param {string} script must end by printing one JSON value
 * @param {{ cwd?: string, timeout?: number }} [options]
 */
export async function mongosh(execArgs, script, options) {
  return lastJsonLine(await docker(mongoshArgs(execArgs, script), options))
}
