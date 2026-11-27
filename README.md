epr-register-enrol-fe-tests

The template to create a service that runs WDIO tests against an environment.

- [Local](#local)
  - [Requirements](#requirements)
    - [Node.js](#nodejs)
  - [Setup](#setup)
  - [Running local tests](#running-local-tests)
  - [Debugging local tests](#debugging-local-tests)
- [Production](#production)
  - [Debugging tests](#debugging-tests)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Local Development

### Requirements

#### Node.js

Please install [Node.js](http://nodejs.org/) `>= v20` and [npm](https://nodejs.org/) `>= v9`. You will find it
easier to use the Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
nvm use
```

### Setup

Install application dependencies:

```bash
npm install
```

### Running local tests

Start application you are testing on the url specified in `baseUrl` [wdio.local.conf.js](wdio.local.conf.js)

```bash
npm run test:local
```

### Debugging local tests

```bash
npm run test:local:debug
```

### Running the monorepo tests (`@monorepo`)

`test/specs/monorepo` holds full journeys that run only from your machine
against the
[epr-register-enrol](https://github.com/DEFRA/epr-register-enrol) monorepo's
local stack, which runs the real case management services. They are never
run in CI, and no other config picks them up.

- `case-management-workflow`: the operator submits a reprocessor and an
  exporter application; the regulator (case
  management, `http://localhost:5001`) duly makes each, changes its payment
  date and determination deadline, and queries it; the operator answers both
  queries, adding an overseas site with an interim site to the exporter, and
  resubmits; the regulator sees each response, approves both and confirms
  contact, so both are Granted, which the operator then sees.
- `add-ors-to-case-management` (RA-739): the operator adds two registered
  overseas reprocessing sites to org 50019's accreditation and submits the
  request; case management raises one application per site, each with its
  own `IYC-ORS-…` reference and the shared `SUB-…` reference, listed as
  "New ORS accreditation" with "(2 requests)" under the "In-year change"
  application type; the operator's change request shows each site's own
  reference. The monorepo's operator backend has
  `AccreditationChanges__SubmitToCaseManagement` on for this.
- `add-ors-case-management-decision` (RA-495): the operator requests
  org 50019's Lyon site; the regulator duly makes it (the request reads
  DULY MADE and the site stays locked), refuses it and confirms contact, so
  the case closes, the request reads REFUSED and the site can be requested
  again; the operator requests it again; the regulator duly makes and
  approves it with a valid from date, corrects that date with a reason
  (RA-800) and confirms contact, so the request reads GRANTED, valid from the
  corrected date, and Lyon is on the Accredited tab.
- `add-ors-bes-evidence-checks` (RA-495): an add-ORS request's BES upload
  for org 50019's Delhi site is checked against the files the site already
  holds on the accreditation. An upload over the 10-file cap is refused, and
  so is one that shares a name with a file already held (including a
  sampling plan file, which the backend refuses after the CDP upload).
  Submit checks both rules again, and the requests page shows the upload
  message, linking to the refused site.
- `update-accredited-ors` (RA-682): the operator changes the details of two
  of org 50025's accredited ORSs (one with its interim sites changed, removed
  and added) and adds a registered one in the same request, so only the add is
  charged; the submitted ORSs are then pending, and case management raises an
  add-ORS work item and two ORS update work items, the updates under their own
  request id. An interim-only change to a third ORS is free, so it goes
  straight to the confirmation with no payment page.
- `review-ors-update` (RA-782, RA-767): the operator changes the name of
  org 50025's ORS A and one of its interim sites, adds registered C in the
  same request and submits; case management lists A's "Update ORS
  Accreditation" and C's "New ORS accreditation" under one `SUB-…` reference
  with "(2 requests)"; the regulator opens A's update (the changed name is
  marked against the current version, the interim site change shows, and
  Related change requests lists both), assigns it to themselves, duly makes
  it with no payment date, approves it with no valid from date and confirms
  contact, so the request reads GRANTED and A carries its new details. Then
  the operator changes B's town, and the regulator duly makes and refuses
  it, so the request reads REFUSED and B is unchanged and can be changed
  again.

1. Start the monorepo's stack from its root: `docker compose up --build -d`.
   It binds the same ports as this repo's own stack (3000, 8080), so stop
   that first (`docker compose stop` here).
2. Run the tests:

   ```bash
   npm run test:monorepo          # headless
   npm run test:monorepo:headed   # watch it run
   ```

Each spec first deletes its organisations' data from the monorepo's MongoDB,
so every run starts afresh: `case-management-workflow` deletes the
applications and case management work items of 50016 (the reprocessor) and
50015 (the exporter), so both start from NOT STARTED; `add-ors-to-case-management`
deletes 50019's change requests and the work items and submissions they
raised (add-ORS and ORS update alike), and
`add-ors-case-management-decision` does the same and puts Lyon back to
registered only. `add-ors-bes-evidence-checks` deletes 50019's change
requests, clears Delhi's BES evidence on the accreditation and removes the
sampling plan files it adds (`e2e-plan-…`), then gives Delhi and the sampling
plan the files each check needs. `update-accredited-ors` deletes 50025's
change requests and the work items and submissions they raised; it approves
nothing, so 50025's seeded ORSs never change. `review-ors-update` does the
same and also puts 50025's A and B back as the dev seed leaves them, on the
accreditation application and in the domain model (deleting the ORS versions
a grant wrote). What a run leaves is kept, to
look at, until the next run, except `add-ors-case-management-decision`,
`add-ors-bes-evidence-checks` and `review-ors-update`, which reset their
organisation afterwards too: a granted Lyon would otherwise stop the other
50019 specs adding it, the files given to Delhi would trip their uploads,
and a granted A would no longer have the names the 50025 specs expect. The
two 50025 specs share that organisation, so never run them at once either. All the 50019 specs share that organisation,
as does the mgmt-tests suite's ra-495-add-ors-operator-journey spec, which
resets 50019 the same way, so never run any two of them at once.
`MONOREPO_BASE_URL`, `MONOREPO_CASE_MANAGEMENT_URL` and
`MONOREPO_MONGO_CONTAINER` override the operator frontend
(`http://localhost:3000`), the case management frontend
(`http://localhost:5001`) and the MongoDB container, if yours differ.

## Production

### Running the tests

Tests are run from the CDP-Portal under the Test Suites section. Before any changes can be run, a new docker image must be built, this will happen automatically when a pull request is merged into the `main` branch.
You can check the progress of the build under the actions section of this repository. Builds typically take around 1-2 minutes.

The results of the test run are made available in the portal.

## Requirements of CDP Environment Tests

1. Your service builds as a docker container using the `.github/workflows/publish.yml`
   The workflow tags the docker images allowing the CDP Portal to identify how the container should be run on the platform.
   It also ensures its published to the correct docker repository.

2. The Dockerfile's entrypoint script should return exit code of 0 if the test suite passes or 1/>0 if it fails

3. Test reports should be published to S3 using the script in `./bin/publish-tests.sh`

## Running on GitHub

Alternatively you can run the test suite as a GitHub workflow.
Test runs on GitHub are not able to connect to the CDP Test environments. Instead, they run the tests agains a version of the services running in docker.
A docker compose `compose.yml` is included as a starting point, which includes the databases (mongodb, redis) and infrastructure (localstack) pre-setup.

Steps:

1. Edit the compose.yml to include your services.
2. Modify the scripts in docker/scripts to pre-populate the database, if required and create any localstack resources.
3. Test the setup locally with `docker compose up`, `npm run test:github` and then `npm run test:github:serial`, which runs `test/serial-specs` alone, as CI does. Both load the test runner's environment from `docker/config/journey-tests.env`.
4. Set up the workflow trigger in `.github/workflows/journey-tests`.

By default, the provided workflow will run when triggered manually from GitHub or when triggered by another workflow.

If you want to use the repository exclusively for running docker composed based test suites consider displaying the publish.yml workflow.

## BrowserStack

Two wdio configuration files are provided to help run the tests using BrowserStack in both a GitHub workflow (`wdio.github.browserstack.conf.js`) and from the CDP Portal (`wdio.browserstack.conf.js`).
They can be run from npm using the `npm run test:browserstack` (for running via portal) and `npm run test:github:browserstack` (from GitHib runner).
See the CDP Documentation for more details.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government licence v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.

_Re-triggering CI to check for run-to-run flakiness in the E2E journey suite (RA-293 investigation)._
