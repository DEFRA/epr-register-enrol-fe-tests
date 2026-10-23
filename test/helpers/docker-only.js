/**
 * RA-537: specs that depend on the docker-compose sandbox - its seeded test
 * orgs (50003-50017), its stubbed ReEx registry and its second, flag-flipped
 * frontend container - and so cannot run against a deployed CDP environment.
 * Tag the describe or it title with DOCKER_ONLY_TAG, and register this as the
 * first `before` (whole describe) or `beforeEach` (individual its) hook.
 *
 * Deployed environments set ENVIRONMENT (see test/config.js), and there the
 * tagged tests are skipped, so they show as skipped in the report rather than
 * failing. In the compose stack ENVIRONMENT is unset and they run as normal.
 *
 * The tag also lets them be picked out with `--mochaOpts.grep @docker-only`.
 */
export const DOCKER_ONLY_TAG = '@docker-only'

/**
 * @param {Mocha.Context} context the `this` of a `before` or `beforeEach` hook
 */
export function skipDockerOnlyOnDeployedEnvironment(context) {
  if (!process.env.ENVIRONMENT) {
    return
  }

  // In a `before` hook there is no current test, so check the suite's title.
  const runnable = context.currentTest ?? context.test.parent
  if (runnable.fullTitle().includes(DOCKER_ONLY_TAG)) {
    context.skip()
  }
}
