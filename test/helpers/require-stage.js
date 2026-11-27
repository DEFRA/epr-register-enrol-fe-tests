import { reportDetails } from './report-step.js'

/**
 * For specs whose tests share state and run in order: skips the test unless
 * an earlier one recorded that it reached `stage` in `progress`.
 *
 * @param {Mocha.Context} context the `this` of the test
 * @param {Record<string, unknown>} progress what the earlier tests reached
 * @param {string} stage the key the test needs set
 */
export function requireStage(context, progress, stage) {
  if (!progress[stage]) {
    reportDetails('Skipped', { reason: `not ${stage}` })
    context.skip()
  }
}
