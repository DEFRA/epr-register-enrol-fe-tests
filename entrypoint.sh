#!/bin/sh

echo "run_id: $RUN_ID"

# Only this run's: a FAILED left in /app by an earlier run (a local docker
# run reusing its container) would fail this one, or say the wrong thing.
rm -f FAILED

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
# On test this includes the integrated journeys (test/specs/integration), on
# an organisation the run seeds and deletes: see wdio.conf.js. Their seeding
# needs the same secrets as GenerateOrgs. The accreditation API tests (test/api)
# then run on that organisation before it is deleted; they need
# ACCREDITATION_API_CLIENT_SECRET as a secret too, and are skipped without it.
npm test
test_exit_code=$?

# Its exit code is checked as well as FAILED: a run that stops before its
# onComplete (no browser, a broken config) writes no FAILED.
if [ $test_exit_code -ne 0 ] && [ ! -f FAILED ]; then
  echo "test run exited with code $test_exit_code" > FAILED
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
