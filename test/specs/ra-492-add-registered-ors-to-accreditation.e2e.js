import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import AddToAccreditationPage from 'page-objects/add-to-accreditation.page'
import AccreditationRequestsPage from 'page-objects/accreditation-requests.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddOrsConditionsOfExportPage from 'page-objects/add-ors-conditions-of-export.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import ViewPaymentDetailsPage from 'page-objects/view-payment-details.page'
import { assertEligiblePersonWording } from '../helpers/declaration.js'
import {
  addSiteToChangeRequest,
  getAccreditationChanges,
  getOverseasSites
} from '../helpers/case-management.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'

// RA-492: an operator with a GRANTED accreditation applies, in-year, to add
// ORSs from their registered list to it. This proves end to end what the
// backend's and frontend's unit tests cannot on their own: that the material
// landing really offers the in-year route for an approved accreditation; that
// the summary built from the real ORS record locks what is already recorded
// and asks only for what is missing (AC01/AC02); that the charge the operator
// reviews is £328 per site across a multi-site request (AC03/AC04/AC10); that
// the declaration submits the request (AC05/AC07) and reaches the bank
// transfer payment page; and that afterwards the sites show as pending and
// cannot be added again, neither through the UI nor the API (AC08/AC09).
//
// Owns org 50018 ("In-Year Change Exports Ltd", Plastic 2026), the only org
// with an approved accreditation, seeded by the backend's
// DevSeedData__InYearChange (see compose.yml). Its registered sites:
//   900182 / ORS 002 - complete, every lockable field already recorded
//   900183 / ORS 003 - India: coordinates, R code and conditions of export
//                      missing, and outside the EU/OECD, so BES evidence is
//                      required unless it meets the conditions of export
//   900184 / ORS 004 - left alone, to prove an untouched site stays addable
// ORS 001 is already accredited. Submitting is one-way (there is no reset
// endpoint), so the `it()` blocks below run in file order against the one
// request they build up, as ra-481-section-lock.e2e.js does with its org.
describe('RA-492: add a registered ORS to a granted accreditation @docker-only', () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  const organisationId = '50018'
  const applicationId = 'a26000000000000000050018'
  const managePath = `/accreditation/manage-overseas-sites/${applicationId}`
  const completeSite = { siteId: 900182, orsId: '002' }
  const incompleteSite = { siteId: 900183, orsId: '003' }
  const untouchedSite = { siteId: 900184, orsId: '004' }

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
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  async function openManageOverseasSites() {
    await OperatorPage.navigateToInYearChangeTestOrg()
    await OperatorAccreditationPage.openManageOverseasSites()
    await expect(ManageOverseasSitesPage.pageHeading).toHaveText(
      'Manage overseas reprocessing sites'
    )
    expect(new URL(await browser.getUrl()).pathname).toBe(managePath)
  }

  async function waitForPath(suffix) {
    await browser.waitUntil(
      async () => new URL(await browser.getUrl()).pathname.endsWith(suffix),
      { timeout: 30000, timeoutMsg: `Did not reach ${suffix}` }
    )
  }

  it('AC01/AC03/AC04: adds a complete registered ORS, with its recorded fields locked, and shows a £328 charge', async () => {
    await openManageOverseasSites()

    await ManageOverseasSitesPage.showRegisteredTab()
    for (const { orsId } of [completeSite, incompleteSite, untouchedSite]) {
      await expect(
        ManageOverseasSitesPage.addToAccreditationLink(orsId)
      ).toBeDisplayed()
    }
    // ORS 001 is already accredited, so it is not offered again.
    await expect(
      ManageOverseasSitesPage.addToAccreditationLink('001')
    ).not.toExist()

    await ManageOverseasSitesPage.addToAccreditation(completeSite.orsId)
    await waitForPath(`/add/${completeSite.siteId}`)

    // "Add to accreditation: {site name} ({ORS id})" - the existing ORS id.
    await expect(AddToAccreditationPage.pageHeading).toHaveText(
      new RegExp(`^Add to accreditation: .+ \\(${completeSite.orsId}\\)$`)
    )
    await expect(AddToAccreditationPage.pageCaption).toHaveText(
      expect.stringContaining('In-Year Change Exports Ltd')
    )
    // Already recorded on the ORS, so locked: shown, but with no action.
    for (const rowId of [
      'location',
      'coordinates',
      'recycling-operation',
      'conditions-of-export'
    ]) {
      await expect(AddToAccreditationPage.row(rowId)).toBeDisplayed()
      await expect(AddToAccreditationPage.rowAction(rowId)).not.toExist()
      await expect(AddToAccreditationPage.rowMissingTag(rowId)).not.toExist()
    }

    await AddToAccreditationPage.continue()
    await waitForPath('/requests')

    await expect(AccreditationRequestsPage.pageHeading).toHaveText(
      'Accreditation requests'
    )
    await expect(AccreditationRequestsPage.requestRows).toBeElementsArrayOfSize(
      1
    )
    await expect(
      AccreditationRequestsPage.requestSiteName(completeSite.orsId)
    ).toHaveText(expect.stringContaining(`(${completeSite.orsId})`))
    await expect(
      AccreditationRequestsPage.requestType(completeSite.orsId)
    ).toHaveText('New ORS')
    await expect(
      AccreditationRequestsPage.requestStatus(completeSite.orsId)
    ).toHaveText('In progress')
    await expect(AccreditationRequestsPage.chargeInset).toHaveText(
      expect.stringContaining(
        'There will be a charge for this request and it will need to be approved by your regulator.'
      )
    )
    await expect(AccreditationRequestsPage.chargeCount).toHaveText(
      expect.stringContaining('1')
    )
    await expect(AccreditationRequestsPage.chargePerOrs).toHaveText(
      expect.stringContaining('£328.00')
    )
    await expect(AccreditationRequestsPage.chargeTotal).toHaveText(
      expect.stringContaining('£328.00')
    )
  })

  it('AC10/AC02/AC01: "Add another request" adds a second ORS, which cannot continue until its missing information is added', async () => {
    await openManageOverseasSites()

    // f12: the unsubmitted request is signposted from the manage page.
    await expect(ManageOverseasSitesPage.requestsBanner).toHaveText(
      expect.stringContaining(
        'You currently have 1 requests ready for submission.'
      )
    )
    await ManageOverseasSitesPage.clickAndWaitForNextPage(
      ManageOverseasSitesPage.viewRequestsLink
    )
    await waitForPath('/requests')

    await AccreditationRequestsPage.addAnotherRequest()
    expect(new URL(await browser.getUrl()).pathname).toBe(managePath)

    await ManageOverseasSitesPage.showRegisteredTab()
    // The site already in the request is resumed, not added twice.
    await expect(
      ManageOverseasSitesPage.siteStatusTag(completeSite.orsId)
    ).toHaveText('In progress')
    await expect(
      ManageOverseasSitesPage.addToAccreditationLink(completeSite.orsId)
    ).not.toExist()
    await expect(
      ManageOverseasSitesPage.viewRequestLink(completeSite.orsId)
    ).toBeDisplayed()

    await ManageOverseasSitesPage.addToAccreditation(incompleteSite.orsId)
    await waitForPath(`/add/${incompleteSite.siteId}`)

    // Country (India) is on the ORS so stays locked; the rest were never
    // filled, so they are flagged and offered as "Add information".
    await expect(AddToAccreditationPage.rowAction('location')).not.toExist()
    for (const rowId of [
      'coordinates',
      'recycling-operation',
      'conditions-of-export'
    ]) {
      await expect(AddToAccreditationPage.rowMissingTag(rowId)).toHaveText(
        'Missing information'
      )
      await expect(AddToAccreditationPage.rowAction(rowId)).toHaveText(
        expect.stringContaining('Add information')
      )
    }

    // AC02: continuing with missing information is refused, naming each gap.
    await AddToAccreditationPage.continue()
    await expect(AddToAccreditationPage.errorSummary).toBeDisplayed()
    for (const [rowId, message] of [
      ['coordinates', 'Add the coordinates'],
      ['recycling-operation', 'Add the recycling operation'],
      [
        'conditions-of-export',
        'Add whether the site meets the conditions of export'
      ],
      ['bes-evidence', 'Upload evidence of broadly equivalent standards']
    ]) {
      await expect(AddToAccreditationPage.errorSummaryItem(rowId)).toHaveText(
        message
      )
      await expect(AddToAccreditationPage.rowError(rowId)).toBeDisplayed()
    }
    expect(new URL(await browser.getUrl()).pathname).toMatch(
      new RegExp(`/add/${incompleteSite.siteId}$`)
    )

    // AC01: complete the missing information.
    await AddToAccreditationPage.openRowAction('coordinates')
    await waitForPath(`/add/${incompleteSite.siteId}/location`)
    await expect(AddOrsSiteLocationPage.lockedCountry).toHaveText(
      expect.stringContaining('India')
    )
    await AddOrsSiteLocationPage.coordinatesInput.setValue('19.0760, 72.8777')
    await AddOrsSiteLocationPage.continue()
    await waitForPath(`/add/${incompleteSite.siteId}`)
    // Supplied in this request, so now editable as "Change".
    await expect(AddToAccreditationPage.rowAction('coordinates')).toHaveText(
      expect.stringContaining('Change')
    )
    await expect(
      AddToAccreditationPage.rowMissingTag('coordinates')
    ).not.toExist()

    await AddToAccreditationPage.openRowAction('recycling-operation')
    await waitForPath(`/add/${incompleteSite.siteId}/recycling-operation`)
    await AddOrsRecyclingOperationPage.selectPrimaryOperationCode()
    await AddOrsRecyclingOperationPage.continue()
    await waitForPath(`/add/${incompleteSite.siteId}`)

    // "No" keeps BES evidence required for a non-EU, non-OECD site.
    await AddToAccreditationPage.openRowAction('conditions-of-export')
    await waitForPath(`/add/${incompleteSite.siteId}/conditions-of-export`)
    await AddOrsConditionsOfExportPage.selectNo()
    await AddOrsConditionsOfExportPage.continue()
    await waitForPath(`/add/${incompleteSite.siteId}`)

    await AddToAccreditationPage.openRowAction('bes-evidence')
    await waitForPath(`/add/${incompleteSite.siteId}/bes-evidence`)
    await BesEvidencePage.submitUpload('business-plan.pdf')
    // The status page polls until the virus scan completes, then returns to
    // the summary.
    await browser.waitUntil(
      async () =>
        new URL(await browser.getUrl()).pathname.endsWith(
          `/add/${incompleteSite.siteId}`
        ),
      { timeout: 60000, timeoutMsg: 'BES upload did not return to summary' }
    )
    await expect(
      AddToAccreditationPage.rowMissingTag('bes-evidence')
    ).not.toExist()

    await AddToAccreditationPage.continue()
    await waitForPath('/requests')

    // AC04: two new ORSs at £328 each.
    await expect(AccreditationRequestsPage.requestRows).toBeElementsArrayOfSize(
      2
    )
    await expect(
      AccreditationRequestsPage.requestRow(incompleteSite.orsId)
    ).toBeDisplayed()
    await expect(AccreditationRequestsPage.chargeCount).toHaveText(
      expect.stringContaining('2')
    )
    await expect(AccreditationRequestsPage.chargePerOrs).toHaveText(
      expect.stringContaining('£328.00')
    )
    await expect(AccreditationRequestsPage.chargeTotal).toHaveText(
      expect.stringContaining('£656.00')
    )
  })

  it('AC05/AC07: the declaration submits the request without accrediting the sites, then shows the £656 bank transfer', async () => {
    const sitesBefore = await getOverseasSites(organisationId, applicationId)

    await openManageOverseasSites()
    await ManageOverseasSitesPage.clickAndWaitForNextPage(
      ManageOverseasSitesPage.viewRequestsLink
    )
    await AccreditationRequestsPage.continue()
    await waitForPath('/declaration')

    await assertEligiblePersonWording(SubmitApplicationPage)
    await SubmitApplicationPage.submitApplication()
    await waitForPath('/payment')

    await expect(ViewPaymentDetailsPage.amountDue).toHaveText(
      expect.stringContaining('£656.00')
    )
    await expect(ViewPaymentDetailsPage.bankAmount).toHaveText(
      expect.stringContaining('£656.00')
    )

    // AC07: Submitted, against the existing ORS records and ids.
    const changes = await getAccreditationChanges(organisationId, applicationId)
    const [request] = changes.requests
    expect(request.status).toBe('Submitted')
    expect(request.changeType).toBe('add-overseas-site')
    expect(
      request.sites.map(({ siteId, orsId }) => ({ siteId, orsId }))
    ).toEqual(
      expect.arrayContaining([
        { siteId: completeSite.siteId, orsId: completeSite.orsId },
        { siteId: incompleteSite.siteId, orsId: incompleteSite.orsId }
      ])
    )
    expect(request.sites).toHaveLength(2)
    expect(request.charge.totalPence).toBe(65600)

    // The approved accreditation is untouched: no new ORS record, and the
    // submitted sites are still only registered until the regulator approves.
    const sitesAfter = await getOverseasSites(organisationId, applicationId)
    expect(sitesAfter).toEqual(sitesBefore)
    for (const { siteId } of [completeSite, incompleteSite]) {
      expect(
        changes.sites.find((site) => site.siteId === siteId).accreditationStatus
      ).toBe('Registered')
    }
  })

  it('AC08/AC09: submitted sites show as pending and cannot be added again', async () => {
    await openManageOverseasSites()

    await expect(ManageOverseasSitesPage.pendingChangeBanner).toHaveText(
      expect.stringContaining('You have a change pending.')
    )
    await expect(ManageOverseasSitesPage.requestsBanner).not.toExist()

    await ManageOverseasSitesPage.showAccreditedTab()
    for (const { orsId } of [completeSite, incompleteSite]) {
      await expect(
        ManageOverseasSitesPage.accreditedSiteRow(orsId)
      ).toBeDisplayed()
      await expect(ManageOverseasSitesPage.siteStatusTag(orsId)).toHaveText(
        'Pending'
      )
      await expect(
        ManageOverseasSitesPage.addToAccreditationLink(orsId)
      ).not.toExist()
    }

    // A registered site outside the submitted request is still addable.
    await ManageOverseasSitesPage.showRegisteredTab()
    await expect(
      ManageOverseasSitesPage.registeredSiteRow(completeSite.orsId)
    ).not.toExist()
    await expect(
      ManageOverseasSitesPage.addToAccreditationLink(untouchedSite.orsId)
    ).toBeDisplayed()

    // AC09: the summary for a pending site is not reachable by URL...
    await browser.url(`${managePath}/add/${completeSite.siteId}`)
    await waitForPath(managePath)
    await expect(ManageOverseasSitesPage.pendingChangeBanner).toBeDisplayed()

    // ...and the backend refuses to add it to a new request.
    expect(
      await addSiteToChangeRequest(
        organisationId,
        applicationId,
        completeSite.siteId
      )
    ).toBe(409)
  })
})
