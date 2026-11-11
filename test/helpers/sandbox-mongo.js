import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { escapeRegExp } from './escape-regexp.js'
import {
  docker,
  lastJsonLine,
  mongosh,
  mongoshArgs,
  OPERATOR_DATABASE
} from './docker.js'

/**
 * Helpers that reach into the docker-compose sandbox's MongoDB (compose.yml's
 * unpublished `mongodb` service) through `docker compose exec`, for states a
 * browser cannot produce on its own. They need the docker CLI on the machine
 * running wdio and the sandbox started from this repo's root, as CI's
 * run-journey-tests action does, so only call them from @docker-only specs.
 */

// This repo's root, where compose.yml lives. Running `docker compose` from it
// resolves the same project `docker compose up` started there.
const COMPOSE_PROJECT_DIR = fileURLToPath(new URL('../../', import.meta.url))

// How long to wait for the upload under test to create its pending record.
const PENDING_UPLOAD_TIMEOUT_MS = 30000

const EXEC_MONGODB = ['compose', 'exec', '-T', 'mongodb']

// What watchWithMongosh's scripts print, followed by their mongosh process id
// in the MongoDB container, once they are watching.
const READY = '__watching__'
const READY_LINE = new RegExp(`${READY} (\\d+)`)

function sandboxMongosh(script) {
  return mongosh(EXEC_MONGODB, script, { cwd: COMPOSE_PROJECT_DIR })
}

// Starts a long-running mongosh script that prints READY_LINE once it is
// watching, and its JSON result last. `ready` settles on the READY_LINE,
// `result` on the script's exit; both reject if it fails or exits early.
// `stop()` ends the script if it may still be running: killing the local
// `docker compose exec` client alone would leave mongosh running in the
// container (exec does not forward signals), so it kills that process by the
// id the script printed. The local client exiting on its own means mongosh has
// ended; it being killed (stop(), or spawn's `timeout`) does not. With no id
// printed, it cannot be stopped, so stop() throws rather than leave it running.
function watchWithMongosh(script, timeout) {
  const child = spawn('docker', mongoshArgs(EXEC_MONGODB, script), {
    cwd: COMPOSE_PROJECT_DIR,
    timeout
  })
  let stdout = ''
  let stderr = ''
  let containerPid
  let markReady
  const ready = new Promise((resolve) => {
    markReady = resolve
  })
  child.stdout.setEncoding('utf8').on('data', (chunk) => {
    stdout += chunk
    const match = READY_LINE.exec(stdout)
    if (match && containerPid === undefined) {
      containerPid = match[1]
      markReady()
    }
  })
  child.stderr.setEncoding('utf8').on('data', (chunk) => {
    stderr += chunk
  })
  const result = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code !== 0) {
        reject(
          new Error(
            `mongosh watcher exited with ${code ?? signal}: ${stderr.trim()}`
          )
        )
        return
      }
      resolve(lastJsonLine(stdout))
    })
  })
  const exitedOnItsOwn = () => child.exitCode !== null
  const killLocalClient = () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill()
    }
  }

  async function stop() {
    // No pid: docker never started (the spawn `error`), so nothing is running.
    if (child.pid === undefined || exitedOnItsOwn()) {
      return
    }
    if (containerPid === undefined) {
      killLocalClient()
      throw new Error(
        "Could not stop the pendingUploads watcher: mongosh never printed its process id, so it may still be running in the mongodb container and delete a later upload's record"
      )
    }
    // The shell's own kill, so it needs nothing from the image. Succeeds if
    // the kill did, or if the process is already gone (it finished between
    // the exitedOnItsOwn() check and here); fails only if mongosh is still
    // running.
    const script = `kill ${containerPid} 2>/dev/null || [ ! -e /proc/${containerPid} ]`
    try {
      await docker([...EXEC_MONGODB, 'sh', '-c', script], {
        cwd: COMPOSE_PROJECT_DIR
      })
    } catch (err) {
      killLocalClient()
      throw new Error(
        `Could not stop the pendingUploads watcher (mongosh pid ${containerPid} in the mongodb container); it may still delete a later upload's record: ${err.message}`,
        { cause: err }
      )
    }
    killLocalClient()
  }

  // An early exit rejects `result`; make `ready` give up with it too.
  return { ready: Promise.race([ready, result]), result, stop }
}

/**
 * Runs `upload` (which must start one CDP upload whose S3 path ends with
 * `s3PathSuffix`) and deletes the backend's `pendingUploads` record for it as
 * soon as the upload creates it: what the collection's TTL index does once a
 * record's `expiresAt` passes, without the 24 hours' wait. The backend's
 * status route then answers 404 for that upload, as it does for any expired or
 * never-issued `fileUploadId`.
 *
 * Records already there before `upload` runs are left alone, so earlier
 * uploads to the same application are untouched. The watcher is stopped
 * however `upload` ends.
 *
 * @param {string} s3PathSuffix e.g. `accreditation/sampling-plan/${applicationId}`
 * @param {() => Promise<void>} upload
 * @returns {Promise<string>} the deleted record's fileUploadId
 */
export async function expirePendingUploadOf(s3PathSuffix, upload) {
  const filter = JSON.stringify({
    s3Path: { $regex: `${escapeRegExp(s3PathSuffix)}$` }
  })
  const collection = `db.getSiblingDB('${OPERATOR_DATABASE}').pendingUploads`

  const existingIds = await sandboxMongosh(`
    print(JSON.stringify(
      ${collection}.find(${filter}, { _id: 1 }).toArray().map((u) => u._id)
    ))
  `)

  // Running before the upload starts, so the record goes within a poll
  // interval of being created: before the backend can mark it complete, and
  // before the browser's first status check.
  const watcher = watchWithMongosh(
    `
    const existing = new Set(${JSON.stringify(existingIds)})
    const deadline = Date.now() + ${PENDING_UPLOAD_TIMEOUT_MS}
    let deletedId = null
    print('${READY} ' + process.pid)
    while (deletedId === null && Date.now() < deadline) {
      const created = ${collection}
        .find(${filter}, { _id: 1 })
        .toArray()
        .find((u) => !existing.has(u._id))
      if (created) {
        ${collection}.deleteOne({ _id: created._id })
        deletedId = created._id
      } else {
        sleep(100)
      }
    }
    print(JSON.stringify(deletedId))
  `,
    PENDING_UPLOAD_TIMEOUT_MS + 30000
  )
  // Always stopped, so a failed upload (or a watcher that never got ready)
  // cannot leave it running to delete a later upload's record.
  let deletedId
  let failure
  try {
    await watcher.ready
    await upload()
    deletedId = await watcher.result
  } catch (err) {
    failure = err
  }
  try {
    await watcher.stop()
  } catch (stopFailure) {
    // Report both: the watcher left running, and whatever stopped the upload.
    throw failure
      ? new AggregateError([failure, stopFailure], stopFailure.message)
      : stopFailure
  }
  if (failure) {
    throw failure
  }
  if (deletedId === null) {
    throw new Error(
      `No pending upload record for an S3 path ending ${s3PathSuffix} appeared within ${PENDING_UPLOAD_TIMEOUT_MS}ms`
    )
  }
  return deletedId
}
