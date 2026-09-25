import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import { getOverseasSites } from '../helpers/case-management.js'
import {
  createOrsWithInterimSite,
  addInterimSite
} from '../helpers/interim-site-journey.js'

/**
 * RA-603: an overseas reprocessing site can carry more than one interim site,
 * and withdrawing one is reversible.
 *
 * Picks up where interim-site.e2e.js leaves off. That spec proves an ORS can
 * have AN interim site; this proves it can have several, that they stay
 * independent of each other, and that withdrawing one keeps the record rather
 * than destroying it (AC05).
 *
 * Each test builds its own ORS, but they all share ONE accreditation: the
 * journey resumes the fixed interim-site test org rather than creating a new
 * application. These journeys mutate the thing they assert on - withdrawing,
 * restoring, adding - so every read here is scoped to the ORS the test created,
 * whose id createOrsWithInterimSite returns. Nothing may select "the first ORS
 * on the page" or count interim rows page-wide: those pick up the other tests'
 * ORSs, and previous runs' too, since mongo is not reset between runs.
 *
 * Needs MULTIPLE_INTERIM_SITES_ENABLED. Without it the page offers no way to
 * add a second interim site, which is the flag working rather than a failure.
 */

/**
 * The live interim-site ids belonging to ONE overseas site, in page order.
 *
 * Takes the ORS id rather than finding one, and queries within that ORS's own
 * <details> rather than across the page. Both matter: the accreditation is
 * shared, so an unscoped read returns the other tests' interim sites as well as
 * this test's - which is what made a `toHaveLength(2)` here receive 4, then 8 on
 * a second run against the same database.
 */
async function readInterimSiteIds(orsSiteId) {
  await OverseasReprocessingSitesPage.openInterimSiteDisclosure(orsSiteId)

  const rows = await OverseasReprocessingSitesPage.interimSiteDisclosure(
    orsSiteId
  ).$$('[data-testid^="interim-site-row-"]')

  const interimSiteIds = []
  for (const row of [...rows]) {
    interimSiteIds.push(
      (await row.getAttribute('data-testid')).replace('interim-site-row-', '')
    )
  }
  return interimSiteIds
}

describe('RA-603: several interim sites on one overseas reprocessing site', () => {
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

  // AC01/AC06: the restriction this ticket exists to lift. The backend used to
  // 409 the second interim site, and the page offered no way to ask for one.
  it('adds a second interim site to an ORS that already has one, keeping the first', async () => {
    const { orsSiteId } = await createOrsWithInterimSite({
      orsName: 'RA-603 Multi Interim GmbH',
      interimSiteName: 'RA-603 First Interim Depot'
    })

    const interimSiteIds = await readInterimSiteIds(orsSiteId)
    expect(interimSiteIds).toHaveLength(1)
    const firstId = interimSiteIds[0]

    await OverseasReprocessingSitesPage.addAnotherInterimSite(orsSiteId)
    await addInterimSite({
      siteName: 'RA-603 Second Interim Depot',
      operationCodes: ['R13']
    })

    expect(await readInterimSiteIds(orsSiteId)).toHaveLength(2)

    // The one that was already there is untouched, and keeps its own id.
    await expect(
      OverseasReprocessingSitesPage.interimSiteNameValue(firstId)
    ).toHaveText(expect.stringContaining('RA-603 First Interim Depot'))
  })

  // AC05: withdrawing one must leave the others alone.
  it('withdraws one interim site and leaves the other untouched', async () => {
    const { orsSiteId } = await createOrsWithInterimSite({
      orsName: 'RA-603 Withdraw One GmbH',
      interimSiteName: 'RA-603 Keep Me'
    })
    await OverseasReprocessingSitesPage.addAnotherInterimSite(orsSiteId)
    await addInterimSite({
      siteName: 'RA-603 Withdraw Me',
      operationCodes: ['R13']
    })

    const interimSiteIds = await readInterimSiteIds(orsSiteId)
    expect(interimSiteIds).toHaveLength(2)
    const [keepId, withdrawId] = interimSiteIds

    await OverseasReprocessingSitesPage.removeInterimSite(withdrawId)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )

    // Gone from the DOM, not merely hidden. The disclosure re-renders collapsed
    // after the POST, so not.toBeDisplayed() would pass whether or not the
    // withdrawal actually worked.
    await expect(
      OverseasReprocessingSitesPage.interimSiteRow(withdrawId)
    ).not.toBeExisting()

    await OverseasReprocessingSitesPage.openInterimSiteDisclosure(orsSiteId)
    await expect(
      OverseasReprocessingSitesPage.interimSiteRow(keepId)
    ).toBeExisting()
  })

  // C4, first half: the mis-click noticed straight away.
  it('offers an undo on the banner, which brings back the same interim site', async () => {
    const { orsSiteId } = await createOrsWithInterimSite({
      orsName: 'RA-603 Undo GmbH',
      interimSiteName: 'RA-603 Undo Depot'
    })
    const [targetId] = await readInterimSiteIds(orsSiteId)

    await OverseasReprocessingSitesPage.removeInterimSite(targetId)

    await expect(
      OverseasReprocessingSitesPage.withdrawnBanner()
    ).toBeDisplayed()
    await OverseasReprocessingSitesPage.undoWithdraw()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )

    await OverseasReprocessingSitesPage.openInterimSiteDisclosure(orsSiteId)
    // The SAME id returns. Restoring is in place, so this is the record
    // resuming rather than a replacement wearing the same name - which is the
    // identity link AC05 exists to protect.
    await expect(
      OverseasReprocessingSitesPage.interimSiteRow(targetId)
    ).toBeExisting()
  })

  // C4, second half: the operator who realises after the banner has gone.
  it('lists a withdrawn interim site separately and puts it back from there', async () => {
    const { orsSiteId } = await createOrsWithInterimSite({
      orsName: 'RA-603 Restore GmbH',
      interimSiteName: 'RA-603 Restore Depot'
    })
    const [targetId] = await readInterimSiteIds(orsSiteId)

    await OverseasReprocessingSitesPage.removeInterimSite(targetId)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )

    // Reload, so the banner's flash is spent and the disclosure is the only way
    // back - which is the whole reason it exists.
    await browser.refresh()

    await OverseasReprocessingSitesPage.openWithdrawnInterimSitesDisclosure(
      orsSiteId
    )
    await expect(
      OverseasReprocessingSitesPage.withdrawnInterimSiteRow(targetId)
    ).toBeDisplayed()

    await OverseasReprocessingSitesPage.restoreInterimSite(orsSiteId, targetId)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )

    await OverseasReprocessingSitesPage.openInterimSiteDisclosure(orsSiteId)
    await expect(
      OverseasReprocessingSitesPage.interimSiteRow(targetId)
    ).toBeExisting()
  })

  // AC05 from the API side. The page cannot tell a soft delete from a hard one
  // - both make the row disappear - so this is the assertion that distinguishes
  // them, and the one that fails if withdrawing ever starts destroying records.
  it('keeps a withdrawn interim site in the record, stamped with when it went', async () => {
    const { organisationId, applicationId, orsSiteId } =
      await createOrsWithInterimSite({
        orsName: 'RA-603 Soft Delete GmbH',
        interimSiteName: 'RA-603 Soft Delete Depot'
      })
    const [targetId] = await readInterimSiteIds(orsSiteId)

    await OverseasReprocessingSitesPage.removeInterimSite(targetId)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/select-overseas-sites')
    )

    const sites = await getOverseasSites(organisationId, applicationId)
    const withdrawn = sites
      .flatMap((site) => site.interimSites ?? [])
      .find((interim) => String(interim.siteId) === String(targetId))

    expect(withdrawn).toBeDefined()
    expect(withdrawn.removedAt).toBeTruthy()
    // Still carrying the identity that restoring gives back unchanged.
    expect(withdrawn.siteNumber).toBeTruthy()
  })
})
