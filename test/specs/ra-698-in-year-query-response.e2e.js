import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import ManageOverseasSitesPage from 'page-objects/manage-overseas-sites.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import ChangeRequestDetailPage from 'page-objects/change-request-detail.page'
import ChangeRequestResponsePage from 'page-objects/change-request-response.page'
import AddOrsSiteNamePage from 'page-objects/add-ors-site-name.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
import AddOrsRepatriatedLoadsPage from 'page-objects/add-ors-repatriated-loads.page'
import AddInterimSiteSiteNamePage from 'page-objects/add-interim-site-site-name.page'
import AddInterimSiteSiteLocationPage from 'page-objects/add-interim-site-site-location.page'
import AddInterimSiteSiteContactPage from 'page-objects/add-interim-site-site-contact.page'
import SubmitApplicationPage from 'page-objects/submit-application.page'
import { patchQueriedItem } from '../helpers/case-management.js'
import {
  DOCKER_ONLY_TAG,
  skipDockerOnlyOnDeployedEnvironment
} from '../helpers/docker-only.js'
import { resetQueriedChangeItem } from '../helpers/sandbox-mongo.js'
import { waitForUrl } from '../helpers/wait-for-url.js'
import {
  CHANGE_ITEMS,
  INTERIM,
  MANAGE_PATH,
  ORGANISATION_ID,
  ORS
} from '../fixtures/manage-exporter-org.js'
import {
  QUERY_NOTE,
  changeRequestId,
  exporterApplicationId
} from '../fixtures/change-request-seed.js'
import { seededRegistrationYear } from '../fixtures/year-suffix.js'

/**
 * RA-698: an operator answers the regulator's query on an in-year "ORS update"
 * change request item. The item is the dev seed's Queried one on org 50018's
 * Plastic exporter (Rotterdam Recycling BV, ORS 001, with two interim sites):
 *
 *   - the item's page shows the regulator's note, and a Change link (Upload,
 *     for BES evidence) on only the fields the query leaves open: the ORS name,
 *     location, contact details, arrangements for rejected or returned loads
 *     and BES evidence. Recycling operations, Basel codes and conditions of
 *     export stay read-only;
 *   - each field has its own page, which refuses invalid values, and whose
 *     location page greys out the country and coordinates;
 *   - each interim site has a Change link to its own summary page, whose name,
 *     address and contact details can change; its country and recycling
 *     operations cannot;
 *   - the BES evidence page takes new files only: it lists the files the item
 *     held when it was queried read-only and lets only a file added in response
 *     be removed;
 *   - while the query is open no ORS can be added or managed: the manage page
 *     has no link to the overseas sites page, that page has no Add to
 *     accreditation buttons, and the add-to-accreditation routes go back to the
 *     manage page. All of it returns once the item is answered;
 *   - the backend refuses a locked field with a 422 (the UI offers no way to
 *     send one, so the API is called directly);
 *   - the declaration (full name and job title) sends the response; the manage
 *     page says "Request updated" and the item becomes Updated, with no Change
 *     links and no way back into the response pages.
 *
 * Answering is one-way, and RA-697's and RA-425's read-only specs expect the
 * seeded item to be Queried, so the item is put back (helpers/sandbox-mongo.js'
 * resetQueriedChangeItem) before the first test and after the last. The tests
 * share the one item and run in file order, after RA-697's (specs run one file
 * at a time, in name order).
 *
 * Not covered here: removing a file the item held before the query, as the seed
 * gives it none (the backend's tests cover it), and the declaration's
 * resubmission reaching Case Management, which the sandbox does not have
 * (test/specs/monorepo/add-ors-to-case-management.monorepo.js).
 * Docker-only because deployed environments have no such seed and no way to
 * reset it.
 */

const ITEM = CHANGE_ITEMS.rotterdamUpdateQueried
const REQUEST_NUMBER = 8
const ORS_SITE_ID = ORS.rotterdam
const NAME = 'Rotterdam Recycling BV'
const SEEDED_NAME = `${NAME} (${ITEM.orsId})`

const LIST_PATH = `${MANAGE_PATH}/change-requests`
const OVERSEAS_SITES_PATH = `${MANAGE_PATH}/overseas-sites`

const CHANGED = {
  siteName: 'Rotterdam Recycling Europe BV',
  address: {
    addressLine1: '45 Havenstraat',
    townOrCity: 'Rotterdam',
    postcode: '3011 AB'
  },
  contact: {
    name: 'Daan de Vries',
    email: 'daan.devries@example.com',
    phone: '+31 10 123 4567'
  },
  loads: 'Rejected loads are collected by our own fleet within seven days.',
  interimSiteName: 'Calais Storage Services SARL',
  interimAddressLine1: '2 Quai Gambetta',
  interimContact: {
    name: 'Chloe Martin',
    email: 'chloe.martin@example.com',
    phone: '0123456780'
  }
}

const itemPath = (itemId, step = '') =>
  `${LIST_PATH}/${itemId}${step ? `/${step}` : ''}`

describe(`RA-698: answer a regulator's query on an in-year change request ${DOCKER_ONLY_TAG}`, () => {
  const year = seededRegistrationYear()
  const itemId = ITEM.itemId(year)
  const applicationId = exporterApplicationId(ORGANISATION_ID, year)
  const itemUrlPath = itemPath(itemId)

  const putItemBackToQueried = () =>
    resetQueriedChangeItem({
      requestId: changeRequestId(ORGANISATION_ID, year, 'a', REQUEST_NUMBER),
      siteId: ORS_SITE_ID,
      queryNote: QUERY_NOTE
    })

  before(async function () {
    skipDockerOnlyOnDeployedEnvironment(this)
    const reset = await putItemBackToQueried()
    // Without the seeded item there is nothing to answer.
    expect(reset.matched).toBe(1)
  })

  after(async () => {
    await putItemBackToQueried()
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

  async function waitForPath(path, { timeout = 60000 } = {}) {
    await waitForUrl(
      (url) => new URL(url).pathname === path,
      `Did not reach ${path}`,
      { timeout }
    )
  }

  // Opens the item's page and waits for it.
  async function openItem() {
    await ChangeRequestDetailPage.open(itemUrlPath)
    await ChangeRequestDetailPage.pageHeading.waitForDisplayed()
  }

  // Opens the item's page, follows an ORS row's Change link and waits for the
  // step's own page.
  async function openStep(rowId, step) {
    await openItem()
    await ChangeRequestDetailPage.changeRow(rowId)
    await waitForPath(itemPath(itemId, step))
  }

  async function expectSuccessBanner(text) {
    await expect(ChangeRequestDetailPage.successBanner).toHaveText(
      expect.stringContaining(text)
    )
  }

  async function expectStillOn(path) {
    expect(new URL(await browser.getUrl()).pathname).toBe(path)
  }

  it("shows the queried item with the regulator's note and Change links on only the open fields", async () => {
    await ChangeRequestsPage.open(LIST_PATH)
    await expect(ChangeRequestsPage.status(itemId)).toHaveText('QUERIED')
    await ChangeRequestsPage.openItem(itemId)
    await expectStillOn(itemUrlPath)

    const detail = ChangeRequestDetailPage
    await expect(detail.pageHeading).toHaveText(SEEDED_NAME)
    await expect(detail.statusTag).toHaveText('QUERIED')
    await expect(detail.queryRaisedBanner).toHaveText(
      expect.stringContaining(
        'A query has been raised on this application for change.'
      )
    )
    await expect(detail.queryNote).toHaveText(QUERY_NOTE)

    // Relabelled for the response.
    await expect(detail.rowLabel('site-name')).toHaveText('ORS name')
    await expect(detail.rowLabel('recycling-operation')).toHaveText(
      'Recycling operations'
    )

    // Change links on exactly the editable fields, and Upload for BES evidence;
    // none on recycling operations, Basel codes or conditions of export.
    expect(await detail.rowIdsWithActions()).toEqual([
      'site-name',
      'location',
      'contact-name',
      'contact-email',
      'contact-phone',
      'repatriated-loads',
      'bes-evidence'
    ])
    await expect(detail.rowAction('site-name')).toHaveText(
      expect.stringContaining('Change')
    )
    await expect(detail.rowAction('bes-evidence')).toHaveText(
      expect.stringContaining('Upload')
    )
    for (const locked of [
      'recycling-operation',
      'basel-codes',
      'conditions-of-export'
    ]) {
      await expect(detail.rowAction(locked)).not.toBeExisting()
    }

    // Each of the ORS's current interim sites has a Change link; the removed
    // one is not listed.
    await expect(detail.interimChangeLinks).toBeElementsArrayOfSize(2)
    await expect(detail.interimChangeLink(INTERIM.calais)).toBeDisplayed()
    await expect(
      detail.interimChangeLink(INTERIM.antwerpForRotterdam)
    ).toBeDisplayed()
    await expect(detail.interimChangeLink(INTERIM.oldDepot)).not.toBeExisting()

    await expect(detail.saveAndContinueButton).toBeDisplayed()
    await expect(detail.cancelLink).toBeDisplayed()
  })

  it('hides Add ORS and Manage ORS while the query is open', async () => {
    await ManageRegistrationAccreditationPage.open(MANAGE_PATH)
    await ManageRegistrationAccreditationPage.pageHeading.waitForDisplayed()
    // The card stays; its link to the overseas sites page goes.
    await expect(
      ManageRegistrationAccreditationPage.manageOverseasSitesCard
    ).toBeDisplayed()
    await expect(
      ManageRegistrationAccreditationPage.manageOverseasSitesLink
    ).not.toBeExisting()

    // The page itself still opens, but nothing on it adds an ORS.
    await ManageOverseasSitesPage.open(OVERSEAS_SITES_PATH)
    await ManageOverseasSitesPage.pageHeading.waitForDisplayed()
    await expect(
      ManageOverseasSitesPage.anyAddToAccreditationButton
    ).not.toBeExisting()

    // And the add-to-accreditation pages send the operator back to the manage
    // page.
    await ManageOverseasSitesPage.open(
      `/accreditation/manage-overseas-sites/${applicationId}/requests`
    )
    await waitForPath(MANAGE_PATH)
  })

  it('cancels a change without saving it', async () => {
    await openStep('site-name', 'site-name')
    await expect(AddOrsSiteNamePage.siteNameInput).toHaveValue(NAME)
    await AddOrsSiteNamePage.enterSiteName('Not saved BV')
    await AddOrsSiteNamePage.clickAndWaitForNextPage(
      AddOrsSiteNamePage.cancelLink
    )

    await expectStillOn(itemUrlPath)
    await expect(ChangeRequestDetailPage.rowValue('site-name')).toHaveText(NAME)
    await expect(ChangeRequestDetailPage.successBanner).not.toBeExisting()
  })

  it('refuses a blank ORS name', async () => {
    await openStep('site-name', 'site-name')
    await AddOrsSiteNamePage.siteNameInput.setValue('')
    await AddOrsSiteNamePage.continue()

    await expect(AddOrsSiteNamePage.errorSummary).toBeDisplayed()
    await expectStillOn(itemPath(itemId, 'site-name'))
  })

  it('refuses a location without a first address line', async () => {
    await openStep('location', 'location')
    await ChangeRequestResponsePage.addressLine1Input.setValue('')
    await ChangeRequestResponsePage.continue()

    await expect(ChangeRequestResponsePage.errorSummary).toBeDisplayed()
    await expectStillOn(itemPath(itemId, 'location'))
  })

  it('refuses contact details without a name or with an invalid email', async () => {
    await openStep('contact-name', 'contact-details')
    await AddOrsSiteContactPage.enterContactDetails({
      name: '',
      email: 'not-an-email',
      phone: CHANGED.contact.phone
    })
    await AddOrsSiteContactPage.continue()

    await expect(AddOrsSiteContactPage.errorSummary).toBeDisplayed()
    await expectStillOn(itemPath(itemId, 'contact-details'))
  })

  it('refuses arrangements for rejected or returned loads over 500 words', async () => {
    await openStep('repatriated-loads', 'rejected-loads')
    await AddOrsRepatriatedLoadsPage.enterDescription('word '.repeat(501))
    await AddOrsRepatriatedLoadsPage.continue()

    await expect(AddOrsRepatriatedLoadsPage.errorSummary).toBeDisplayed()
    await expect(AddOrsRepatriatedLoadsPage.fieldError).toBeDisplayed()
    await expectStillOn(itemPath(itemId, 'rejected-loads'))
  })

  it('refuses an upload with no file', async () => {
    await openStep('bes-evidence', 'bes-evidence')
    await ChangeRequestResponsePage.attemptEmptyUpload()

    await expect(ChangeRequestResponsePage.fileError).toBeDisplayed()
    await expectStillOn(itemPath(itemId, 'bes-evidence'))
  })

  it("refuses an interim site's blank name and invalid contact details", async () => {
    await openItem()
    await ChangeRequestDetailPage.changeInterimSite(INTERIM.calais)
    const interimPath = itemPath(itemId, `interim-sites/${INTERIM.calais}`)
    await waitForPath(interimPath)

    await ChangeRequestDetailPage.changeInterimRow('site-name')
    await waitForPath(`${interimPath}/site-name`)
    await AddInterimSiteSiteNamePage.siteNameInput.setValue('')
    await AddInterimSiteSiteNamePage.continue()
    await expect(AddInterimSiteSiteNamePage.errorSummary).toBeDisplayed()
    await expectStillOn(`${interimPath}/site-name`)

    await ChangeRequestDetailPage.open(`${interimPath}/contact-details`)
    await AddInterimSiteSiteContactPage.enterContactDetails({
      name: CHANGED.interimContact.name,
      email: 'not-an-email',
      phone: CHANGED.interimContact.phone
    })
    await AddInterimSiteSiteContactPage.continue()
    await expect(AddInterimSiteSiteContactPage.errorSummary).toBeDisplayed()
    await expectStillOn(`${interimPath}/contact-details`)
  })

  it('saved none of the refused changes', async () => {
    await openItem()
    await expect(ChangeRequestDetailPage.rowValue('site-name')).toHaveText(NAME)
    await expect(ChangeRequestDetailPage.successBanner).not.toBeExisting()
  })

  it('changes the ORS name', async () => {
    await openStep('site-name', 'site-name')
    await AddOrsSiteNamePage.enterSiteName(CHANGED.siteName)
    await AddOrsSiteNamePage.continue()
    await waitForPath(itemUrlPath)

    await expectSuccessBanner('ORS name updated')
    await expect(ChangeRequestDetailPage.rowValue('site-name')).toHaveText(
      CHANGED.siteName
    )
  })

  it("changes the location's address, with the country and coordinates greyed out", async () => {
    await openStep('location', 'location')

    const page = ChangeRequestResponsePage
    // The address is open ...
    await expect(page.addressLine1Input).toBeEnabled()
    await expect(page.townOrCityInput).toBeEnabled()
    await expect(page.postcodeInput).toBeEnabled()
    // ... and the country and coordinates are shown, greyed out and disabled.
    await expect(page.lockedCountry).toBeDisplayed()
    await expect(page.lockedCountry).toBeDisabled()
    await expect(page.lockedCountry).toHaveValue('Netherlands')
    await expect(page.lockedCoordinates).toBeDisplayed()
    await expect(page.lockedCoordinates).toBeDisabled()

    await page.changeAddress(CHANGED.address)
    await page.continue()
    await waitForPath(itemUrlPath)

    await expectSuccessBanner('Location updated')
    await expect(ChangeRequestDetailPage.rowValue('location')).toHaveText(
      expect.stringContaining(CHANGED.address.addressLine1)
    )
    // The country stays as it was.
    await expect(ChangeRequestDetailPage.rowValue('location')).toHaveText(
      expect.stringContaining('Netherlands')
    )
  })

  it("changes the contact's name, email and phone number from any of their rows", async () => {
    await openItem()
    // One page changes all three, so each row's link goes to it.
    for (const row of ['contact-name', 'contact-email', 'contact-phone']) {
      await expect(ChangeRequestDetailPage.rowAction(row)).toHaveAttribute(
        'href',
        expect.stringContaining(`${itemUrlPath}/contact-details`)
      )
    }

    await ChangeRequestDetailPage.changeRow('contact-email')
    await waitForPath(itemPath(itemId, 'contact-details'))
    await AddOrsSiteContactPage.enterContactDetails(CHANGED.contact)
    await AddOrsSiteContactPage.continue()
    await waitForPath(itemUrlPath)

    await expectSuccessBanner('Contact name updated')
    await expect(ChangeRequestDetailPage.rowValue('contact-name')).toHaveText(
      CHANGED.contact.name
    )
    await expect(ChangeRequestDetailPage.rowValue('contact-email')).toHaveText(
      CHANGED.contact.email
    )
    await expect(ChangeRequestDetailPage.rowValue('contact-phone')).toHaveText(
      CHANGED.contact.phone
    )
  })

  it('changes the arrangements for rejected or returned loads', async () => {
    await openStep('repatriated-loads', 'rejected-loads')
    await AddOrsRepatriatedLoadsPage.enterDescription(CHANGED.loads)
    await AddOrsRepatriatedLoadsPage.continue()
    await waitForPath(itemUrlPath)

    await expectSuccessBanner(
      'Arrangements for rejected or returned loads updated'
    )
    await expect(
      ChangeRequestDetailPage.rowValue('repatriated-loads')
    ).toHaveText(CHANGED.loads)
  })

  it("changes an interim site's name, address and contact details from its Change link, with its country and recycling operations locked", async () => {
    await openItem()
    await ChangeRequestDetailPage.changeInterimSite(INTERIM.calais)
    const interimPath = itemPath(itemId, `interim-sites/${INTERIM.calais}`)
    await waitForPath(interimPath)

    const detail = ChangeRequestDetailPage
    await expect(detail.pageHeading).toHaveText('Calais Storage SARL')
    await expect(detail.interimSiteSummary).toBeDisplayed()
    // Country and recycling operations are shown with no Change link ...
    await expect(detail.rowValue('country')).toHaveText('France')
    await expect(detail.rowValue('operation-codes')).toHaveText('R13')
    await expect(detail.interimRowChange('country')).not.toBeExisting()
    await expect(detail.interimRowChange('operation-codes')).not.toBeExisting()
    // ... and everything else has one.
    await expect(detail.interimChangeActions).toBeElementsArrayOfSize(5)

    // Name.
    await detail.changeInterimRow('site-name')
    await waitForPath(`${interimPath}/site-name`)
    await AddInterimSiteSiteNamePage.enterSiteName(CHANGED.interimSiteName)
    await AddInterimSiteSiteNamePage.continue()
    await waitForPath(interimPath)
    await expectSuccessBanner('updated')
    await expect(detail.rowValue('site-name')).toHaveText(
      CHANGED.interimSiteName
    )
    await expect(detail.pageHeading).toHaveText(CHANGED.interimSiteName)

    // Address.
    await detail.changeInterimRow('location')
    await waitForPath(`${interimPath}/location`)
    await AddInterimSiteSiteLocationPage.enterLocation({
      addressLine1: CHANGED.interimAddressLine1,
      townOrCity: 'Calais'
    })
    await AddInterimSiteSiteLocationPage.continue()
    await waitForPath(interimPath)
    await expectSuccessBanner('Location updated')
    await expect(detail.rowValue('location')).toHaveText(
      expect.stringContaining(CHANGED.interimAddressLine1)
    )

    // Contact details.
    await detail.changeInterimRow('contact-name')
    await waitForPath(`${interimPath}/contact-details`)
    await AddInterimSiteSiteContactPage.enterContactDetails(
      CHANGED.interimContact
    )
    await AddInterimSiteSiteContactPage.continue()
    await waitForPath(interimPath)
    await expectSuccessBanner('Contact name updated')
    await expect(detail.rowValue('contact-name')).toHaveText(
      CHANGED.interimContact.name
    )
    await expect(detail.rowValue('contact-email')).toHaveText(
      CHANGED.interimContact.email
    )
    await expect(detail.rowValue('contact-phone')).toHaveText(
      CHANGED.interimContact.phone
    )

    // Continue goes back to the ORS.
    await detail.continueToOrs()
    await waitForPath(itemUrlPath)
  })

  it('takes BES evidence by upload only: a new file can be added and removed', async () => {
    await openItem()
    await expect(ChangeRequestDetailPage.rowValue('bes-evidence')).toHaveText(
      'Not provided'
    )
    await ChangeRequestDetailPage.changeRow('bes-evidence')
    await waitForPath(itemPath(itemId, 'bes-evidence'))

    const page = ChangeRequestResponsePage
    // The seeded item held no evidence when it was queried.
    await expect(page.existingFiles).not.toBeExisting()
    await expect(page.noNewFiles).toBeDisplayed()

    // Upload, then the status page's poll returns to the item's page.
    await page.submitUpload('business-plan.pdf')
    await waitForPath(itemUrlPath)
    await expectSuccessBanner(
      'Evidence of broadly equivalent standards updated'
    )
    await expect(ChangeRequestDetailPage.rowValue('bes-evidence')).toHaveText(
      expect.stringContaining('business-plan')
    )

    // The file is listed as one of the new files, with a Remove button.
    await ChangeRequestDetailPage.changeRow('bes-evidence')
    await waitForPath(itemPath(itemId, 'bes-evidence'))
    await expect(page.newFileRows).toBeElementsArrayOfSize(1)
    await expect(page.removeButtons).toBeElementsArrayOfSize(1)
    const [removeButton] = await page.removeButtons
    await page.clickAndWaitForNextPage(removeButton)
    await expect(page.noNewFiles).toBeDisplayed()

    // Add one again, so the response has evidence to send.
    await page.submitUpload('business-plan.pdf')
    await waitForPath(itemUrlPath)
    await expect(ChangeRequestDetailPage.rowValue('bes-evidence')).toHaveText(
      expect.stringContaining('business-plan')
    )
  })

  it('refuses a locked field server-side: the country, coordinates and recycling operations', async () => {
    const answers = (body, options) =>
      patchQueriedItem(ORGANISATION_ID, applicationId, itemId, body, options)

    for (const body of [
      { country: 'Germany' },
      { coordinates: '52.3676, 4.9041' },
      { operationCodes: ['R4'] },
      { baselCodes: ['B1010'] },
      { conditionsOfExport: true }
    ]) {
      expect((await answers(body)).statusCode).toBe(422)
    }

    // An interim site's country and recycling operations are locked too, and
    // only an active interim site of the queried ORS can be answered.
    for (const body of [{ country: 'Belgium' }, { operationCodes: ['R4'] }]) {
      expect(
        (await answers(body, { interimSiteId: INTERIM.calais })).statusCode
      ).toBe(422)
    }
    const removedInterimSite = await answers(
      { siteName: 'Removed depot' },
      { interimSiteId: INTERIM.oldDepot }
    )
    expect(removedInterimSite.statusCode).toBe(422)
  })

  it('sends the response through the declaration, which asks for a full name and job title', async () => {
    await openItem()
    await ChangeRequestDetailPage.saveAndContinue()
    await waitForPath(itemPath(itemId, 'declaration'))

    // Nothing entered.
    await SubmitApplicationPage.confirmAndSubmit()
    await expect(SubmitApplicationPage.errorSummary).toBeDisplayed()
    await expect(SubmitApplicationPage.fullNameError).toBeDisplayed()
    await expect(SubmitApplicationPage.jobTitleError).toBeDisplayed()
    await expectStillOn(itemPath(itemId, 'declaration'))

    await SubmitApplicationPage.submitApplication()
    await waitForPath(MANAGE_PATH)

    // The manage page says so, and the overseas sites link is back: nothing is
    // queried any more.
    const managePage = ManageRegistrationAccreditationPage
    await expect(managePage.successBanner).toHaveText(
      expect.stringContaining('Request updated')
    )
    await expect(managePage.manageOverseasSitesLink).toBeDisplayed()
  })

  it('shows the item as Updated, with no way to change it', async () => {
    await ChangeRequestsPage.open(LIST_PATH)
    await expect(ChangeRequestsPage.status(itemId)).toHaveText('UPDATED')
    await ChangeRequestsPage.openItem(itemId)

    const detail = ChangeRequestDetailPage
    await expect(detail.statusTag).toHaveText('UPDATED')
    await expect(detail.queryRaisedBanner).not.toBeExisting()
    // What the operator answered is what the page shows now.
    await expect(detail.rowValue('site-name')).toHaveText(CHANGED.siteName)
    await expect(detail.rowValue('contact-name')).toHaveText(
      CHANGED.contact.name
    )

    // No Change or Upload links, and no Change links on the interim sites.
    expect(await detail.rowIdsWithActions()).toEqual([])
    await expect(detail.interimChangeLinks).toBeElementsArrayOfSize(0)
    await expect(detail.saveAndContinueButton).not.toBeExisting()

    // The response pages go back to the item, and the backend refuses a change.
    for (const step of [
      'site-name',
      'location',
      'bes-evidence',
      'declaration'
    ]) {
      await ChangeRequestDetailPage.open(itemPath(itemId, step))
      await waitForPath(itemUrlPath)
    }
    await ChangeRequestDetailPage.open(
      itemPath(itemId, `interim-sites/${INTERIM.calais}`)
    )
    await waitForPath(itemUrlPath)

    const refused = await patchQueriedItem(
      ORGANISATION_ID,
      applicationId,
      itemId,
      { siteName: 'Too late' }
    )
    expect(refused.statusCode).toBe(409)
  })
})
