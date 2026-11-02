import allure from 'allure-commandline'

import { reexFrontendUrl } from './test/config.js'
import {
  deleteSeededOrganisations,
  prepareSeededOrganisation,
  reportRunOrganisations
} from './test/helpers/integration-organisation/hooks.js'

// Local integration run against a deployed environment (ENVIRONMENT, dev by
// default), driving the real Re-Ex frontend and epr-register-enrol-frontend
// rather than this repo's docker-compose sandbox.
//
// On test, onPrepare first seeds an organisation with every material, linked
// to a Defra ID user, with 200 overseas sites on its plastic exporter
// registration, and lists it in .integration/created-organisations.jsonl.
// Each test signs in as that user through the Defra ID stubs
// (test/helpers/integration-organisation), and onComplete deletes every
// organisation the file lists. SEEDED_ORGANISATION_ID reuses an organisation
// instead, which is then never deleted. Elsewhere tests sign in through
// GOV.UK One Login as REEX_USERNAME, and the test-environment scenarios skip.

//
//   npm run test:integration          # headless
//   npm run test:integration:headed   # watch it run
//
// Requires network access to *.cdp-int.defra.cloud (Defra VPN). Unlike every
// other config here it needs no local stack, so there is no service health
// check before the run.

const debug = process.env.DEBUG
const headed = process.env.HEADED === 'true' || Boolean(debug)
const oneMinute = 60 * 1000

const execArgv = ['--loader', 'esm-module-alias/loader']

if (debug) {
  execArgv.push('--inspect')
}

const chromeArgs = [
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--disable-dev-shm-usage',
  // Chrome's built-in DNS client would intermittently fail to resolve the
  // *.cdp-int.defra.cloud hosts over the Defra VPN's split DNS
  // (net::ERR_NAME_NOT_RESOLVED for minutes at a time) while the system
  // resolver answered them. Use the system resolver.
  '--disable-features=AsyncDns,DnsOverHttps'
]

if (!headed) {
  chromeArgs.push('--headless=new')
}

export const config = {
  runner: 'local',

  // Listed in order rather than globbed: the case management journey acts on a
  // work item that the exporter reapplication creates by submitting, and a
  // glob sorts case-management-* ahead of reaccreditation-*, so it used to run
  // first and find nothing to work on. maxInstances below keeps it sequential.
  //
  // The test-environment scenarios go before reaccreditation-2027, which takes
  // whichever material is first still open, so that they get the ones they
  // ask for (aluminium, and the material with 200 overseas sites).
  specs: [
    './test/specs/integration/seeded-organisation.integration.js',
    './test/specs/integration/reprocessor-submission.integration.js',
    './test/specs/integration/accreditation-workflow.integration.js',
    './test/specs/integration/exporter-overseas-sites-submission.integration.js',
    './test/specs/integration/reaccreditation-2027.integration.js',
    './test/specs/integration/case-management-query-2027.integration.js'
  ],
  exclude: [],

  // One at a time on purpose. The journey picks the first material on the
  // target environment that has not already been applied for, so two workers
  // racing the same organisation would both pick the same one.
  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      browserName: 'chrome',
      // WebDriver BiDi lost track of the page's browsing context over the
      // exporter scenario's long session (hundreds of page loads), until the
      // renderer hung and Chrome dropped the session. Classic WebDriver holds.
      'wdio:enforceWebDriverClassic': true,
      // No pinned chromedriver binary, unlike wdio.local.conf.js: this config
      // runs on a developer machine against whatever Chrome is installed
      // there, so wdio's own driver management is left to match the two.
      'goog:chromeOptions': {
        args: chromeArgs
      }
    }
  ],

  execArgv,

  logLevel: debug ? 'debug' : 'info',

  logLevels: {
    webdriver: debug ? 'debug' : 'error'
  },

  bail: 0,

  // Chrome now and then drops a long session ("invalid session id: the
  // browser has closed the connection"), which the exporter scenario's
  // hundreds of page loads are most exposed to. Its journey resumes where it
  // stopped (the same in-progress application, finished sites skipped), so
  // one rerun in a fresh browser carries it through.
  specFileRetries: 1,

  // The Re-Ex frontend, where the journey starts. The register-enrol frontend
  // is reached only by following the in-page hand-off link, so it needs no
  // base URL of its own.
  baseUrl: reexFrontendUrl,

  // Deployed environments, a third-party identity provider and a real
  // virus-scanning upload pipeline are all slower than the local stack.
  waitforTimeout: 30000,
  waitforInterval: 500,

  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  framework: 'mocha',

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results'
      }
    ]
  ],

  mochaOpts: {
    ui: 'bdd',
    // A full journey is a sign-in, a crawl over up to 24 materials and a
    // file upload through the CDP uploader, so it is minutes, not seconds.
    timeout: debug ? 60 * oneMinute : 30 * oneMinute
  },

  // Seeding takes a few minutes of API calls, so it is done once, before any
  // worker starts, rather than per spec.
  onPrepare: prepareSeededOrganisation,

  afterTest: async function (_test, _context, { error }) {
    if (error) {
      await browser.takeScreenshot()
    }
  },

  onComplete: async function () {
    // Before the report, which rejects when it cannot be generated.
    await deleteSeededOrganisations()
    // Every organisation the run touched, and whether it is still there to
    // delete, in the report's Environment section.
    reportRunOrganisations('allure-results')

    const reportError = new Error('Could not generate Allure report')
    const generation = allure(['generate', 'allure-results', '--clean'])

    return new Promise((resolve, reject) => {
      const generationTimeout = setTimeout(() => reject(reportError), oneMinute)

      generation.on('exit', function (generationExitCode) {
        clearTimeout(generationTimeout)

        if (generationExitCode !== 0) {
          return reject(reportError)
        }
        resolve()
      })
    })
  }
}
