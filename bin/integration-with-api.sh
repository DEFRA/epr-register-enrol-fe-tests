#!/usr/bin/env bash
# The frontend integration tests, then the accreditation API tests against the
# organisation they seeded, then that organisation deleted, pass or fail.
#
#   npm run test:integration:api
#
# 1. npm run test:integration with KEEP_SEEDED_ORGANISATIONS=true, so its
#    onComplete leaves the organisation (and .integration/seeded-organisation.json)
#    in place. Nothing about that run changes otherwise.
# 2. npm run test:api:integration: test/api/*.test.js, using the organisation's
#    org id and registration numbers, and the reprocessor and exporter
#    accreditations step 1 granted on it.
# 3. The organisation deleted, as step 1 would have done.
#
# Needs what npm run test:integration needs, plus ACCREDITATION_API_CLIENT_SECRET
# (see test/helpers/accreditation-api.js). Exits non-zero if either test step
# failed or the clean-up did.
set -uo pipefail

cd "$(dirname "$0")/.."

echo "── 1/3 Frontend integration tests ──"
KEEP_SEEDED_ORGANISATIONS=true npm run test:integration
frontend=$?

echo
echo "── 2/3 Accreditation API tests ──"
# Step 1 clears the snapshot before seeding and writes it only once seeding
# succeeds, so without it there is no organisation to test.
if [[ -f .integration/seeded-organisation.json ]]; then
  npm run test:api:integration
  api=$?
else
  echo "Skipped: step 1 seeded no organisation (.integration/seeded-organisation.json is missing)"
  api=1
fi

echo
echo "── 3/3 Deleting the seeded organisation ──"
env -u KEEP_SEEDED_ORGANISATIONS node --env-file-if-exists=.env \
  test/api/delete-seeded-organisations.js
cleanup=$?

echo
echo "Frontend integration tests: $([[ $frontend -eq 0 ]] && echo passed || echo "failed ($frontend)")"
echo "Accreditation API tests:    $([[ $api -eq 0 ]] && echo passed || echo "failed ($api)")"
echo "Clean-up:                   $([[ $cleanup -eq 0 ]] && echo done || echo "failed ($cleanup)")"
echo "Reports: allure-report/ (frontend), reports/accreditation-api/integration-api.xml (API)"

if [[ $frontend -ne 0 || $api -ne 0 || $cleanup -ne 0 ]]; then
  exit 1
fi
