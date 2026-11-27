import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'
import { MANAGE_PATH, ORS } from '../fixtures/manage-exporter-org.js'
import { MANAGE_PATH as NO_OVERSEAS_SITES_MANAGE_PATH } from '../fixtures/no-overseas-sites-org.js'

/**
 * RA-814: "Manage overseas reprocessing sites" shows every ORS in one table -
 * Site name, Status and Actions - instead of the Accredited and Registered
 * tabs. Rows are ordered by ORS ID, tagged Approved (on the accreditation,
 * green) or Registered (grey), with a "Showing {start}-{end} of {total}" line
 * above them. Approved rows offer RA-682's Change; registered rows keep
 * RA-492's "Add to accreditation", "Pending", "In progress" and "View change
 * requests". The Add buttons, Withdraw, Remove and a registered site's Change
 * in the design are for later tickets, so must not show.
 *
 * Read-only, against the backend's dev seed (see ra-425's header):
 *   - org 50018 (test/fixtures/manage-exporter-org.js): ORSs 001-003
 *     accredited, 004 Dragon registered and, from RA-697's change request
 *     seed, in the accreditation's in-progress request;
 *   - org 50022 (test/fixtures/no-overseas-sites-org.js): registered, with
 *     no ORSs at all.
 * RA-425 covers each row's site details and interim sites, RA-492 adding a
 * registered site from the table and RA-697 the registration-only table.
 * Paging is covered by the frontend's page tests: no seeded org has more than
 * ten sites.
 *
 * Docker-only because deployed environments have no such seed.
 */

const OVERSEAS_SITES_PATH = `${MANAGE_PATH}/overseas-sites`
const APPROVED = [ORS.rotterdam, ORS.bharat, ORS.berlin]

const urlEndingWith = (path) =>
  expect.stringMatching(new RegExp(`${path.replaceAll('/', '\\/')}(\\?.*)?$`))

describe(`RA-814: one table of overseas reprocessing sites ${DOCKER_ONLY_TAG}`, () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.openOperatorLogin()
    await LoginPage.loginAsOperator()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  describe('An exporter with approved and registered sites', () => {
    beforeEach(async () => {
      await ManageOverseasSitesPage.open(OVERSEAS_SITES_PATH)
      await ManageOverseasSitesPage.pageHeading.waitForDisplayed()
    })

    it('lists every site in one table, by ORS ID, with no tabs', async () => {
      const page = ManageOverseasSitesPage
      await expect(page.intro).toHaveText(
        'You can add new overseas reprocessing sites, change existing site details or withdraw sites from your accreditation.'
      )
      await expect(page.anyTabs).not.toBeExisting()
      await expect(page.table).toBeDisplayed()
      expect(await page.columnHeadings()).toEqual([
        'Site name',
        'Status',
        'Actions'
      ])
      await expect(page.countLine).toHaveText('Showing 1-4 of 4')
      await expect(page.pagination).not.toBeExisting()
      expect(await page.rowOrsIds()).toEqual(['001', '002', '003', '004'])
    })

    it('tags each site Approved or Registered', async () => {
      const page = ManageOverseasSitesPage
      for (const siteId of APPROVED) {
        await expect(page.orsStatusTag(siteId)).toHaveText('Approved')
        await expect(page.orsStatusTag(siteId)).toHaveElementClass(
          'govuk-tag--green'
        )
      }
      await expect(page.orsStatusTag(ORS.dragon)).toHaveText('Registered')
      await expect(page.orsStatusTag(ORS.dragon)).toHaveElementClass(
        'govuk-tag--grey'
      )
    })

    it('offers each row its own actions, and none the page does not support yet', async () => {
      const page = ManageOverseasSitesPage
      // Approved rows: RA-682's Change only (Rotterdam's and Bharat's ORS
      // updates are granted, so not in review); Withdraw is RA-676's.
      for (const siteId of APPROVED) {
        await expect(page.siteActionsCell(siteId)).toHaveText(
          expect.stringMatching(/^Change\b/)
        )
        await expect(page.changeSiteLink(siteId)).toBeExisting()
        await expect(page.addToAccreditationButton(siteId)).not.toBeExisting()
      }

      // Dragon is in the accreditation's in-progress request.
      await expect(page.siteStatusTag(ORS.dragon)).toHaveText('In progress')
      // Its hidden text names the site for screen readers.
      await expect(page.viewRequestLink(ORS.dragon)).toHaveText(
        expect.stringContaining('View change requests')
      )
      await expect(page.addToAccreditationButton(ORS.dragon)).not.toBeExisting()
      // A registered site's Change is RA-683's.
      await expect(page.changeSiteLink(ORS.dragon)).not.toBeExisting()

      // The design's Add buttons, Withdraw and Remove are for later tickets.
      for (const text of await page.controlTexts()) {
        expect(text).not.toMatch(
          /^(Add a new overseas reprocessing site|Withdraw|Remove)\b/
        )
      }
    })
  })

  describe('An exporter with no overseas sites', () => {
    it('says so instead of showing a table', async () => {
      await OperatorPage.open()
      await OperatorPage.navigateToNoOverseasSitesOrg()
      await expect(browser).toHaveUrl(
        urlEndingWith(NO_OVERSEAS_SITES_MANAGE_PATH)
      )
      await ManageRegistrationAccreditationPage.openManageOverseasSites()

      const page = ManageOverseasSitesPage
      await expect(browser).toHaveUrl(
        urlEndingWith(`${NO_OVERSEAS_SITES_MANAGE_PATH}/overseas-sites`)
      )
      await expect(page.pageHeading).toHaveText(
        'Manage overseas reprocessing sites'
      )
      await expect(page.intro).toHaveText(
        'You can add new overseas reprocessing sites or change existing site details.'
      )
      await expect(page.emptyMessage).toHaveText(
        'You have no overseas reprocessing sites.'
      )
      await expect(page.table).not.toBeExisting()
      await expect(page.countLine).not.toBeExisting()
      await expect(page.pagination).not.toBeExisting()
      await expect(page.anyTabs).not.toBeExisting()
      await expect(page.returnToHomeLink).toBeDisplayed()
    })
  })
})
