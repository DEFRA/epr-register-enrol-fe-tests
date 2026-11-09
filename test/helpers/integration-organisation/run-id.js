// Which integrated run this process belongs to. Each run seeds one
// organisation and deletes it at the end, so everything it keeps on disk - the
// organisation's snapshot, and its entry in the list of organisations to
// delete - is tagged with the run, so two runs from the same checkout (or a
// run and its own spec retries) never pick up or delete each other's.
//
// The wdio launcher starts the run in onPrepare (hooks.js); the workers it
// forks afterwards inherit the variable, so every spec and every retry in the
// run reads the same organisation.

const RUN_ID_VARIABLE = 'INTEGRATION_RUN_ID'

/**
 * Starts the run, in the wdio launcher. Kept if already set, e.g. by a caller
 * that wants to name its run.
 *
 * @returns {string} the run id: the launcher's pid and the time it started
 */
export function startRun() {
  process.env[RUN_ID_VARIABLE] ||= `${process.pid}-${Date.now()}`
  return process.env[RUN_ID_VARIABLE]
}

/** @returns {string | undefined} this run's id, unset outside a run */
export function runId() {
  return process.env[RUN_ID_VARIABLE] || undefined
}

/**
 * Whether the run is still going on this machine: its launcher process is
 * alive. A run that died before it could clean up is not.
 *
 * @param {string} id
 */
export function isRunActive(id) {
  const pid = Number.parseInt(id, 10)
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM: alive, but another user's process.
    return err.code === 'EPERM'
  }
}
