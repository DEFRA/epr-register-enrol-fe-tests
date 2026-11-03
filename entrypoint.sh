#!/bin/sh

echo "run_id: $RUN_ID"

# Generate data instead of testing, based on PROFILE. GenerateOrgs seeds a
# Re/Ex organisation with every material, linked to a Defra ID user, and logs
# the Defra ID and the accreditation link for each reprocessor and exporter
# registration. Needs ENTRA_CLIENT_SECRET, ENTRA_USERNAME, ENTRA_PASSWORD and
# EMAIL_ADDRESS as secrets on the test suite.
if [ "$PROFILE" = "GenerateOrgs" ]; then
  npm run seed:accreditation-links
  generate_exit_code=$?
  echo "GenerateOrgs finished with exit code $generate_exit_code"
  exit $generate_exit_code
fi
npm test

# On test, the integrated journeys (test/specs/integration) run as well, into
# the same allure-results and FAILED. Not through npm run test:integration,
# whose clean would wipe the results above. Their seeding needs the same
# secrets as GenerateOrgs.
#
# Its exit code is checked as well as FAILED: a run that stops before its
# onComplete (seeding failed, no browser, a broken config) writes no FAILED.
if [ "$ENVIRONMENT" = "test" ]; then
  ./node_modules/.bin/wdio run wdio.integration.conf.js
  integration_exit_code=$?
  if [ $integration_exit_code -ne 0 ]; then
    echo "integration suite exited with code $integration_exit_code" >> FAILED
  fi
fi

npm run report:publish
publish_exit_code=$?

if [ $publish_exit_code -ne 0 ]; then
  echo "failed to publish test results"
  exit $publish_exit_code
fi

# At the end of the test run, if the suite has failed we write a file called 'FAILED'
if [ -f FAILED ]; then
  echo "test suite failed"
  cat ./FAILED
  exit 1
fi

echo "test suite passed"
exit 0
