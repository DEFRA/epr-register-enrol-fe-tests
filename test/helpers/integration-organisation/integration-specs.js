// The integration specs (test/specs/integration), by where they run. Imported
// by the wdio configs, so nothing here needs a browser.
//
// On test they run as part of the standard suite: wdio.conf.js adds
// TEST_ENVIRONMENT_INTEGRATION_SPECS to its run when ENVIRONMENT is test, as
// its `integration` suite, and seeds the organisation they share in its
// onPrepare. wdio.integration.conf.js runs the same ones on their own (npm run
// test:integration). On the run's one organisation, accreditation-workflow
// submits one reprocessor and one exporter application and works both through
// case management.
//
// Elsewhere (dev) only wdio.integration.conf.js runs any, signing in through
// GOV.UK One Login. In order rather than globbed: the case management journey
// acts on a work item that the exporter reapplication creates by submitting,
// and a glob sorts case-management-* ahead of reaccreditation-*.
//
// reprocessor-submission and exporter-overseas-sites-submission are in
// neither: each would submit another application on test, beside the
// workflow's.

export const TEST_ENVIRONMENT_INTEGRATION_SPECS = [
  './test/specs/integration/seeded-organisation.integration.js',
  './test/specs/integration/accreditation-workflow.integration.js'
]

export const ONE_LOGIN_INTEGRATION_SPECS = [
  './test/specs/integration/reaccreditation-2027.integration.js',
  './test/specs/integration/case-management-query-2027.integration.js'
]
