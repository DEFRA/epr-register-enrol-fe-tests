import { createRequire, syncBuiltinESMExports } from 'node:module'

import { testFinished, testStarted } from './request-log.js'

// Preloaded (--import) into each test/api process by test/api/run.js. Says
// which test, subtest or hook is running, so the requests it makes are
// logged against it (request-log.js). Names are joined as allure-reporter.js
// joins them: "Suite › Nested suite › test", and "Suite (before hook)".
//
// The tests in a file run one at a time, so a stack of names is enough:
// root-level beforeEach and afterEach hooks (which every test and subtest
// inherits) push and pop each test's name. it and describe are left alone,
// so node:test still reports each test where its file defines it.

const require = createRequire(import.meta.url)
const nodeTest = require('node:test')

const label = (t) => t.fullName.split(' > ').join(' › ')

nodeTest.beforeEach((t) => testStarted(label(t)))
nodeTest.afterEach(() => testFinished())

// A suite's own hooks, named after the suite.
for (const key of ['before', 'beforeEach', 'after', 'afterEach']) {
  const original = nodeTest[key]
  nodeTest[key] = (fn, ...rest) =>
    original(
      async function (t, ...args) {
        testStarted(`${label(t)} (${key} hook)`)
        try {
          return await fn.call(this, t, ...args)
        } finally {
          testFinished()
        }
      },
      ...rest
    )
}

// So `import { before } from 'node:test'` in the test files gets these.
syncBuiltinESMExports()
