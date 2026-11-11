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
 * Runs a mongosh script through `docker <execArgs> mongosh` and returns what it
 * prints as JSON.
 *
 * @param {string[]} execArgs the docker arguments that reach the MongoDB
 *   container, e.g. ['exec', containerId]
 * @param {string} script must end by printing one JSON value
 * @param {{ cwd?: string, timeout?: number }} [options]
 */
export async function mongosh(execArgs, script, options) {
  const output = await docker(
    [...execArgs, 'mongosh', '--quiet', '--eval', script],
    options
  )
  return JSON.parse(output.trim().split('\n').pop())
}
