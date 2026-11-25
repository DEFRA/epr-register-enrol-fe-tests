import { browser, expect, $, $$ } from '@wdio/globals'
import ReexHomePage from 'page-objects/reex-home.page'
import ReexRegistrationPage from 'page-objects/reex-registration.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddOrsBaselCodesPage from 'page-objects/add-ors-basel-codes.page'
import AddOrsRepatriatedLoadsPage from 'page-objects/add-ors-repatriated-loads.page'
import AddOrsCyaPage from 'page-objects/add-ors-cya.page'
import AddOrsConditionsOfExportPage from 'page-objects/add-ors-conditions-of-export.page'

import { accreditationYear } from '../../config.js'
import { addInterimSite } from '../interim-site-journey.js'
import { addOverseasSiteWithInterimSite } from '../query-response-journey.js'
import { handOffToRegisterEnrol } from './register-enrol-sign-in.js'
import { seededOrganisation } from './seeded-organisation.js'
import { signInAsSeededOperator } from './sign-in.js'

// Steps the test-environment scenarios share, on the organisation seeded for
// the run: opening one particular registration's accreditation, and working
// through its overseas reprocessing sites.

// The application statuses a journey can still be driven to submission from.
// SUBMITTED, UPDATED and QUERIED all mean somebody (a previous run, or a
// regulator) has moved the application past the point a journey starts from.
export const APPLICABLE_STATUSES = ['NOT STARTED', 'IN PROGRESS']

const noCheck = async () => {}

/**
 * The seeded organisation's registrations of one waste processing type, in
 * the order a scenario should try them: `preferred` materials first, then the
 * rest by number of overseas sites, most first.
 *
 * @param {'reprocessor' | 'exporter'} wasteProcessingType
 * @param {string[]} [preferred]
 * @param {import('./seeded-organisation.js').SeededOrganisation} [organisation]
 *   the organisation, when not the one seeded for the run
 */
export function seededRegistrations(
  wasteProcessingType,
  preferred = [],
  organisation = seededOrganisation()
) {
  const rank = (registration) => {
    const index = preferred.indexOf(registration.material)
    return index === -1 ? preferred.length : index
  }
  return organisation.registrations
    .filter(
      (registration) => registration.wasteProcessingType === wasteProcessingType
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Object.keys(b.overseasSites).length -
          Object.keys(a.overseasSites).length
    )
}

/**
 * Signs in to the Re-Ex frontend as the seeded operator, opens one
 * registration from the home page and follows its hand-off into its
 * accreditation. Leaves the browser on the accreditation landing page.
 *
 * @param {import('./seeded-organisation.js').SeededRegistration} registration
 * @param {import('./seeded-organisation.js').SeededOrganisation} [organisation]
 *   the organisation it belongs to, when not the one seeded for the run
 * @returns {Promise<string | null>} the application's status there, or null
 *   when the registration offers no accreditation for accreditationYear
 */
export async function openSeededAccreditation(
  registration,
  organisation = seededOrganisation()
) {
  await signInAsSeededOperator(organisation)
  if (registration.wasteProcessingType === 'exporter') {
    await ReexHomePage.openExporting()
  } else {
    await ReexHomePage.openReprocessing()
  }

  const row = (await ReexHomePage.materialRows()).find((candidate) =>
    candidate.href?.includes(
      `/registrations/${registration.registrationNumber}/`
    )
  )
  if (!row) {
    throw new Error(
      `Registration ${registration.registrationNumber} is not on organisation ${organisation.orgId}'s home page`
    )
  }
  await ReexHomePage.openMaterial(row)

  if (
    !(await ReexRegistrationPage.hasApplyForAccreditationLink(
      accreditationYear
    ))
  ) {
    return null
  }
  await handOffToRegisterEnrol(accreditationYear, organisation.email)
  return OperatorAccreditationPage.applicationStatus.getText()
}

/**
 * Opens the first of `registrations` whose accreditation can still be applied
 * for, and continues to its task list.
 *
 * @param {object[]} registrations
 * @param {object} [options]
 * @param {import('./seeded-organisation.js').SeededOrganisation} [options.organisation]
 *   the organisation they belong to, when not the one seeded for the run
 * @returns {Promise<{registration: object, applicationId: string}>}
 */
export async function startFirstApplicableAccreditation(
  registrations,
  { organisation } = {}
) {
  const skipped = []
  for (const registration of registrations) {
    const status = await openSeededAccreditation(registration, organisation)
    const name = `${registration.wasteProcessingType} ${registration.glassRecyclingProcess ?? registration.material}`
    if (!APPLICABLE_STATUSES.includes(status)) {
      skipped.push(
        `${name}: ${status ?? `no ${accreditationYear} hand-off link`}`
      )
      continue
    }

    await OperatorAccreditationPage.clickContinue()
    await expect(browser).toHaveUrl(
      expect.stringContaining('/accreditation/task-list/')
    )
    const applicationId = (await browser.getUrl())
      .split('/accreditation/task-list/')[1]
      .split('?')[0]
    return { registration, applicationId }
  }

  throw new Error(
    `None of the organisation's registrations can be applied for in ${accreditationYear}:\n  ${skipped.join('\n  ')}`
  )
}

const frontendOrigin = async () => new URL(await browser.getUrl()).origin

async function openSelectOverseasSites(applicationId) {
  await browser.url(
    `${await frontendOrigin()}/accreditation/select-overseas-sites/${applicationId}`
  )
  await OverseasReprocessingSitesPage.pageHeading.waitForDisplayed()
}

async function testIdSuffixes(selector, prefix) {
  const ids = []
  for (const element of await $$(selector)) {
    ids.push((await element.getAttribute('data-testid')).slice(prefix.length))
  }
  return ids
}

// Submits the form the browser is on and waits for the next page to load.
async function continueFrom(page) {
  const from = await browser.getUrl()
  await page.continue()
  await page.waitToLeave(from)
}

/**
 * Adds every site the select-overseas-sites page lists as registered (but not
 * accredited) to the accreditation. "Add to application" opens the site in
 * the add-overseas-site wizard's check-your-answers page, and saving it there
 * is what adds it, so the details it is missing are filled in first. Leaves
 * the browser on the select-overseas-sites page.
 *
 * @param {string} applicationId
 * @param {object} [options]
 * @returns {Promise<string[]>} the ORS ids added
 */
export async function addRegisteredSitesToAccreditation(
  applicationId,
  { baselCode = 'B3011', checkPage = noCheck } = {}
) {
  await openSelectOverseasSites(applicationId)
  await checkPage('Select overseas sites')
  const prefix = 'add-button-registered-'
  const ids = await testIdSuffixes(`[data-testid^="${prefix}"]`, prefix)
  const links = []
  for (const id of ids) {
    links.push({
      id,
      href: await OverseasReprocessingSitesPage.addToAccreditationButton(
        id
      ).getAttribute('href')
    })
  }

  for (const { id, href } of links) {
    await browser.url(new URL(href, await frontendOrigin()).toString())
    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await completeSiteDetails(applicationId, id, { baselCode, checkPage })
  }

  await openSelectOverseasSites(applicationId)
  for (const { id } of links) {
    await expect(
      OverseasReprocessingSitesPage.addToAccreditationButton(id)
    ).not.toBeExisting()
  }
  return ids
}

/**
 * Fills in what an overseas site's check-your-answers page shows as missing
 * (contact, recycling operations, Basel codes, rejected loads), page by page,
 * and saves it. Starts and ends on that check-your-answers page's site list.
 */
async function completeSiteDetails(
  applicationId,
  orsId,
  { baselCode, checkPage }
) {
  const wizard = `${await frontendOrigin()}/accreditation/add-overseas-site/${applicationId}`
  const n = Number(orsId)
  const fill = async (path, pageName, page, enter) => {
    await browser.url(`${wizard}/${path}?from=check-your-answers`)
    await page.continueButton.waitForDisplayed()
    await checkPage(pageName)
    await enter()
    await continueFrom(page)
  }

  await fill(
    'site-contact-details',
    'Overseas site contact details',
    AddOrsSiteContactPage,
    () =>
      AddOrsSiteContactPage.enterContactDetails({
        name: 'Anna Becker',
        email: `ors${orsId}.contact@example.com`,
        phone: `+49 203 555 ${String(n).padStart(4, '0')}`
      })
  )
  await fill(
    'recycling-operation-details',
    'Overseas site recycling operations',
    AddOrsRecyclingOperationPage,
    async () => {
      await AddOrsRecyclingOperationPage.selectPrimaryOperationCode()
      await AddOrsRecyclingOperationPage.selectOperationCodes(['R12', 'R13'])
    }
  )
  await fill(
    'basel-convention-and-oecd-code',
    'Overseas site Basel codes',
    AddOrsBaselCodesPage,
    () => AddOrsBaselCodesPage.enterCodes([baselCode])
  )
  await fill(
    'repatriated-loads',
    'Overseas site repatriated loads',
    AddOrsRepatriatedLoadsPage,
    () =>
      AddOrsRepatriatedLoadsPage.enterDescription(
        'Rejected or returned loads are held in a segregated bay and repatriated to the UK exporter within 30 days.'
      )
  )

  await browser.url(`${wizard}/check-your-answers`)
  await AddOrsCyaPage.summaryList.waitForDisplayed()
  // Only asked for materials with export conditions to meet (aluminium and
  // steel).
  if (
    /Conditions of export\s*Not provided/.test(
      await AddOrsCyaPage.summaryList.getText()
    )
  ) {
    await fill(
      'conditions-of-export',
      'Overseas site conditions of export',
      AddOrsConditionsOfExportPage,
      () => AddOrsConditionsOfExportPage.selectYes()
    )
    await browser.url(`${wizard}/check-your-answers`)
    await AddOrsCyaPage.summaryList.waitForDisplayed()
  }
  // Some sites (e.g. those set up by hand on dev) have no coordinates.
  if (
    /Coordinates\s*Not provided/.test(await AddOrsCyaPage.summaryList.getText())
  ) {
    await fill(
      'site-location',
      'Overseas site location',
      AddOrsSiteLocationPage,
      () => AddOrsSiteLocationPage.coordinatesInput.setValue('51.4344, 6.7623')
    )
    await browser.url(`${wizard}/check-your-answers`)
    await AddOrsCyaPage.summaryList.waitForDisplayed()
  }
  await checkPage('Overseas site check your answers')
  await expect(AddOrsCyaPage.summaryList).not.toHaveText(
    expect.stringContaining('Not provided')
  )
  await AddOrsCyaPage.submit()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/select-overseas-sites/')
  )
}

/**
 * Completes every site the select-overseas-sites page tags "Incomplete", in
 * whichever section it is listed, through its Change link. Leaves the browser
 * on that page with none left.
 *
 * @param {string} applicationId
 * @param {object} [options]
 * @returns {Promise<string[]>} the ORS ids completed
 */
export async function completeIncompleteOverseasSites(
  applicationId,
  { baselCode = 'B3011', checkPage = noCheck, section } = {}
) {
  // section: only that section's sites ('accredited-site', say), so a
  // registered site is never completed, which would add it to the application.
  const tagSelector = section
    ? `[data-testid^="${section}-incomplete-"]`
    : '[data-testid*="-incomplete-"]'
  const completed = []
  for (let pass = 0; pass < 3; pass++) {
    await openSelectOverseasSites(applicationId)
    const incomplete = []
    for (const tag of await $$(tagSelector)) {
      const testId = await tag.getAttribute('data-testid')
      const [prefix, id] = testId.split('-incomplete-')
      const edit = $(`[data-testid="${prefix}-row-${id}"] a[href*="/edit/"]`)
      incomplete.push({ id, href: await edit.getAttribute('href') })
    }
    if (!incomplete.length) {
      return completed
    }

    for (const { id, href } of incomplete) {
      await browser.url(new URL(href, await frontendOrigin()).toString())
      await expect(browser).toHaveUrl(
        expect.stringContaining('/check-your-answers')
      )
      await completeSiteDetails(applicationId, id, { baselCode, checkPage })
      completed.push(id)
    }
  }

  await openSelectOverseasSites(applicationId)
  const left = await $$('[data-testid*="-incomplete-"]')
  throw new Error(
    `${left.length} overseas site(s) still incomplete after three passes`
  )
}

// Interim site row ids under one overseas site's disclosure.
async function interimSiteIds(orsId) {
  const prefix = 'interim-site-row-'
  return testIdSuffixes(
    `[data-testid="interim-sites-disclosure-${orsId}"] [data-testid^="${prefix}"]`,
    prefix
  )
}

/**
 * From the select-overseas-sites page, adds a new overseas site with an
 * interim site, and then more interim sites until there are
 * `interimSiteCount` in all. Leaves the browser on that page.
 *
 * An overseas site offers "Add another interim site" (RA-603), so all of them
 * go on the new site.
 *
 * @returns {Promise<{orsId: string, interimSites: {orsId: string, interimSiteId: string, name: string}[]}>}
 *   the new site's ORS id, and every interim site added with its ORS and name
 */
export async function addNewSiteWithInterimSites(
  applicationId,
  { site, interimSite, interimSiteCount, checkPage = noCheck }
) {
  await openSelectOverseasSites(applicationId)
  const prefix = 'new-site-row-'
  const before = await testIdSuffixes(`[data-testid^="${prefix}"]`, prefix)

  // Every interim site is numbered, from 1, so no name is part of another's
  // and each can be looked for on its own.
  const interimSiteName = (n) => `${interimSite.name} ${n}`
  await addOverseasSiteWithInterimSite({
    site,
    interimSite: { ...interimSite, name: interimSiteName(1) }
  })
  await checkPage('Select overseas sites with interim site')

  const after = await testIdSuffixes(`[data-testid^="${prefix}"]`, prefix)
  const created = after.filter((id) => !before.includes(id))
  if (created.length !== 1) {
    throw new Error(
      `Expected one new overseas site, found [${created}] (before: [${before}])`
    )
  }
  const [orsId] = created
  await OverseasReprocessingSitesPage.openInterimSiteDisclosure(orsId)
  const interimSites = (await interimSiteIds(orsId)).map((interimSiteId) => ({
    orsId,
    interimSiteId,
    name: interimSiteName(1)
  }))
  expect(interimSites).toHaveLength(1)

  for (let n = 2; n <= interimSiteCount; n++) {
    await OverseasReprocessingSitesPage.addAnotherInterimSite(orsId)
    // addInterimSite's own address, a German one, for the second and later.
    const name = interimSiteName(n)
    await addInterimSite({ siteName: name, operationCodes: ['R12'] })

    await OverseasReprocessingSitesPage.openInterimSiteDisclosure(orsId)
    const ids = await interimSiteIds(orsId)
    const known = interimSites.map(({ interimSiteId }) => interimSiteId)
    const added = ids.filter((id) => !known.includes(id))
    expect(added).toHaveLength(1)
    interimSites.push({ orsId, interimSiteId: added[0], name })
  }

  return { orsId, interimSites }
}

/**
 * Waits STATUS_STEP_PAUSE_MS (0, so not at all, unless set) between status
 * changes, so each lands at a clearly different time: e.g. to rule out timing
 * when an interim site's statusHistory shows two changes at the same moment.
 *
 * @param {string} what what the pause comes after, for the log
 */
export async function pauseBetweenStatusChanges(what) {
  const ms = Number(process.env.STATUS_STEP_PAUSE_MS) || 0
  if (ms <= 0) {
    return
  }
  process.stdout.write(
    `Pausing ${Math.round(ms / 1000)}s ${what} (${new Date().toISOString()})\n`
  )
  // A deliberate gap in time, not a wait for the page: nothing to wait on.
  // The browser is asked for its URL every 15s meanwhile, so a long pause
  // never leaves the WebDriver session idle.
  const until = Date.now() + ms
  while (Date.now() < until) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(15000, until - Date.now()))
    )
    await browser.getUrl()
  }
}

/**
 * Gives an application's interim sites each status history the accreditation
 * API tests check (RA-781), from what addNewSiteWithInterimSites added:
 *
 *   restored     the first: withdrawn, then restored. One interim site whose
 *                history reads approved, withdrawn, approved.
 *   withdrawn    the second: withdrawn and left so. Latest status withdrawn.
 *   replacement  a new interim site added on the withdrawn one's overseas
 *                site, named `${interimSite.name} ${interimSites.length + 1}`.
 *                A separate interim site, with a history of its own.
 *
 * Leaves the browser on the select-overseas-sites page.
 *
 * @param {string} applicationId
 * @param {object} options
 * @param {{orsId: string, interimSiteId: string, name: string}[]} options.interimSites
 *   at least two, as addNewSiteWithInterimSites returns them
 * @param {{name: string}} options.interimSite the name they are numbered from
 * @returns {Promise<{restored: object, withdrawn: object, replacement: object}>}
 */
export async function withdrawRestoreAndReplaceInterimSites(
  applicationId,
  { interimSites, interimSite, checkPage = noCheck }
) {
  if (interimSites.length < 2) {
    throw new Error(
      'Two interim sites are needed: one to restore, one to withdraw'
    )
  }
  const [restored, withdrawn] = interimSites
  // When each change was made, by this runner's clock, to compare with the
  // recordedAt the API serves for it.
  const changes = []
  const changed = async (what) => {
    changes.push({ change: what, at: new Date().toISOString() })
    await pauseBetweenStatusChanges(`after: ${what}`)
  }

  const removeAndWait = async ({ orsId, interimSiteId }) => {
    await openSelectOverseasSites(applicationId)
    await OverseasReprocessingSitesPage.openInterimSiteDisclosure(orsId)
    await OverseasReprocessingSitesPage.removeInterimSite(interimSiteId)
    await OverseasReprocessingSitesPage.pageHeading.waitForDisplayed()
    await OverseasReprocessingSitesPage.openWithdrawnInterimSitesDisclosure(
      orsId
    )
    await expect(
      OverseasReprocessingSitesPage.withdrawnInterimSiteRow(interimSiteId)
    ).toBeDisplayed()
  }

  await pauseBetweenStatusChanges('before the first withdrawal')
  await removeAndWait(restored)
  await changed(`withdrew ${restored.name}`)
  await OverseasReprocessingSitesPage.restoreInterimSite(
    restored.orsId,
    restored.interimSiteId
  )
  await OverseasReprocessingSitesPage.pageHeading.waitForDisplayed()
  await OverseasReprocessingSitesPage.openInterimSiteDisclosure(restored.orsId)
  expect(await interimSiteIds(restored.orsId)).toContain(restored.interimSiteId)
  await changed(`restored ${restored.name}`)
  await checkPage('Select overseas sites after restoring an interim site')

  await removeAndWait(withdrawn)
  await changed(`withdrew ${withdrawn.name}`)
  await checkPage('Select overseas sites with a withdrawn interim site')

  // The replacement goes on the same overseas site, through its "Add another
  // interim site" link, as addNewSiteWithInterimSites adds a second.
  const host = withdrawn.orsId
  const before = await interimSiteIds(host)
  await OverseasReprocessingSitesPage.openInterimSiteDisclosure(host)
  await OverseasReprocessingSitesPage.addAnotherInterimSite(host)
  const name = `${interimSite.name} ${interimSites.length + 1}`
  await addInterimSite({ siteName: name, operationCodes: ['R12'] })
  await OverseasReprocessingSitesPage.openInterimSiteDisclosure(host)
  const added = (await interimSiteIds(host)).filter(
    (id) => !before.includes(id) && id !== withdrawn.interimSiteId
  )
  expect(added).toHaveLength(1)
  await changed(`added ${name}`)
  await checkPage('Select overseas sites with a replacement interim site')

  return {
    changes,
    restored,
    withdrawn,
    replacement: { orsId: host, interimSiteId: added[0], name }
  }
}

/**
 * From the select-overseas-sites page, gives every accredited site that has no
 * interim site one, through its check-your-answers page's "Save and add
 * interim site". Adds no overseas site and touches no registered one. Leaves
 * the browser on that page.
 *
 * @param {string} applicationId
 * @param {object} options
 * @param {(n: number, orsId: string) => string} options.name the interim
 *   site's name, from its number (from 1) and its overseas site
 * @returns {Promise<{orsId: string, interimSiteId: string, name: string}[]>}
 */
export async function addInterimSiteToEachAccreditedSite(
  applicationId,
  { name, checkPage = noCheck }
) {
  await openSelectOverseasSites(applicationId)
  const prefix = 'accredited-site-row-'
  const hosts = []
  for (const id of await testIdSuffixes(`[data-testid^="${prefix}"]`, prefix)) {
    if (
      !(await OverseasReprocessingSitesPage.interimSiteDisclosure(
        id
      ).isExisting())
    ) {
      hosts.push(id)
    }
  }

  const added = []
  for (const [i, host] of hosts.entries()) {
    const href =
      await OverseasReprocessingSitesPage.editAccreditedButton(
        host
      ).getAttribute('href')
    await browser.url(new URL(href, await frontendOrigin()).toString())
    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await AddOrsCyaPage.saveAndAddInterimSite()
    const siteName = name(i + 1, host)
    await addInterimSite({ siteName, operationCodes: ['R12'] })
    await checkPage('Select overseas sites with interim site')

    await OverseasReprocessingSitesPage.openInterimSiteDisclosure(host)
    const ids = await interimSiteIds(host)
    expect(ids).toHaveLength(1)
    added.push({ orsId: host, interimSiteId: ids[0], name: siteName })
  }
  return added
}
