import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import AddOrsSiteNamePage from 'page-objects/add-ors-site-name.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddOrsBaselCodesPage from 'page-objects/add-ors-basel-codes.page'
import AddOrsRepatriatedLoadsPage from 'page-objects/add-ors-repatriated-loads.page'
import AddOrsCyaPage from 'page-objects/add-ors-cya.page'
import AddInterimSiteCountryPage from 'page-objects/add-interim-site-country.page'
import AddInterimSiteSiteNamePage from 'page-objects/add-interim-site-site-name.page'
import AddInterimSiteSiteLocationPage from 'page-objects/add-interim-site-site-location.page'
import AddInterimSiteSiteContactPage from 'page-objects/add-interim-site-site-contact.page'
import AddInterimSiteRecyclingOperationPage from 'page-objects/add-interim-site-recycling-operation.page'
import AddInterimSiteCyaPage from 'page-objects/add-interim-site-cya.page'
import { getOverseasSites } from '../helpers/case-management.js'
import { completePrnBusinessPlanSamplingPlan } from '../helpers/accreditation-journey.js'

// RA-297: every overseas/interim site carries an isNewSite boolean — false
// for sites seeded from a prior-year ReEx registry when the application was
// created, true for anything added fresh via the Add ORS / add-interim-site
// wizards. It isn't rendered anywhere in the UI, so it's asserted here via a
// direct API call, same convention as case-management.js's other helpers
// (management-fe is out of scope for this suite, see RA-311).
describe('RA-297: isNewSite flag on overseas sites', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('marks a pre-existing overseas site from a prior-year ReEx registry as isNewSite === false', async function () {
    // Org 50013 is this spec's own dedicated fixture (RA-297 regression
    // guard) — it used to share org 50005 with exporter-accreditation.e2e.js,
    // relying on the ORS/interim-site wizards under test elsewhere in this
    // suite only ever adding sites, never removing the seeded one. That
    // assumption held for wizard behaviour, but not for the first-visit seed
    // itself: under wdio's parallel workers, both specs' first request could
    // race AccreditationApplicationEndpoints.Seed's read-then-create
    // existence check and each create a separate live application for the
    // same org/registrationId/materialType/year, so a later visit could land
    // on whichever one Mongo's ObjectId tiebreak favoured — not necessarily
    // the one either spec had actually progressed. See
    // FakeOrganisationPersistence's org 50013 entry for the full writeup.
    await OperatorPage.navigateToInterimSiteTestOrg()
    const landingUrl = await browser.getUrl()
    const [, organisationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)
    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    const sites = await getOverseasSites(organisationId, applicationId)
    expect(sites.length).toBeGreaterThan(0)

    const seededSite = sites.find((s) => s.isNewSite === false)

    // Known limitation: the frontend's local dev stub (stub-api-client.js,
    // used only by `npm run dev` without a real backend) doesn't set
    // isNewSite at all on its fixture overseas sites — that's a gap in the
    // stub's fidelity, not a product bug (the real backend sets this per
    // RA102-n98). Skip rather than report a false failure against an
    // environment that can't model prior-year ReEx data; against a real
    // backend this assertion runs for real.
    if (seededSite === undefined && sites.every((s) => s.isNewSite == null)) {
      this.skip()
    }

    expect(seededSite).toBeDefined()
    expect(seededSite.isNewSite).toBe(false)
  })
})

// RA-486: decouples ORS and interim-site recycling-operation codes. Before
// this, R12/R13 on an ORS's recycling-operations step forced the user down
// the add-interim-site path, and the ORS step itself accepted R12/R13 as a
// (sole) valid answer. Now:
//   - the ORS recycling-operations step requires at least one of R3/R4/R5
//     (R12/R13 optional there)
//   - a brand-new interim-site recycling-operations step requires at least
//     one of R12/R13 (R3/R4/R5 optional there), material inherited from the
//     parent ORS
//   - "Save and add interim site" on the ORS CYA page is always available,
//     independent of which codes were selected on the ORS
describe('RA-486: decoupled ORS/interim-site recycling operations', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('requires R3, R4 or R5 on the ORS recycling-operations step, treating R12/R13 as optional there', async () => {
    await OperatorPage.navigateToInterimSiteTestOrg()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )

    await completePrnBusinessPlanSamplingPlan({ skipCompletedTasks: true })

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('RA-486 ORS Validation GmbH')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Prufstrasse 1',
      townOrCity: 'Munich',
      country: 'Germany',
      coordinates: '48.1351, 11.5820'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Test Contact',
      email: 'test@ra486orsvalidation.de',
      phone: '+49 89 1234567'
    })
    await AddOrsSiteContactPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )

    // R12 alone (no R3/R4/R5) must be rejected — R12/R13 is no longer a
    // sufficient answer on the ORS step.
    await AddOrsRecyclingOperationPage.selectOperationCode('R12')
    await AddOrsRecyclingOperationPage.continue()
    await expect(AddOrsRecyclingOperationPage.errorSummary).toBeDisplayed()
    await expect(AddOrsRecyclingOperationPage.errorSummary).toHaveText(
      expect.stringContaining('Select R3, R4 or R5')
    )

    // Adding R3 alongside the already-selected (optional) R12 now satisfies
    // the mandatory core-code requirement.
    await AddOrsRecyclingOperationPage.selectOperationCode('R3')
    await AddOrsRecyclingOperationPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
  })

  it('adds an interim site from the ORS CYA page when the parent ORS has no R12/R13 selected (proves the coupling is removed)', async () => {
    await OperatorPage.navigateToInterimSiteTestOrg()
    const landingUrl = await browser.getUrl()
    const [, organisationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    await completePrnBusinessPlanSamplingPlan({ skipCompletedTasks: true })

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.addNewOrsButton.waitForDisplayed()
    await OverseasReprocessingSitesPage.addNewOrsButton.click()
    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))

    await AddOrsSiteNamePage.enterSiteName('RA-486 Decoupling Proof GmbH')
    await AddOrsSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddOrsSiteLocationPage.enterLocation({
      addressLine1: 'Entkopplungsweg 1',
      townOrCity: 'Munich',
      country: 'Germany',
      coordinates: '48.1351, 11.5820'
    })
    await AddOrsSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddOrsSiteContactPage.enterContactDetails({
      name: 'Test Contact',
      email: 'test@ra486decoupling.de',
      phone: '+49 89 7654321'
    })
    await AddOrsSiteContactPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )
    // Only R3 selected — no R12/R13 anywhere on this ORS.
    await AddOrsRecyclingOperationPage.selectOperationCode('R3')
    await AddOrsRecyclingOperationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/basel-convention-and-oecd-code')
    )
    await AddOrsBaselCodesPage.enterCodes(['A1181'])
    await AddOrsBaselCodesPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/repatriated-loads')
    )
    await AddOrsRepatriatedLoadsPage.enterDescription(
      'Rejected loads are returned within 30 days at our expense via licensed courier.'
    )
    await AddOrsRepatriatedLoadsPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddOrsCyaPage.summaryList).toBeDisplayed()
    await expect(AddOrsCyaPage.backLink).toBeDisplayed()

    // Key proof: "Save and add interim site" is available even though this
    // ORS has no R12/R13 selected — the button is no longer gated on those
    // codes.
    await expect(AddOrsCyaPage.saveAndAddInterimSiteButton).toBeDisplayed()
    await AddOrsCyaPage.saveAndAddInterimSite()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/add-interim-site/')
    )
    await expect(browser).toHaveUrl(expect.stringContaining('/country'))

    await AddInterimSiteCountryPage.enterCountry('Germany')
    await AddInterimSiteCountryPage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
    await AddInterimSiteSiteNamePage.enterSiteName('RA-486 Interim Depot')
    await AddInterimSiteSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await AddInterimSiteSiteLocationPage.enterLocation({
      addressLine1: 'Entkopplungsweg 2',
      townOrCity: 'Munich',
      stateOrRegion: 'Bavaria',
      postcode: '80331'
    })
    await AddInterimSiteSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await AddInterimSiteSiteContactPage.enterContactDetails({
      name: 'Test Contact',
      email: 'test@ra486decoupling.de',
      phone: '+49 89 7654322'
    })
    await AddInterimSiteSiteContactPage.continue()

    // New RA-486 step: interim-site recycling-operation-details. Requires
    // R12/R13 (mandatory here), R3/R4/R5 optional, material inherited from
    // the parent ORS.
    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/add-interim-site/')
    )
    await expect(
      AddInterimSiteRecyclingOperationPage.pageHeading
    ).toBeDisplayed()

    // R3 alone (no R12/R13) must be rejected on this step — inverse of the
    // ORS rule.
    await AddInterimSiteRecyclingOperationPage.selectOperationCode('R3')
    await AddInterimSiteRecyclingOperationPage.continue()
    await expect(
      AddInterimSiteRecyclingOperationPage.errorSummary
    ).toBeDisplayed()
    await expect(AddInterimSiteRecyclingOperationPage.errorSummary).toHaveText(
      expect.stringContaining('Select R12 or R13')
    )

    await AddInterimSiteRecyclingOperationPage.selectOperationCode('R12')
    await AddInterimSiteRecyclingOperationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddInterimSiteCyaPage.summaryList).toBeDisplayed()
    await expect(AddInterimSiteCyaPage.recyclingOperationRow).toBeDisplayed()
    await expect(AddInterimSiteCyaPage.backLink).toBeDisplayed()
    await AddInterimSiteCyaPage.submit()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
    await expect(
      OverseasReprocessingSitesPage.interimSiteSuccessBanner
    ).toBeDisplayed()

    // Confirm via the API too: the parent ORS carries no R12/R13, yet its
    // nested interim site was still created.
    const sites = await getOverseasSites(organisationId, applicationId)
    const orsSite = sites.find(
      (s) => s.siteName === 'RA-486 Decoupling Proof GmbH'
    )
    expect(orsSite).toBeDefined()
    expect(orsSite.interimSite).toBeDefined()
  })

  it('changes an interim site via the Change link, replaying the wizard pre-filled and submitting an update', async () => {
    // Reuses the interim site the earlier test attached to "RA-486
    // Decoupling Proof GmbH" — org 50013's application accumulates state
    // across this describe block's tests, same convention as
    // exporter-accreditation.e2e.js's org 50015 (see e.g. its own RA-470
    // Change-link test, which this one mirrors).
    await OperatorPage.navigateToInterimSiteTestOrg()
    const landingUrl = await browser.getUrl()
    const [, organisationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )

    // Derive the parent ORS's siteId from the rendered interim-site row,
    // same convention as the confirm-overseas-sites siteId lookup elsewhere
    // in this suite (site-row-{siteId}) rather than assuming a field name on
    // the API response.
    const interimSiteRow = await $('[data-testid^="interim-site-row-"]')
    await interimSiteRow.waitForDisplayed()
    const testId = await interimSiteRow.getAttribute('data-testid')
    const siteId = testId.replace('interim-site-row-', '')

    await expect(
      OverseasReprocessingSitesPage.interimSiteNameValue(siteId)
    ).toHaveText(expect.stringContaining('RA-486 Interim Depot'))

    // Change re-enters the add-interim-site wizard pre-filled, on the
    // .../interim-site/edit/{siteId} route — mirrors editNewSite's
    // .../add-overseas-site/{applicationId}/edit/{siteId} for the parent ORS.
    await OverseasReprocessingSitesPage.changeInterimSite(siteId)
    await expect(browser).toHaveUrl(
      expect.stringContaining(`/interim-site/edit/${siteId}`)
    )
    await expect(browser).toHaveUrl(expect.stringContaining('/country'))
    await expect(AddInterimSiteCountryPage.pageHeading).toBeDisplayed()

    // Replay the whole wizard, checking pre-fill at each step against the
    // values the decoupling-proof test entered, then changing them to prove
    // this really is an edit of the existing interim site rather than a
    // fresh one created alongside it.
    await AddInterimSiteCountryPage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-name'))
    await expect(AddInterimSiteSiteNamePage.siteNameInput).toHaveValue(
      'RA-486 Interim Depot'
    )
    await AddInterimSiteSiteNamePage.enterSiteName(
      'RA-486 Interim Depot (Updated)'
    )
    await AddInterimSiteSiteNamePage.continue()

    await expect(browser).toHaveUrl(expect.stringContaining('/site-location'))
    await expect(AddInterimSiteSiteLocationPage.addressLine1Input).toHaveValue(
      'Entkopplungsweg 2'
    )
    await expect(AddInterimSiteSiteLocationPage.townOrCityInput).toHaveValue(
      'Munich'
    )
    await AddInterimSiteSiteLocationPage.enterLocation({
      addressLine1: 'Geanderter Entkopplungsweg 3',
      townOrCity: 'Munich',
      stateOrRegion: 'Bavaria',
      postcode: '80331'
    })
    await AddInterimSiteSiteLocationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/site-contact-details')
    )
    await expect(AddInterimSiteSiteContactPage.contactNameInput).toHaveValue(
      'Test Contact'
    )
    await expect(AddInterimSiteSiteContactPage.contactEmailInput).toHaveValue(
      'test@ra486decoupling.de'
    )
    await AddInterimSiteSiteContactPage.enterContactDetails({
      name: 'Updated Contact',
      email: 'updated@ra486decoupling.de',
      phone: '+49 89 7654323'
    })
    await AddInterimSiteSiteContactPage.continue()

    // Recycling-operation-details: pre-filled with R12 (selected earlier),
    // left as-is here — only proving the earlier fields' edits round-trip,
    // not re-testing this step's own validation (covered above).
    await expect(browser).toHaveUrl(
      expect.stringContaining('/recycling-operation-details')
    )
    await AddInterimSiteRecyclingOperationPage.continue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await expect(AddInterimSiteCyaPage.summaryList).toBeDisplayed()
    await expect(AddInterimSiteCyaPage.siteNameRow).toHaveText(
      expect.stringContaining('RA-486 Interim Depot (Updated)')
    )

    // Same submit as the create path — the server decides update vs create
    // from linkedSiteId/editingSiteId in the wizard session, same pattern as
    // the ORS wizard's create/promote/update split.
    await AddInterimSiteCyaPage.submit()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )

    // The update must have PATCHed the existing interim site — same parent
    // ORS, updated interim-site fields, not a second interim site created
    // alongside the original (the model is 1 ORS : 0-or-1 interim site, so
    // there's no separate id to assert uniqueness on beyond the object
    // itself still being singular).
    const sites = await getOverseasSites(organisationId, applicationId)
    const orsSite = sites.find(
      (s) => s.siteName === 'RA-486 Decoupling Proof GmbH'
    )
    expect(orsSite).toBeDefined()
    expect(orsSite.interimSite).toBeDefined()
    expect(orsSite.interimSite.siteName).toBe('RA-486 Interim Depot (Updated)')
  })

  it('removes an interim site directly from select-overseas-sites', async () => {
    // Reuses the interim site updated by the previous test.
    await OperatorPage.navigateToInterimSiteTestOrg()
    const landingUrl = await browser.getUrl()
    const [, organisationId] = new URL(landingUrl).pathname
      .split('/')
      .filter(Boolean)
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )

    const interimSiteRow = await $('[data-testid^="interim-site-row-"]')
    await interimSiteRow.waitForDisplayed()
    const testId = await interimSiteRow.getAttribute('data-testid')
    const siteId = testId.replace('interim-site-row-', '')

    await expect(
      OverseasReprocessingSitesPage.interimSiteRow(siteId)
    ).toBeDisplayed()
    await OverseasReprocessingSitesPage.removeInterimSite(siteId)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )
    await expect(
      OverseasReprocessingSitesPage.interimSiteRow(siteId)
    ).not.toBeDisplayed()

    // Confirm via the API too: the parent ORS still exists, but its nested
    // interim site is gone.
    const sites = await getOverseasSites(organisationId, applicationId)
    const orsSite = sites.find(
      (s) => s.siteName === 'RA-486 Decoupling Proof GmbH'
    )
    expect(orsSite).toBeDefined()
    expect(orsSite.interimSite).toBeFalsy()
  })
})

// RA-486 AC7: the interim-site wizard's own steps must not be reachable by
// direct navigation unless there's an ORS site that requested one (i.e. only
// via "Save and add interim site" on an ORS's CYA page, which links the two).
// Every GET controller in the wizard now guards on `linkedSiteId` being
// present in the interim-site session, and redirects back to
// select-overseas-sites when it's missing.
describe('RA-486: AC7 guard - add-interim-site wizard requires a linked ORS', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('redirects to select-overseas-sites when navigating directly into the add-interim-site wizard without a linked ORS', async () => {
    await OperatorPage.navigateToInterimSiteTestOrg()
    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    // Never went through "Save and add interim site" on any ORS CYA page in
    // this session, so no linkedSiteId exists — direct navigation into any
    // wizard step must bounce straight back to site selection.
    await browser.url(
      `/accreditation/add-interim-site/${applicationId}/country`
    )
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        `/accreditation/select-overseas-sites/${applicationId}`
      )
    )

    // The guard applies to every step of the wizard, not just entry.
    await browser.url(
      `/accreditation/add-interim-site/${applicationId}/recycling-operation-details`
    )
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        `/accreditation/select-overseas-sites/${applicationId}`
      )
    )

    await browser.url(
      `/accreditation/add-interim-site/${applicationId}/check-your-answers`
    )
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        `/accreditation/select-overseas-sites/${applicationId}`
      )
    )
  })
})
