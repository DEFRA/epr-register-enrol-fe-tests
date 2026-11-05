import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
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
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'
import { readSeededYear } from '../helpers/seeded-year.js'
import { waitForUrl } from '../helpers/wait-for-url.js'
import {
  ORGANISATION_ID,
  ORGANISATION_NAME,
  MATERIAL,
  MANAGE_PATH,
  OVERSEAS_SITES_PATH,
  ORS,
  accreditationApplicationId
} from '../fixtures/in-year-change-org.js'

// RA-492: an operator with a GRANTED accreditation applies, in-year, to add
// ORSs from their registered list to it. This proves end to end what the
// backend's and frontend's unit tests cannot on their own: that RA-425's
// manage pages really offer the in-year route for an approved accreditation;
// that the summary built from the real ORS record locks what is already
// recorded and asks only for what is missing (AC01/AC02); that the charge the
// operator reviews is £328 per site across a multi-site request
// (AC03/AC04/AC10); that the declaration submits the request (AC05/AC07) and
// reaches the bank transfer payment page; and that afterwards the sites show
// as pending and cannot be added again, neither through the UI nor the API
// (AC08/AC09).
//
// Owns org 50019 (test/fixtures/in-year-change-org.js), whose current-year
// Approved Plastic accreditation is seeded by the backend's
// DevExporterAccreditationSeedService (DevSeedData__ManageExporterEnabled in
// docker/config), alongside RA-425's org 50018, which this spec leaves alone.
// ORS 001 is accredited. Its registered-only sites:
//   901910 / ORS 005 - France, complete: every lockable field recorded
//   901911 / ORS 006 - India, country only: coordinates, R code and
//                      conditions of export missing, and outside the
//                      EU/OECD, so BES evidence is required unless it meets
//                      the conditions of export
//   901912 / ORS 007 - left alone, to prove an untouched site stays addable
// Submitting is one-way (there is no reset endpoint), so the `it()` blocks
// below run in file order against the one request they build up, as
// ra-481-section-lock.e2e.js does with its org.
describe(`RA-492: add a registered ORS to a granted accreditation ${DOCKER_ONLY_TAG}`, () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  const completeSite = ORS.lyon
  const incompleteSite = ORS.delhi
  const untouchedSite = ORS.izmir
  // Set by the first beforeEach: the seeded accreditation's id, and the base
  // path of the RA-492 change-request pages it keys.
  let applicationId
  let changePath

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
    if (!applicationId) {
      const year = await readSeededYear({
        managePath: MANAGE_PATH,
        organisationName: ORGANISATION_NAME,
        material: MATERIAL
      })
      applicationId = accreditationApplicationId(year)
      changePath = `/accreditation/manage-overseas-sites/${applicationId}`
    }
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  // The way in: the operator page stands in for Re/Ex's material page, which
  // links to RA-425's manage page, whose card opens the ORS page.
  async function openManageOverseasSites() {
    await OperatorPage.open()
    await OperatorPage.navigateToInYearChangeOrg()
    await ManageRegistrationAccreditationPage.openManageOverseasSites()
    await expect(ManageOverseasSitesPage.pageHeading).toHaveText(
      'Manage overseas reprocessing sites'
    )
    expect(new URL(await browser.getUrl()).pathname).toBe(OVERSEAS_SITES_PATH)
  }

  async function waitForPath(suffix, { timeout = 30000 } = {}) {
    await waitForUrl(
      (url) => new URL(url).pathname.endsWith(suffix),
      `Did not reach ${suffix}`,
      { timeout }
    )
  }

  // Opens the incomplete site's BES upload, submits the fixture and waits for
  // the status page, which polls until the virus scan completes, to return
  // to the summary.
  async function uploadBesEvidence() {
    await AddToAccreditationPage.openRowAction('bes-evidence')
    await waitForPath(`/add/${incompleteSite.siteId}/bes-evidence`)
    await BesEvidencePage.submitUpload('business-plan.pdf')
    await waitForPath(`/add/${incompleteSite.siteId}`, { timeout: 60000 })
  }

  it('AC01/AC03/AC04: adds a complete registered ORS, with its recorded fields locked, and shows a £328 charge', async () => {
    await openManageOverseasSites()

    // RA-425's partition: only ORS 001 is on the accreditation.
    await expect(ManageOverseasSitesPage.tab('accredited')).toHaveText(
      'Accredited (1)'
    )
    await expect(ManageOverseasSitesPage.tab('registered')).toHaveText(
      'Registered (3)'
    )
    await ManageOverseasSitesPage.openTab('registered')
    for (const { siteId } of [completeSite, incompleteSite, untouchedSite]) {
      await expect(
        ManageOverseasSitesPage.addToAccreditationButton(siteId)
      ).toBeDisplayed()
    }
    // ORS 001 is already accredited, so it is not offered again.
    await expect(
      ManageOverseasSitesPage.addToAccreditationButton(ORS.hamburg.siteId)
    ).not.toExist()

    await ManageOverseasSitesPage.addToAccreditation(completeSite.siteId)
    await waitForPath(`/add/${completeSite.siteId}`)

    // "Add to accreditation: {site name} ({ORS id})" - the existing ORS id.
    await expect(AddToAccreditationPage.pageHeading).toHaveText(
      new RegExp(`^Add to accreditation: .+ \\(${completeSite.orsId}\\)$`)
    )
    await expect(AddToAccreditationPage.pageCaption).toHaveText(
      expect.stringContaining(ORGANISATION_NAME)
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
        'You currently have 1 request ready for submission.'
      )
    )
    await ManageOverseasSitesPage.viewRequests()
    await waitForPath('/requests')

    // Back to the registered tab of RA-425's page.
    await AccreditationRequestsPage.addAnotherRequest()
    const { pathname, hash } = new URL(await browser.getUrl())
    expect(pathname).toBe(OVERSEAS_SITES_PATH)
    expect(hash).toBe('#registered')

    await ManageOverseasSitesPage.openTab('registered')
    // The site already in the request is resumed, not added twice.
    await expect(
      ManageOverseasSitesPage.siteStatusTag(completeSite.siteId)
    ).toHaveText('In progress')
    await expect(
      ManageOverseasSitesPage.addToAccreditationButton(completeSite.siteId)
    ).not.toExist()
    await expect(
      ManageOverseasSitesPage.viewRequestLink(completeSite.siteId)
    ).toBeDisplayed()

    await ManageOverseasSitesPage.addToAccreditation(incompleteSite.siteId)
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

    await uploadBesEvidence()
    await expect(
      AddToAccreditationPage.rowMissingTag('bes-evidence')
    ).not.toExist()
    const fileIds = await AddToAccreditationPage.besEvidenceFileIds()
    expect(fileIds).toHaveLength(1)
    await expect(
      AddToAccreditationPage.besEvidenceFilename(fileIds[0])
    ).toHaveText(expect.stringContaining('business-plan'))

    // AC01 correction route: deleting the only file makes the evidence
    // missing again, so it has to be re-uploaded before the site can continue.
    await AddToAccreditationPage.deleteBesFile(fileIds[0])
    await waitForPath(`/add/${incompleteSite.siteId}`)
    await expect(
      AddToAccreditationPage.besEvidenceRows
    ).toBeElementsArrayOfSize(0)
    await expect(
      AddToAccreditationPage.rowMissingTag('bes-evidence')
    ).toHaveText('Missing information')
    await expect(AddToAccreditationPage.rowAction('bes-evidence')).toHaveText(
      expect.stringContaining('Add information')
    )

    await uploadBesEvidence()
    await expect(
      AddToAccreditationPage.rowMissingTag('bes-evidence')
    ).not.toExist()
    await expect(
      AddToAccreditationPage.besEvidenceRows
    ).toBeElementsArrayOfSize(1)

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
    const sitesBefore = await getOverseasSites(ORGANISATION_ID, applicationId)

    await openManageOverseasSites()
    await ManageOverseasSitesPage.viewRequests()
    await waitForPath('/requests')
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
    const changes = await getAccreditationChanges(
      ORGANISATION_ID,
      applicationId
    )
    const [request] = changes.requests
    expect(request.status).toBe('Submitted')
    expect(request.changeType).toBe('add-overseas-site')
    expect(
      request.sites.map(({ siteId, orsId }) => ({ siteId, orsId }))
    ).toEqual(expect.arrayContaining([completeSite, incompleteSite]))
    expect(request.sites).toHaveLength(2)
    expect(request.charge.totalPence).toBe(65600)

    // The approved accreditation is untouched: no new ORS record, and the
    // submitted sites are still only registered until the regulator approves.
    const sitesAfter = await getOverseasSites(ORGANISATION_ID, applicationId)
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
      expect.stringContaining(
        'You have a change pending. Your regulator is reviewing your request to add 2 overseas reprocessing sites to this accreditation. You cannot change these sites until your regulator has made a decision.'
      )
    )
    await expect(ManageOverseasSitesPage.requestsBanner).not.toExist()

    // AC08: RA-425's tabs list only what is on the accreditation as
    // accredited, so a submitted site stays on the registered tab, tagged
    // pending and no longer addable, until the regulator decides.
    await expect(ManageOverseasSitesPage.tab('accredited')).toHaveText(
      'Accredited (1)'
    )
    await expect(ManageOverseasSitesPage.tab('registered')).toHaveText(
      'Registered (3)'
    )
    await ManageOverseasSitesPage.openTab('registered')
    for (const { siteId } of [completeSite, incompleteSite]) {
      await expect(
        ManageOverseasSitesPage.siteRow('registered', siteId)
      ).toBeDisplayed()
      await expect(ManageOverseasSitesPage.siteStatusTag(siteId)).toHaveText(
        'Pending'
      )
      await expect(
        ManageOverseasSitesPage.addToAccreditationButton(siteId)
      ).not.toExist()
      await expect(
        ManageOverseasSitesPage.siteRow('accredited', siteId)
      ).not.toExist()
    }

    // A registered site outside the submitted request is still addable.
    await expect(
      ManageOverseasSitesPage.addToAccreditationButton(untouchedSite.siteId)
    ).toBeDisplayed()

    // AC09: the summary for a pending site is not reachable by URL...
    await browser.url(`${changePath}/add/${completeSite.siteId}`)
    await waitForPath(OVERSEAS_SITES_PATH)
    await expect(ManageOverseasSitesPage.pendingChangeBanner).toBeDisplayed()

    // ...and the backend refuses to add it to a new request.
    expect(
      await addSiteToChangeRequest(
        ORGANISATION_ID,
        applicationId,
        completeSite.siteId
      )
    ).toBe(409)
    // ...as it does an ORS already on the accreditation.
    expect(
      await addSiteToChangeRequest(
        ORGANISATION_ID,
        applicationId,
        ORS.hamburg.siteId
      )
    ).toBe(409)
  })
})
