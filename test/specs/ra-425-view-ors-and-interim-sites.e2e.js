import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'
import {
  ORGANISATION_NAME,
  MATERIAL,
  MANAGE_PATH,
  REEX_REGISTRATION_PATH,
  ORS,
  INTERIM,
  registrationNumber,
  accreditationNumber
} from '../fixtures/manage-exporter-org.js'
import { readSeededYear as readSeededYearFrom } from '../helpers/seeded-year.js'

/**
 * RA-425: an exporter views the overseas reprocessing sites (ORSs) and interim
 * sites on its current accreditation - "Manage registration and
 * accreditation", then "Manage overseas reprocessing sites". Re/Ex's material
 * page links to the first; the operator test page stands in for it here.
 *
 * Runs against org 50018 ("Manage Accreditation Test Ltd"), which no other
 * spec writes to. The backend's dev seed (DevExporterAccreditationSeedService,
 * on in this stack via DevSeedData__ManageExporterEnabled, which seeds only the
 * dedicated orgs 50018-50022) gives its Plastic registration an Approved
 * accreditation for the calendar year the stack started in:
 *   - ORS 001 Rotterdam: Calais (current), Antwerp (also used by 002) and
 *     Old Depot (removed - must never show)
 *   - ORS 002 Bharat: its own copy of Antwerp
 *   - ORS 003 Berlin: no interim sites, so no disclosure
 *   - ORS 004 Dragon: registered, not accredited; its registration lists an
 *     interim site (Saigon), which must never show
 * RA-697's seed (DevChangeRequestSeedService) also gives the accreditation
 * change requests without touching its sites, so the tab counts below hold;
 * the Registered tab now shows Dragon as "In progress" with View, which this
 * spec doesn't assert on.
 * Nothing here writes, but every read is still scoped to these seeded site ids
 * rather than "the first row" or a page-wide count (see ra-603's warnings about
 * shared state): mongo is not reset between runs.
 *
 * Needs, all set in docker/config:
 *   - DevSeedData__ManageExporterEnabled on the backend (the seed above)
 *   - FeatureFlags__InYearChangesEnabled on the backend (the registration
 *     status endpoint)
 *   - IN_YEAR_CHANGES_ENABLED on the frontend
 * Docker-only because deployed environments have no such seed.
 */

const OVERSEAS_SITES_PATH = `${MANAGE_PATH}/overseas-sites`

const caption = (year) => `${ORGANISATION_NAME} (${year}, ${MATERIAL})`
const urlEndingWith = (path) =>
  expect.stringMatching(new RegExp(`${path.replaceAll('/', '\\/')}(\\?.*)?$`))

const readSeededYear = () =>
  readSeededYearFrom({
    managePath: MANAGE_PATH,
    organisationName: ORGANISATION_NAME,
    material: MATERIAL
  })

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

  it('follows the manage page through to the overseas sites', async () => {
    const year = await readSeededYear()

    await OperatorPage.open()
    await OperatorPage.navigateToManageExporter()

    await expect(browser).toHaveUrl(urlEndingWith(MANAGE_PATH))
    const managePage = ManageRegistrationAccreditationPage
    await expect(managePage.pageHeading).toHaveText(
      'Manage registration and accreditation'
    )
    await expect(managePage.pageCaption).toHaveText(caption(year))
    await expect(managePage.applicationStatusTag).toHaveText('GRANTED')
    await expect(managePage.accreditationNumber).toHaveText(
      accreditationNumber(year)
    )
    await expect(managePage.registrationNumber).toHaveText(
      registrationNumber(year)
    )
    // An accreditation runs to the end of the calendar year it is for.
    await expect(managePage.expiryDate).toHaveText(`31 Dec ${year}`)
    await expect(managePage.manageAccreditationCard).toBeDisplayed()
    await expect(managePage.upgradeTonnageLink).toHaveText('Upgrade tonnage')
    await expect(managePage.manageOverseasSitesCard).toBeDisplayed()
    await expect(managePage.backLink).toHaveAttribute(
      'href',
      urlEndingWith(REEX_REGISTRATION_PATH)
    )

    await managePage.openManageOverseasSites()

    await expect(browser).toHaveUrl(urlEndingWith(OVERSEAS_SITES_PATH))
    await expect(ManageOverseasSitesPage.pageHeading).toHaveText(
      'Manage overseas reprocessing sites'
    )
    await expect(ManageOverseasSitesPage.pageCaption).toHaveText(caption(year))
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
      ).toEqual([String(INTERIM.calais), String(INTERIM.antwerpForRotterdam)])
      await expectInterimSite(
        ORS.rotterdam,
        INTERIM.calais,
        'Calais Storage SARL, France, R13'
      )
      await expectInterimSite(
        ORS.rotterdam,
        INTERIM.antwerpForRotterdam,
        'Antwerp Transfer Hub, Belgium, R3, R13'
      )
      await expect(
        ManageOverseasSitesPage.interimSiteRow(INTERIM.oldDepot)
      ).not.toBeExisting()

      // ORS 002: its own copy of the site ORS 001 also uses.
      await expect(
        ManageOverseasSitesPage.interimSiteDisclosureSummary(ORS.bharat)
      ).toHaveText('Show interim sites (1)')
      expect(
        await ManageOverseasSitesPage.interimSiteIdsIn(ORS.bharat)
      ).toEqual([String(INTERIM.antwerpForBharat)])
      await expectInterimSite(
        ORS.bharat,
        INTERIM.antwerpForBharat,
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
      await expect(
        ManageOverseasSitesPage.interimSiteRow(INTERIM.saigonForDragon)
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
        'Manage registration and accreditation'
      )
    })

    // Re/Ex isn't in this stack, so check where the link goes without following it.
    it('links home to the Re/Ex material page', async () => {
      await expect(ManageOverseasSitesPage.returnToHomeLink).toHaveAttribute(
        'href',
        urlEndingWith(REEX_REGISTRATION_PATH)
      )
    })
  })
})
