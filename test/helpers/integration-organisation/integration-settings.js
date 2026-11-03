// What an integration spec's journeys need, whichever config runs it. On
// test wdio.conf.js runs them beside the standard specs, whose settings suit
// the one frontend they test, so it applies these from its beforeSession, in
// the workers running an integration spec only: those workers start with them
// and the standard specs' workers never see them. wdio.integration.conf.js
// sets the same at the top level.
//
// - Deployed environments, a third-party identity provider and a real
//   virus-scanning upload pipeline are slower than the local stack, so waits
//   are longer, and a WebDriver request (sign-in through Defra ID, an upload
//   through the CDP uploader) can outlast the standard 6s.
// - A full journey is a sign-in, a crawl over the materials and file uploads,
//   so it is minutes, not the standard suite's one.

const oneMinute = 60 * 1000

/**
 * wdio beforeSession hook, for a worker running an integration spec.
 *
 * @param {object} config the worker's wdio config, changed in place
 */
export function applyIntegrationSettings(config) {
  config.waitforTimeout = 30000
  config.waitforInterval = 500
  config.connectionRetryTimeout = 2 * oneMinute
  config.mochaOpts = {
    ...config.mochaOpts,
    timeout: process.env.DEBUG === 'true' ? 60 * oneMinute : 30 * oneMinute
  }
}
