import { browser, expect } from '@wdio/globals'
import AccreditationRequestsPage from 'page-objects/accreditation-requests.page'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import UpdateOverseasSitePage from 'page-objects/update-overseas-site.page'

import { getAccreditationChanges } from '../../helpers/case-management.js'
import {
  clearChangeRequests,
  orsWorkItemsFor,
  skipUnlessMonorepoRun
} from '../../helpers/monorepo.js'
import { signInAsOperator } from '../../helpers/monorepo-journey.js'
import { reportDetails, reportStep } from '../../helpers/report-step.js'
import { readSeededYear } from '../../helpers/seeded-year.js'
import { waitForUrl } from '../../helpers/wait-for-url.js'
import {
  INTERIM,
  MANAGE_PATH,
  MATERIAL,
  ORGANISATION_ID,
  ORGANISATION_NAME,
  ORS,
  OVERSEAS_SITES_PATH,
  accreditationApplicationId
} from '../../fixtures/in-year-update-org.js'

// Runs only against the DEFRA/epr-register-enrol monorepo's local stack:
// npm run test:monorepo (wdio.monorepo.conf.js). Never in CI.
//
// RA-682: an operator changes the details of accredited ORSs, and their
// interim sites, as in-year changes, and adds a registered ORS in the same
// request. Org 50025: ORSs A (two interim sites), B and E accredited; C and D
// registered.
//
//   1 AC01/AC02  change A's name and contact; the locked fields have no Change
//                link and country and coordinates are read-only inputs;
//                changing A again keeps one request row
//   2            change B's town: two "ORS update" rows and nothing to pay
//   3            add registered C: three rows, charged for one ORS
//   4 AC04       on A, change one interim site, remove the other and add one
//   5            remove B's update, then change B again
//   6 AC05/AC06  submit: the payment page, for C alone
//   7 AC03       A, B and C are pending; D can still be added, E changed
//   8            case management raised two ORS update work items and one
//                add-ORS work item, the updates under their own request id
//   9 AC05       an interim-only change to E is free: straight to the
//                confirmation, no payment page
//
// The run first deletes 50025's change requests and the case management work
// items and submissions they raised, so it can be run again and again. Nothing
// here is approved, so the seeded ORSs never change. The tests share one
// request and run in order: each skips when the one before did not get as far
// as it needs.

const UPDATE = 'update-overseas-site'
const ADD = 'add-overseas-site'
const IN_YEAR_CHANGE_REFERENCE = /^IYC-ORS-\d{4}-\d{5}$/

describe('RA-682: change accredited ORSs alongside adding one @monorepo', () => {
  const progress = {}
  let applicationId

  function requireStage(context, stage) {
    if (!progress[stage]) {
      reportDetails('Skipped', { reason: `not ${stage}` })
      context.skip()
    }
  }

  async function waitForPath(suffix, { timeout = 30000 } = {}) {
    await waitForUrl(
      (url) => new URL(url).pathname.endsWith(suffix),
      `Did not reach ${suffix}`,
      { timeout }
    )
  }

  async function openDetails(site) {
    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.changeSite(site.siteId)
    await waitForPath(`/update/${site.siteId}`)
  }

  async function openRequests() {
    await browser.url(
      `/accreditation/manage-overseas-sites/${applicationId}/requests`
    )
    await waitForPath('/requests')
  }

  before(function () {
    skipUnlessMonorepoRun(this)
  })

  before(async () => {
    const cleared = await clearChangeRequests({
      organisationId: ORGANISATION_ID
    })
    reportDetails(`Cleared organisation ${ORGANISATION_ID}`, cleared)
    await browser.deleteCookies()
    await signInAsOperator()
    const year = await readSeededYear({
      managePath: MANAGE_PATH,
      organisationName: ORGANISATION_NAME,
      material: MATERIAL
    })
    applicationId = accreditationApplicationId(year)
  })

  it("AC01/AC02: changes A's name and contact, with its locked fields locked", async () => {
    await openDetails(ORS.a)
    await expect(UpdateOverseasSitePage.statusTag).toHaveText('Approved')
    for (const locked of [
      'coordinates',
      'recycling-operation',
      'basel-codes',
      'conditions-of-export',
      'bes-evidence'
    ]) {
      await expect(UpdateOverseasSitePage.rowValue(locked)).toExist()
      await expect(UpdateOverseasSitePage.rowAction(locked)).not.toExist()
    }

    await reportStep(
      'Location: country and coordinates are read-only',
      async () => {
        await UpdateOverseasSitePage.openRowAction('location')
        await waitForPath(`/update/${ORS.a.siteId}/details/location`)
        await expect(UpdateOverseasSitePage.input('country')).toHaveValue(
          'Poland'
        )
        await expect(UpdateOverseasSitePage.input('country')).toHaveAttribute(
          'readonly'
        )
        await expect(
          UpdateOverseasSitePage.input('coordinates')
        ).toHaveAttribute('readonly')
        // Saved unchanged: the read-only values are shown but not sent.
        await UpdateOverseasSitePage.continue()
        await waitForPath(`/update/${ORS.a.siteId}`)
      }
    )

    await reportStep('Name and contact', async () => {
      await UpdateOverseasSitePage.openRowAction('site-name')
      await UpdateOverseasSitePage.fill({ siteName: 'Gdansk Recycling' })
      await UpdateOverseasSitePage.continue()
      await waitForPath(`/update/${ORS.a.siteId}`)
      await expect(UpdateOverseasSitePage.successBanner).toHaveText(
        expect.stringContaining('Site name updated.')
      )
      await UpdateOverseasSitePage.openRowAction('contact-email')
      await UpdateOverseasSitePage.fill({
        contactName: 'Ola Nowak',
        contactEmail: 'ola.nowak@example.com'
      })
      await UpdateOverseasSitePage.continue()
      await waitForPath(`/update/${ORS.a.siteId}`)
    })

    await expect(UpdateOverseasSitePage.statusTag).toHaveText('In progress')
    await expect(UpdateOverseasSitePage.rowValue('site-name')).toHaveText(
      'Gdansk Recycling'
    )
    await expect(UpdateOverseasSitePage.rowValue('contact-name')).toHaveText(
      'Ola Nowak'
    )

    await openRequests()
    await expect(AccreditationRequestsPage.requestRows).toBeElementsArrayOfSize(
      1
    )
    await expect(AccreditationRequestsPage.requestType(ORS.a.orsId)).toHaveText(
      'ORS update'
    )
    progress.a = true
  })

  it("Changes B's town: two ORS updates and nothing to pay", async function () {
    requireStage(this, 'a')
    await openDetails(ORS.b)
    await UpdateOverseasSitePage.openRowAction('location')
    await UpdateOverseasSitePage.fill({ townOrCity: 'Vila Nova de Gaia' })
    await UpdateOverseasSitePage.continue()
    await waitForPath(`/update/${ORS.b.siteId}`)
    await UpdateOverseasSitePage.saveAndContinue()
    await waitForPath('/requests')

    await expect(AccreditationRequestsPage.requestRows).toBeElementsArrayOfSize(
      2
    )
    await expect(AccreditationRequestsPage.requestType(ORS.b.orsId)).toHaveText(
      'ORS update'
    )
    await expect(AccreditationRequestsPage.chargeInset).not.toExist()
    progress.b = true
  })

  it('Adds registered C in the same request: charged for one ORS', async function () {
    requireStage(this, 'b')
    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.addToAccreditation(ORS.c.siteId)
    await waitForPath(`/add/${ORS.c.siteId}`)
    await AddToAccreditationPage.continue()
    await waitForPath('/requests')

    await expect(AccreditationRequestsPage.requestRows).toBeElementsArrayOfSize(
      3
    )
    await expect(AccreditationRequestsPage.requestType(ORS.c.orsId)).toHaveText(
      'New ORS'
    )
    await expect(AccreditationRequestsPage.chargeCount).toHaveText(
      'Number of overseas reprocessing sites: 1'
    )
    progress.c = true
  })

  it("AC04: changes, removes and adds A's interim sites", async function () {
    requireStage(this, 'c')
    await openDetails(ORS.a)
    const gdynia = `interim-${INTERIM.gdynia.siteId}`
    const szczecin = `interim-${INTERIM.szczecin.siteId}`

    await UpdateOverseasSitePage.changeInterim(gdynia)
    await expect(UpdateOverseasSitePage.input('country')).toHaveAttribute(
      'readonly'
    )
    await UpdateOverseasSitePage.fill({ siteName: 'Gdynia Port Hub' })
    await UpdateOverseasSitePage.continue()
    await waitForPath(`/update/${ORS.a.siteId}`)

    await UpdateOverseasSitePage.removeInterim(szczecin)
    await waitForPath(`/update/${ORS.a.siteId}`)

    await UpdateOverseasSitePage.newInterimSite({
      siteName: 'Krakow Depot',
      country: 'Poland',
      codes: ['R13']
    })
    await waitForPath(`/update/${ORS.a.siteId}`)

    await expect(UpdateOverseasSitePage.interimState(gdynia)).toHaveText(
      'Changed'
    )
    await expect(UpdateOverseasSitePage.interimLine(gdynia)).toHaveText(
      expect.stringContaining('Gdynia Port Hub')
    )
    await expect(UpdateOverseasSitePage.interimState(szczecin)).toHaveText(
      'To be removed'
    )
    await expect(UpdateOverseasSitePage.interimRows).toBeElementsArrayOfSize(3)

    await openRequests()
    await expect(AccreditationRequestsPage.requestRows).toBeElementsArrayOfSize(
      3
    )
    progress.interim = true
  })

  it("Removes B's update from the request, then changes B again", async function () {
    requireStage(this, 'interim')
    await openRequests()
    await AccreditationRequestsPage.removeRequest(ORS.b.orsId)
    await waitForPath('/requests')
    await expect(AccreditationRequestsPage.requestRows).toBeElementsArrayOfSize(
      2
    )
    await expect(AccreditationRequestsPage.chargeCount).toHaveText(
      'Number of overseas reprocessing sites: 1'
    )

    await openDetails(ORS.b)
    await expect(UpdateOverseasSitePage.statusTag).toHaveText('Approved')
    await UpdateOverseasSitePage.openRowAction('location')
    await UpdateOverseasSitePage.fill({ townOrCity: 'Vila Nova de Gaia' })
    await UpdateOverseasSitePage.continue()
    await waitForPath(`/update/${ORS.b.siteId}`)
    await openRequests()
    await expect(AccreditationRequestsPage.requestRows).toBeElementsArrayOfSize(
      3
    )
    progress.ready = true
  })

  it('AC05/AC06: submits the request, and pays for C alone', async function () {
    requireStage(this, 'ready')
    await openRequests()
    await AccreditationRequestsPage.continue()
    await waitForPath('/declaration')
    await SubmitApplicationPage.submitApplication()
    // Reached only once case management has accepted both submissions.
    await waitForPath('/payment')

    const { requests } = await getAccreditationChanges(
      ORGANISATION_ID,
      applicationId
    )
    const [request] = requests
    expect(request.status).toBe('Submitted')
    expect(request.sites).toHaveLength(3)
    for (const item of request.sites) {
      expect(item.caseManagementReference).toMatch(IN_YEAR_CHANGE_REFERENCE)
    }
    progress.requestId = request.requestId
    progress.submitted = true
    reportDetails(
      'Submitted',
      request.sites.map((s) => ({
        orsId: s.orsId,
        changeType: s.changeType,
        reference: s.caseManagementReference
      }))
    )
  })

  it('AC03: A, B and C are pending; D can still be added and E changed', async function () {
    requireStage(this, 'submitted')
    await browser.url(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.openTab('accredited')
    for (const site of [ORS.a, ORS.b]) {
      await expect(
        ManageOverseasSitesPage.changeSiteLink(site.siteId)
      ).not.toExist()
    }
    await expect(ManageOverseasSitesPage.changeSiteLink(ORS.e.siteId)).toExist()
    await ManageOverseasSitesPage.openTab('registered')
    await expect(
      ManageOverseasSitesPage.addToAccreditationButton(ORS.c.siteId)
    ).not.toExist()
    await expect(
      ManageOverseasSitesPage.addToAccreditationButton(ORS.d.siteId)
    ).toExist()

    await browser.url(
      `/accreditation/manage-overseas-sites/${applicationId}/update/${ORS.a.siteId}`
    )
    await expect(UpdateOverseasSitePage.statusTag).toHaveText('Pending')
    await expect(UpdateOverseasSitePage.pendingInset).toBeDisplayed()
    await expect(UpdateOverseasSitePage.rowAction('site-name')).not.toExist()
  })

  it('Case management: two ORS update work items and one add-ORS work item', async function () {
    requireStage(this, 'submitted')
    const workItems = await orsWorkItemsFor({ organisationId: ORGANISATION_ID })
    reportDetails('Work items', workItems)

    const bySite = Object.fromEntries(
      workItems.map((w) => [Number(w.siteId), w])
    )
    expect(workItems).toHaveLength(3)
    expect(bySite[ORS.c.siteId].typeId).toBe(ADD)
    expect(bySite[ORS.c.siteId].operatorRequestId).toBe(progress.requestId)
    expect(bySite[ORS.c.siteId].chargePence).toBeGreaterThan(0)
    for (const site of [ORS.a, ORS.b]) {
      expect(bySite[site.siteId].typeId).toBe(UPDATE)
      expect(bySite[site.siteId].operatorRequestId).toBe(
        `${progress.requestId}:${UPDATE}`
      )
      expect(bySite[site.siteId].chargePence).toBe(0)
    }
    expect(bySite[ORS.a.siteId].proposed.siteName).toBe('Gdansk Recycling')
    expect(bySite[ORS.a.siteId].interimSiteChanges).toEqual([
      'change',
      'remove',
      'add'
    ])
    expect(bySite[ORS.b.siteId].proposed.townOrCity).toBe('Vila Nova de Gaia')
    const references = workItems.map((w) => w.applicationReference)
    expect(new Set(references).size).toBe(3)
  })

  it('AC05: an interim-only change to E is free, so there is no payment page', async function () {
    requireStage(this, 'submitted')
    await openDetails(ORS.e)
    await UpdateOverseasSitePage.newInterimSite({
      siteName: 'Turin Depot',
      country: 'Italy',
      codes: ['R12']
    })
    await waitForPath(`/update/${ORS.e.siteId}`)
    await UpdateOverseasSitePage.saveAndContinue()
    await waitForPath('/requests')
    await expect(AccreditationRequestsPage.chargeInset).not.toExist()
    await AccreditationRequestsPage.continue()
    await waitForPath('/declaration')
    await SubmitApplicationPage.submitApplication()
    await waitForPath('/submitted')

    const workItems = await orsWorkItemsFor({ organisationId: ORGANISATION_ID })
    const milano = workItems.find((w) => Number(w.siteId) === ORS.e.siteId)
    expect(milano.typeId).toBe(UPDATE)
    expect(milano.interimSiteChanges).toEqual(['add'])
  })
})
