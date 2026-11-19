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

// A suite's before and after hooks run outside any test, so they are named
// after the suite. Its beforeEach and afterEach hooks are not wrapped: they
// run inside the root ones above, so their requests are the test's own.
for (const key of ['before', 'after']) {
  const original = nodeTest[key]
  nodeTest[key] = (fn, ...rest) => {
    const name = (t) => `${label(t)} (${key} hook)`
    // node:test passes a done callback only to a hook that declares two
    // parameters, so the wrapper declares as many as the hook does.
    const wrapped =
      fn.length >= 2
        ? function (t, done) {
            testStarted(name(t))
            try {
              return fn.call(this, t, (err) => {
                testFinished()
                done(err)
              })
            } catch (err) {
              testFinished()
              throw err
            }
          }
        : async function (t) {
            testStarted(name(t))
            try {
              return await fn.call(this, t)
            } finally {
              testFinished()
            }
          }
    return original(wrapped, ...rest)
  }
}

// So `import { before } from 'node:test'` in the test files gets these.
syncBuiltinESMExports()
