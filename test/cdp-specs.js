// The specs a CDP Portal run (wdio.conf.js, wdio.browserstack.conf.js) executes.
//
// These sign in through the OJ frontend's stub login and need no ReEx data, so
// they pass against a deployed environment as it is. Every other spec opens an
// accreditation for one of the stub ReEx fixture organisations (50001-50017),
// which the real ReEx on test doesn't know, or calls the backend in ways only
// the compose stack's Development backend allows. Those run on GitHub only
// (wdio.github.conf.js), against the compose stack.
//
// Add a spec here only once it has passed against test.
export const cdpSpecs = [
  './test/specs/accessibility/key-pages.accessibility.js',
  './test/specs/operator.e2e.js',
  './test/specs/ra-462-concurrent-logins.e2e.js',
  './test/specs/ra-537-regulator-access-removed.e2e.js',
  './test/specs/ra-626-cookie-consent.e2e.js',
  './test/specs/ra-628-gtm-container.e2e.js'
]
