import fs from 'node:fs'

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
// to a Defra ID user, with a few overseas sites on some of its exporter
// registrations, and lists it in .integration/created-organisations.jsonl.
// Each test signs in as that user through the Defra ID stubs
// (test/helpers/integration-organisation), and onComplete deletes every
// organisation the file lists. SEEDED_ORGANISATION_ID reuses an organisation
// instead, which is then never deleted. Elsewhere tests sign in through
// GOV.UK One Login as REEX_USERNAME. Which specs run depends on which of the
// two it is: see specs below.

//
//   npm run test:integration          # headless
//   npm run test:integration:headed   # watch it run
//
// Requires network access to *.cdp-int.defra.cloud (Defra VPN). Unlike every
// other config here it needs no local stack, so there is no service health
// check before the run.
//
// On CDP, entrypoint.sh runs it after the main suite when ENVIRONMENT is test,
// through the platform's chromedriver (CHROMEDRIVER_URL) and egress proxy
// (HTTP_PROXY), adding to the same allure-results and FAILED.

// Only "true" counts: any other value set in the environment (DEBUG=false,
// or a debug-module pattern such as DEBUG=*) leaves the run headless.
const debug = process.env.DEBUG === 'true'
const headed = process.env.HEADED === 'true' || debug
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

  // A remote chromedriver: the CDP test-suite container's (entrypoint.sh sets
  // CHROMEDRIVER_URL there). Left unset locally, so wdio starts a driver for
  // the installed Chrome.
  ...(process.env.CHROMEDRIVER_URL && {
    hostname: process.env.CHROMEDRIVER_URL,
    port: Number(process.env.CHROMEDRIVER_PORT) || 4444
  }),

  // On test, the run's one organisation gets one reprocessor and one exporter
  // application: accreditation-workflow submits both and works them through
  // case management. reprocessor-submission and
  // exporter-overseas-sites-submission (test only), and reaccreditation-2027
  // with case-management-query-2027 (which on test would act as the same
  // organisation), would each submit more, so they do not run there.
  //
  // Elsewhere, in order rather than globbed: the case management journey acts
  // on a work item that the exporter reapplication creates by submitting, and
  // a glob sorts case-management-* ahead of reaccreditation-*, so it used to
  // run first and find nothing to work on. maxInstances below keeps it
  // sequential.
  specs:
    process.env.ENVIRONMENT === 'test'
      ? [
          './test/specs/integration/seeded-organisation.integration.js',
          './test/specs/integration/accreditation-workflow.integration.js'
        ]
      : [
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
      ...(process.env.HTTP_PROXY && {
        proxy: {
          proxyType: 'manual',
          httpProxy: new URL(process.env.HTTP_PROXY).host,
          sslProxy: new URL(process.env.HTTP_PROXY).host
        }
      }),
      browserName: 'chrome',
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

  // The deployed environment is reached over the Defra VPN, which now and then
  // drops out from under a run. The seeded-organisation journeys resume where
  // they stopped (the same in-progress application, finished tasks skipped),
  // so one rerun in a fresh browser carries them through.
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
        outputDir: 'allure-results',
        // Each test's console output (the journey's progress, and the ids of
        // what it created) as an attachment, beside its steps.
        addConsoleLogs: true
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
  //
  // wdio only logs an error thrown here and runs the specs anyway, which then
  // all skip for want of an organisation and pass. So stop the run instead,
  // first deleting whatever seeding got as far as creating. (Throwing wdio's
  // SevereServiceError would stop it too, but only the copy of webdriverio
  // nested under @wdio/cli, not the one this config can import.)
  onPrepare: async function () {
    try {
      await prepareSeededOrganisation()
    } catch (err) {
      process.stdout.write(
        `Seeding the organisation failed, so no tests were run: ${err?.stack ?? err}\n`
      )
      try {
        await deleteSeededOrganisations()
      } catch (cleanupErr) {
        process.stdout.write(
          `Deleting the seeded organisations failed: ${cleanupErr}\n`
        )
      }
      process.exit(1)
    }
  },

  afterTest: async function (_test, _context, { error }) {
    if (error) {
      await browser.takeScreenshot()
    }
  },

  onComplete: async function (_exitCode, _config, _capabilities, results) {
    // Required for test status to show correctly in the CDP portal. Appended,
    // as on CDP the main suite may already have written one.
    if (results?.failed && results.failed > 0) {
      fs.appendFileSync('FAILED', JSON.stringify(results) + '\n')
    }

    // Before the report, which rejects when it cannot be generated.
    // Runs whether or not the tests passed. A clean-up that throws still
    // leaves the organisations listed for the next run's clean-up, and the
    // report below says which are still there.
    try {
      await deleteSeededOrganisations()
    } catch (err) {
      process.stdout.write(`Deleting the seeded organisations failed: ${err}\n`)
    }
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
