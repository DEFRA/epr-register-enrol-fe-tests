import { browser, expect, $$ } from '@wdio/globals'
import TaskListPage from 'page-objects/tasklist.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'

import { createAccessibilityAudit } from '../../helpers/accessibility.js'
import {
  OVERSEAS_SITES_MATERIAL,
  hasSeededOrganisation
} from '../../helpers/integration-organisation/index.js'
import {
  addNewSiteWithInterimSites,
  addRegisteredSitesToAccreditation,
  completeIncompleteOverseasSites,
  openSeededAccreditation,
  seededRegistrations,
  startFirstApplicableAccreditation
} from '../../helpers/integration-organisation/seeded-accreditation-journey.js'
import {
  completeOutstandingTasks,
  submitAndAssertConfirmation
} from '../../helpers/reex-reaccreditation.js'
import { accreditationYear } from '../../config.js'

// Test environment scenario 2: on the organisation seeded for the run, the
// operator applies for exporter accreditation for the material seeded with
// overseas reprocessing sites (OVERSEAS_SITES_MATERIAL: 3 accredited, 2
// registered; or the exporter material with the most sites once that one has
// been applied for). They add
// its registered sites to the accreditation, complete every incomplete site,
// add a new site with four interim sites, upload BES evidence wherever it is
// required, complete the other tasks and submit.
//
// Each page type is also checked for accessibility, once, the first time the
// journey reaches it. A violation does not stop the journey: they are
// collected and reported by the last test.

const NEW_SITE = {
  name: 'Mumbai Polymer Reprocessing Pvt Ltd',
  location: {
    addressLine1: '12 Dockside Road',
    townOrCity: 'Mumbai',
    country: 'India',
    coordinates: '19.0760, 72.8777'
  },
  contact: {
    name: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    phone: '+91 22 1234 5678'
  }
}

const INTERIM_SITE = {
  country: 'India',
  name: 'Mumbai Interim Storage Depot',
  location: {
    addressLine1: '44 Harbour Way',
    townOrCity: 'Mumbai',
    stateOrRegion: 'Maharashtra',
    postcode: '400001'
  },
  contact: {
    name: 'Ravi Patel',
    email: 'ravi.patel@example.com',
    phone: '+91 22 8765 4321'
  }
}

const INTERIM_SITE_COUNT = 4

// A handful of sites, a new one and its interim sites, each completed through
// the browser page by page.
const JOURNEY_TIMEOUT = 30 * 60 * 1000

describe(`Exporter accreditation ${accreditationYear} with overseas sites - test environment`, () => {
  const audit = createAccessibilityAudit()
  const checkPage = (pageName) => audit.check(pageName)

  before(function () {
    if (!hasSeededOrganisation()) {
      this.skip()
    }
  })

  it('Should complete every overseas site, add a site with interim sites and submit an exporter application', async function () {
    this.timeout(JOURNEY_TIMEOUT)

    const { registration, applicationId } =
      await startFirstApplicableAccreditation(
        seededRegistrations('exporter', [OVERSEAS_SITES_MATERIAL])
      )
    const seededSites = Object.keys(registration.overseasSites).length
    process.stdout.write(
      `Exporter scenario: ${registration.material} (${registration.registrationNumber}), ${seededSites} seeded overseas sites\n`
    )

    // The overseas sites task only opens once the others are done.
    const material = await completeOutstandingTasks({
      isExporter: false,
      checkPage
    })

    // A fresh browser session, signed back in to this application, for the
    // site loops to carry on in (see forEachSite).
    const resumeSession = async () => {
      await browser.reloadSession()
      await openSeededAccreditation(registration)
    }
    const added = await addRegisteredSitesToAccreditation(applicationId, {
      checkPage,
      resumeSession
    })
    const completed = await completeIncompleteOverseasSites(applicationId, {
      checkPage,
      resumeSession
    })
    process.stdout.write(
      `Added ${added.length} registered site(s), completed ${completed.length} incomplete site(s)\n`
    )
    // Both helpers leave the browser on the site list. A rerun on an
    // application an earlier attempt got this far with has nothing left to do
    // here, so check the outcome rather than the counts.
    await expect($$('[data-testid*="-incomplete-"]')).toBeElementsArrayOfSize(0)
    await expect(
      $$('[data-testid^="add-button-registered-"]')
    ).toBeElementsArrayOfSize(0)

    const { interimSites } = await addNewSiteWithInterimSites(applicationId, {
      site: NEW_SITE,
      interimSite: INTERIM_SITE,
      interimSiteCount: INTERIM_SITE_COUNT,
      checkPage
    })
    expect(interimSites).toHaveLength(INTERIM_SITE_COUNT)
    process.stdout.write(
      `Added interim sites ${interimSites.map(({ orsId, interimSiteId }) => `${interimSiteId} (ORS ${orsId})`).join(', ')}\n`
    )

    await OverseasReprocessingSitesPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )
    await checkPage('Confirm overseas sites')
    await ConfirmOverseasSitesPage.confirmAndContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await expect(TaskListPage.overseasSitesStatus).toHaveText('COMPLETED')

    // Required for every site outside the EU and OECD: the seeded ones in
    // India, and the new one.
    await TaskListPage.besLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        '/accreditation/upload-evidence-for-overseas-site/'
      )
    )
    await checkPage('BES evidence sites')
    await BesEvidencePage.uploadAllEvidence('business-plan.pdf')
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await TaskListPage.assertAllTasksCompleted({ isExporter: true })
    await TaskListPage.continueToSubmit()

    await submitAndAssertConfirmation(material, { checkPage })
  })

  it('Should have no accessibility violations on the pages of the journey', () => {
    expect(audit.checkedPages.length).toBeGreaterThan(0)
    audit.assertNoViolations()
  })
})
