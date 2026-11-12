import fs from 'node:fs'

import allure from 'allure-commandline'
import { fetch } from 'undici'
import { SevereServiceError } from 'webdriverio'

import { seedCookieConsentOnNavigation } from './test/helpers/cookie-consent.js'
import { MONOREPO_RUN_FLAG, MONOREPO_TAG } from './test/helpers/monorepo.js'

// The @monorepo specs (test/specs/monorepo): full journeys run from this
// machine against the DEFRA/epr-register-enrol monorepo's local stack - start
// it with `docker compose up` at the monorepo's root. Unlike this repo's own
// sandbox, that stack runs the real case management services, so a submission
// raises a real work item.
//
//   npm run test:monorepo          # headless
//   npm run test:monorepo:headed   # watch it run
//
// Local only: no other config (and so no CI run) picks these specs up. Each
// spec clears its organisation's application and work items in the monorepo's
// MongoDB first (test/helpers/monorepo.js), so it can be run again and again.

// The specs skip without this (test/helpers/monorepo.js), so they only ever
// run through this config, never on a deployed environment.
process.env[MONOREPO_RUN_FLAG] = 'true'

// The monorepo's case management frontend, which test/config.js reads in
// each worker (they inherit this process's environment). Always set, so a
// CASE_MANAGEMENT_FRONTEND_URL left over for a deployed environment can't
// send these specs there; MONOREPO_CASE_MANAGEMENT_URL overrides it.
process.env.CASE_MANAGEMENT_FRONTEND_URL =
  process.env.MONOREPO_CASE_MANAGEMENT_URL || 'http://localhost:5001'

const debug = process.env.DEBUG === 'true'
const headed = process.env.HEADED === 'true' || debug
const oneMinute = 60 * 1000

// The repo's own alias loader: esm-module-alias's builds invalid URLs on Windows.
const execArgv = ['--loader', new URL('./loader.mjs', import.meta.url).href]

if (debug) {
  execArgv.push('--inspect')
}

const chromeArgs = [
  '--no-sandbox',
  '--disable-gpu',
  '--window-size=1920,1080',
  '--disable-dev-shm-usage'
]

if (!headed) {
  chromeArgs.push('--headless=new')
}

export const config = {
  runner: 'local',

  specs: ['./test/specs/monorepo/**/*.monorepo.js'],
  exclude: [],

  // One at a time: both journeys submit through the same stub operator.
  maxInstances: 1,

  capabilities: [
    {
      maxInstances: 1,
      browserName: 'chrome',
      // wdio matches a driver to the installed Chrome.
      'goog:chromeOptions': {
        args: chromeArgs
      }
    }
  ],

  execArgv,

  logLevel: debug ? 'debug' : 'info',

  logLevels: {
    webdriver: debug ? 'debug' : 'error',
    // Otherwise every click logs its scrollIntoView fallback.
    webdriverio: debug ? 'debug' : 'error'
  },

  bail: 0,

  // The monorepo's operator frontend.
  baseUrl: process.env.MONOREPO_BASE_URL || 'http://localhost:3000',

  // File uploads go through the CDP uploader's mocked virus scan.
  waitforTimeout: 15000,
  waitforInterval: 250,

  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  framework: 'mocha',

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        addConsoleLogs: true
      }
    ]
  ],

  mochaOpts: {
    ui: 'bdd',
    grep: MONOREPO_TAG,
    timeout: debug ? 60 * oneMinute : 15 * oneMinute
  },

  async onPrepare(config) {
    const services = [
      ['operator frontend', `${config.baseUrl}/health`],
      [
        'case management frontend',
        `${process.env.CASE_MANAGEMENT_FRONTEND_URL}/health`
      ]
    ]

    for (const [name, url] of services) {
      const deadline = Date.now() + 2 * oneMinute
      process.stdout.write(`Waiting for the monorepo's ${name} at ${url} …\n`)

      for (;;) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(3_000) })
          if (res.ok) {
            process.stdout.write(`✓ ${name} ready\n`)
            break
          }
        } catch {
          // Still starting up.
        }
        if (Date.now() >= deadline) {
          // Severe, so wdio stops: anything else in onPrepare it only logs,
          // and runs the specs anyway.
          throw new SevereServiceError(
            `The monorepo's ${name} is not up at ${url}: run docker compose up at the monorepo's root`
          )
        }
        await new Promise((resolve) => setTimeout(resolve, 2_000))
      }
    }
  },

  // Answer the cookie banner up front so it doesn't sit over every journey.
  before: function () {
    seedCookieConsentOnNavigation(browser)
  },

  afterTest: async function (_test, _context, { error }) {
    if (error) {
      await browser.takeScreenshot()
    }
  },

  onComplete: function (_exitCode, _config, _capabilities, results) {
    if (results?.failed && results.failed > 0) {
      fs.appendFileSync('FAILED', JSON.stringify(results) + '\n')
    }

    const reportError = new Error('Could not generate Allure report')
    const generation = allure(['generate', 'allure-results', '--clean'])

    return new Promise((resolve, reject) => {
      const generationTimeout = setTimeout(() => reject(reportError), oneMinute)

      generation.on('exit', function (exitCode) {
        clearTimeout(generationTimeout)

        if (exitCode !== 0) {
          return reject(reportError)
        }

        resolve()
      })
    })
  }
}
