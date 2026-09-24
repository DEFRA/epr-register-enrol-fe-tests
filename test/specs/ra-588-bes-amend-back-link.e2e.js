import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import TaskListPage from 'page-objects/tasklist.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import ConfirmOverseasSitesPage from 'page-objects/confirm-overseas-sites.page'
import BesEvidencePage from 'page-objects/bes-evidence.page'
import { getOverseasSites } from '../helpers/case-management.js'

// RA-588: "Amend BES back button does not work as expected - takes to the
// upload screens". (The Jira title's "CM:" prefix is a mis-tag - every URL in
// the report is an Operator Journey route, so the coverage belongs here and
// not in epr-register-enrol-mgmt-tests.)
//
// The reported journey, and the broken back-link chain behind it:
//
//   site list  /accreditation/upload-evidence-for-overseas-site/{appId}
//     -> Amend Evidence
//   CYA        /accreditation/cya-evidence-for-overseas-site/{appId}/{siteId}
//     -> back  landed on /accreditation/upload-more-evidence/{appId}/{siteId}
//     -> back  landed on /accreditation/upload-bes-evidence/{appId}/{siteId}
//
// i.e. the operator was walked forwards into the raw upload-file screen by
// pressing back twice. The root cause is one line in the OJ frontend's CYA
// controller, whose `backLink` was the upload-more-evidence URL rather than
// the site list; upload-more-evidence's own back link then legitimately
// points at the upload form, which is what produced the second hop. Fixing
// the CYA controller's target fixes both hops at once, so this spec asserts
// the whole two-hop chain rather than just the first step.
//
// Why an e2e spec and not just the controller's unit test: the unit test can
// only prove what string the controller puts in the view model. It cannot
// prove that the value is a route that actually exists, that the layout
// renders it as a real href, or - the part that actually bit the user - what
// the NEXT screen's back link then does. Only walking the chain in a browser
// covers that.
//
// This spec deliberately stops short of submitting. The bug is reachable from
// a plain editable draft, because the site list's action link switches to the
// CYA review screen as soon as a site has uploads (`hasUploads` in
// upload-evidence-for-overseas-site/controller.js) - it is not gated on the
// application being queried. So there is no need to repeat RA-570's much more
// expensive submit-then-query setup, and the second hop is asserted against
// the ordinary task list rather than the query task list.
//
// Org 50006 (Glass exporter) is shared with exporter-accreditation.e2e.js,
// ra-570-amend-bes-evidence.e2e.js and ra-583-bes-status-after-resubmit.e2e.js,
// so - exactly as those two specs do - this drives it on a disposable,
// run-unique year, which makes the landing controller seed a brand new draft
// instead of landing on another spec's application. See operator.page.js's
// org-50013 comment for the underlying Seed race that avoids.
describe('RA-588: back navigation out of the amend-BES evidence screen', () => {
  let organisationId
  let registrationId
  let materialType
  let year
  let applicationId

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

  function evidenceListUrl() {
    return `/accreditation/upload-evidence-for-overseas-site/${applicationId}`
  }

  function reviewUrl(siteId) {
    return `/accreditation/cya-evidence-for-overseas-site/${applicationId}/${siteId}`
  }

  function taskListUrl() {
    return `/accreditation/task-list/${applicationId}`
  }

  async function currentPath() {
    return new URL(await browser.getUrl()).pathname
  }

  // Drives a fresh draft only as far as "one overseas site has BES evidence
  // uploaded", which is all the bug needs - no PRN / business plan / sampling
  // plan, since the task list does not gate the ORS or BES tasks behind them.
  async function reachEvidenceListWithUploads() {
    await OperatorPage.navigateToExporterAccreditationGlass()
    const landing = await browser.getUrl()
    ;[, organisationId, registrationId, materialType] = new URL(
      landing
    ).pathname
      .split('/')
      .filter(Boolean)
    year = String(3000 + (Date.now() % 1000))
    await browser.url(
      `/operator-accreditation/${organisationId}/${registrationId}/${materialType}/${year}`
    )

    await OperatorAccreditationPage.clickContinue()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/accreditation/task-list/'),
      { timeout: 10000, timeoutMsg: 'Did not reach task list' }
    )
    applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]

    // BES evidence is per overseas site, so the ORS section has to be
    // confirmed before the evidence list has any rows to act on.
    await TaskListPage.overseasSitesLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/select-overseas-sites')
    )
    await OverseasReprocessingSitesPage.continue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/confirm-overseas-sites')
    )
    await ConfirmOverseasSitesPage.confirmAndContinue()

    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    await TaskListPage.besLink.click()
    await expect(browser).toHaveUrl(
      expect.stringContaining(
        '/accreditation/upload-evidence-for-overseas-site/'
      )
    )

    // Upload evidence for exactly one site. One file is enough: it is the
    // presence of uploads, not their number, that turns that site's row link
    // into the amend/review entry point the bug was reported from. Leaving
    // the other sites pending also proves the back link is not accidentally
    // correct only once the whole section is complete.
    await BesEvidencePage.pendingUploadLink.click()
    await BesEvidencePage.uploadFile('business-plan.pdf')
    await BesEvidencePage.selectNo()
    await BesEvidencePage.confirmEvidence()
    await browser.waitUntil(
      async () =>
        (await browser.getUrl()).includes('/upload-evidence-for-overseas-site'),
      {
        timeout: 10000,
        timeoutMsg: 'Did not return to evidence list after confirming'
      }
    )
  }

  it('sends back from the amend/review screen to the overseas site list, and from there to the task list rather than the upload screens', async () => {
    await reachEvidenceListWithUploads()

    const sites = await getOverseasSites(organisationId, applicationId)
    const uploadedSite = sites.find(
      (site) => (site.besEvidence?.besEvidenceUploads ?? []).length > 0
    )
    expect(uploadedSite).toBeDefined()
    const { siteId } = uploadedSite

    // Step 1-2 of the bug report: the site's row link now points at the CYA
    // review screen ("Amend Evidence") rather than back at the upload form.
    const siteActionLink = BesEvidencePage.siteActionLink(siteId)
    await expect(siteActionLink).toBeDisplayed()
    expect(await siteActionLink.getAttribute('href')).toContain(
      reviewUrl(siteId)
    )
    await BesEvidencePage.clickReliably(siteActionLink)
    await expect(browser).toHaveUrl(expect.stringContaining(reviewUrl(siteId)))

    // RA-588 core. The back link is server-rendered, so assert the href the
    // controller produced as well as clicking it - the href is the thing that
    // regressed, and asserting it names the defect precisely if this fails.
    const backHref = await BesEvidencePage.backLinkHref()
    expect(backHref).toContain(evidenceListUrl())
    expect(backHref).not.toContain('/accreditation/upload-more-evidence/')

    // Step 3: one back click must land on the site list itself. Compared as
    // an exact pathname, so landing on some deeper evidence sub-page cannot
    // pass as "close enough".
    await BesEvidencePage.clickBack()
    await browser.waitUntil(
      async () => (await currentPath()) === evidenceListUrl(),
      {
        timeout: 10000,
        timeoutMsg: `Back from the evidence review screen did not land on the overseas site list (was ${await browser.getUrl()})`
      }
    )

    // Step 4, the reported symptom: pressing back a second time must not walk
    // the operator forwards into the upload screens. For an ordinary editable
    // application the site list's back link belongs on the task list.
    await BesEvidencePage.clickBack()
    await browser.waitUntil(
      async () => (await currentPath()) === taskListUrl(),
      {
        timeout: 10000,
        timeoutMsg: `Back from the overseas site list did not land on the task list (was ${await browser.getUrl()})`
      }
    )

    // Stated explicitly as well, because "not the upload screens" is the
    // literal regression RA-588 describes and a future change to the task
    // list's URL should not quietly weaken this guard.
    const afterSecondBack = await browser.getUrl()
    expect(afterSecondBack).not.toContain('/accreditation/upload-bes-evidence/')
    expect(afterSecondBack).not.toContain(
      '/accreditation/upload-more-evidence/'
    )
  })
})
