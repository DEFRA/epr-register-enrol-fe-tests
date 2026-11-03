import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ManageDashboardPage from 'page-objects/manage-dashboard.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'

/**
 * RA-425: an exporter views the overseas reprocessing sites (ORSs) and interim
 * sites on its current accreditation - material dashboard, then "Manage your
 * registration and accreditation", then "Manage overseas reprocessing sites".
 *
 * Runs against org 50018 ("Manage Accreditation Test Ltd"), which exists only
 * for this spec. The backend's dev seed (DevExporterAccreditationSeedService,
 * on in this stack via DevSeedData__Enabled) gives its Plastic registration an
 * Approved accreditation for the current calendar year:
 *   - ORS 001 Rotterdam: Calais (current), Antwerp (shared with 002) and
 *     Old Depot (removed - must never show)
 *   - ORS 002 Bharat: Antwerp
 *   - ORS 003 Berlin: no interim sites, so no disclosure
 *   - ORS 004 Dragon: registered, not accredited
 * Nothing here writes, but every read is still scoped to these seeded site ids
 * rather than "the first row" or a page-wide count (see ra-603's warnings about
 * shared state): mongo is not reset between runs.
 *
 * Needs IN_YEAR_CHANGES_ENABLED on the frontend, and docker-only because
 * deployed environments have no such seed.
 */

const ORGANISATION_ID = '50018'
const REGISTRATION_ID = 'aaa000000000000000050018'
const DASHBOARD_PATH = `/manage/${ORGANISATION_ID}/${REGISTRATION_ID}/Plastic`
const MANAGE_PATH = `${DASHBOARD_PATH}/registration-accreditation`
const OVERSEAS_SITES_PATH = `${DASHBOARD_PATH}/overseas-sites`

// The seed's year comes from the backend's clock, in UTC.
const YEAR = new Date().getUTCFullYear()

const ORS = {
  rotterdam: 901801,
  bharat: 901805,
  berlin: 901806,
  dragon: 901807
}
const INTERIM = { calais: 901802, antwerp: 901803, oldDepot: 901804 }

// The references are derived per environment (and differ slightly between the
// backend seed and the frontend stub), so check their shape, not their value.
const REGISTRATION_NUMBER = /^R\d{2}EX\d+PL$/
const ACCREDITATION_NUMBER = /^A\d{2}EX\d+PL$/

const urlEndingWith = (path) =>
  expect.stringMatching(new RegExp(`${path.replaceAll('/', '\\/')}(\\?.*)?$`))

async function expectSite(tab, siteId, { orsId, name, address }) {
  await expect(ManageOverseasSitesPage.siteOrsId(tab, siteId)).toHaveText(orsId)
  await expect(ManageOverseasSitesPage.siteName(tab, siteId)).toHaveText(name)
  await expect(ManageOverseasSitesPage.siteAddress(tab, siteId)).toHaveText(
    address
  )
}

async function expectInterimSite(orsSiteId, interimSiteId, text) {
  await expect(
    ManageOverseasSitesPage.interimSiteRowIn(orsSiteId, interimSiteId)
  ).toHaveText(text)
}

describe(`RA-425: view ORSs and interim sites for an existing accreditation ${DOCKER_ONLY_TAG}`, () => {
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

  it('follows the dashboard and manage page through to the overseas sites', async () => {
    await OperatorPage.open()
    await OperatorPage.navigateToManageDashboardExporter()

    await expect(browser).toHaveUrl(urlEndingWith(DASHBOARD_PATH))
    await expect(ManageDashboardPage.pageHeading).toHaveText('Plastic')
    await expect(ManageDashboardPage.registrationStatusTag).toHaveText(
      'Approved'
    )
    await expect(ManageDashboardPage.registrationNumber).toHaveText(
      REGISTRATION_NUMBER
    )
    await expect(ManageDashboardPage.accreditationStatusTag).toHaveText(
      'GRANTED'
    )
    await expect(ManageDashboardPage.accreditationNumber).toHaveText(
      ACCREDITATION_NUMBER
    )

    await ManageDashboardPage.openManageRegistrationAccreditation()

    await expect(browser).toHaveUrl(urlEndingWith(MANAGE_PATH))
    const managePage = ManageRegistrationAccreditationPage
    await expect(managePage.pageHeading).toHaveText(
      'Manage your registration and accreditation'
    )
    await expect(managePage.pageCaption).toHaveText(
      `Manage Accreditation Test Ltd (${YEAR}, Plastic)`
    )
    await expect(managePage.applicationStatusTag).toHaveText('GRANTED')
    await expect(managePage.accreditationNumber).toHaveText(
      ACCREDITATION_NUMBER
    )
    await expect(managePage.registrationNumber).toHaveText(REGISTRATION_NUMBER)
    // An accreditation runs to the end of the calendar year it is for.
    await expect(managePage.expiryDate).toHaveText(`31 Dec ${YEAR}`)
    await expect(managePage.manageAccreditationCard).toBeDisplayed()
    await expect(managePage.upgradeTonnageLink).toHaveText('Upgrade tonnage')
    await expect(managePage.manageOverseasSitesCard).toBeDisplayed()
    await expect(managePage.backLink).toHaveAttribute(
      'href',
      urlEndingWith(DASHBOARD_PATH)
    )

    await managePage.openManageOverseasSites()

    await expect(browser).toHaveUrl(urlEndingWith(OVERSEAS_SITES_PATH))
    await expect(ManageOverseasSitesPage.pageHeading).toHaveText(
      'Manage overseas reprocessing sites'
    )
    await expect(ManageOverseasSitesPage.pageCaption).toHaveText(
      `Manage Accreditation Test Ltd (${YEAR}, Plastic)`
    )
  })

  describe('Manage overseas reprocessing sites', () => {
    beforeEach(async () => {
      await ManageOverseasSitesPage.open(OVERSEAS_SITES_PATH)
      await ManageOverseasSitesPage.pageHeading.waitForDisplayed()
    })

    it('lists the accredited sites, each with only its current interim sites', async () => {
      await expect(ManageOverseasSitesPage.tab('accredited')).toHaveText(
        'Accredited (3)'
      )
      await expect(ManageOverseasSitesPage.panel('accredited')).toBeDisplayed()

      await expectSite('accredited', ORS.rotterdam, {
        orsId: '001',
        name: 'Rotterdam Recycling BV',
        address: 'Industrieweg 44, Netherlands'
      })
      await expectSite('accredited', ORS.bharat, {
        orsId: '002',
        name: 'Bharat Recycling',
        address: '12 Ring Road, India'
      })
      await expectSite('accredited', ORS.berlin, {
        orsId: '003',
        name: 'Berlin Steel GmbH',
        address: 'Hafenstrasse 9, Germany'
      })
      await expect(
        ManageOverseasSitesPage.siteRow('accredited', ORS.dragon)
      ).not.toBeExisting()

      // ORS 001: the removed interim site is left out of the count and list.
      await expect(
        ManageOverseasSitesPage.interimSiteDisclosureSummary(ORS.rotterdam)
      ).toHaveText('Show interim sites (2)')
      expect(
        await ManageOverseasSitesPage.interimSiteIdsIn(ORS.rotterdam)
      ).toEqual([String(INTERIM.calais), String(INTERIM.antwerp)])
      await expectInterimSite(
        ORS.rotterdam,
        INTERIM.calais,
        'Calais Storage SARL, France, R13'
      )
      await expectInterimSite(
        ORS.rotterdam,
        INTERIM.antwerp,
        'Antwerp Transfer Hub, Belgium, R3, R13'
      )
      await expect(
        ManageOverseasSitesPage.interimSiteRow(INTERIM.oldDepot)
      ).not.toBeExisting()

      // ORS 002: the interim site it shares with ORS 001 shows here too.
      await expect(
        ManageOverseasSitesPage.interimSiteDisclosureSummary(ORS.bharat)
      ).toHaveText('Show interim sites (1)')
      expect(
        await ManageOverseasSitesPage.interimSiteIdsIn(ORS.bharat)
      ).toEqual([String(INTERIM.antwerp)])
      await expectInterimSite(
        ORS.bharat,
        INTERIM.antwerp,
        'Antwerp Transfer Hub, Belgium, R3, R13'
      )

      // ORS 003 has no interim sites, so no disclosure at all.
      await expect(
        ManageOverseasSitesPage.interimSiteDisclosure(ORS.berlin)
      ).not.toBeExisting()
    })

    it('switches to the registered sites', async () => {
      await expect(ManageOverseasSitesPage.tab('registered')).toHaveText(
        'Registered (1)'
      )

      await ManageOverseasSitesPage.openTab('registered')

      await expect(
        ManageOverseasSitesPage.panel('accredited')
      ).not.toBeDisplayed()
      await expectSite('registered', ORS.dragon, {
        orsId: '004',
        name: 'Dragon Recyclers',
        address: '8 Harbour Avenue, Vietnam'
      })
      await expect(
        ManageOverseasSitesPage.interimSiteDisclosure(ORS.dragon)
      ).not.toBeExisting()
      for (const siteId of [ORS.rotterdam, ORS.bharat, ORS.berlin]) {
        await expect(
          ManageOverseasSitesPage.siteRow('registered', siteId)
        ).not.toBeExisting()
      }
    })

    it('goes back to the manage page', async () => {
      await ManageOverseasSitesPage.goBack()

      await expect(browser).toHaveUrl(urlEndingWith(MANAGE_PATH))
      await expect(ManageRegistrationAccreditationPage.pageHeading).toHaveText(
        'Manage your registration and accreditation'
      )
    })

    it('returns to the material dashboard', async () => {
      await ManageOverseasSitesPage.returnToHome()

      await expect(browser).toHaveUrl(urlEndingWith(DASHBOARD_PATH))
      await expect(ManageDashboardPage.pageHeading).toHaveText('Plastic')
    })
  })
})
