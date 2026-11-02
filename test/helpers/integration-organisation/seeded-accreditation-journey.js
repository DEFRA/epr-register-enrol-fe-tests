import { browser, expect, $, $$ } from '@wdio/globals'
import ReexHomePage from 'page-objects/reex-home.page'
import ReexRegistrationPage from 'page-objects/reex-registration.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
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
// through a long list of overseas reprocessing sites.

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

// A few hundred sites take a while, so say how far through they are.
function reportProgress(what, done, total) {
  if (done % 10 === 0 || done === total) {
    process.stdout.write(`${what} ${done} of ${total}\n`)
  }
}

// Chrome now and then drops a long-lived session ("invalid session id: the
// browser has closed the connection"), and a few hundred sites is several
// hundred page loads. So the site loops below start a fresh session every
// SESSION_RECYCLE_EVERY sites, and, should a session still be lost, resume in
// a new one and redo the site it was on.
const SESSION_RECYCLE_EVERY = 40

// A lost session, or the network briefly dropping out from under it (the
// environment is reached over the Defra VPN, and its DNS now and then fails to
// resolve for a few seconds).
const sessionLost = (err) =>
  /invalid session id|browser has closed|session deleted|not reachable|disconnected|net::ERR_/i.test(
    String(err?.message ?? err)
  )

const RESUME_ATTEMPTS = 3
const RESUME_WAIT = 15000

async function resumeWithRetries(resumeSession) {
  for (let attempt = 1; ; attempt++) {
    try {
      await resumeSession()
      return
    } catch (err) {
      if (attempt >= RESUME_ATTEMPTS || !sessionLost(err)) {
        throw err
      }
      process.stdout.write(
        `Resuming the browser session failed (${String(err.message).split('\n')[0]}); trying again\n`
      )
      await new Promise((resolve) => setTimeout(resolve, RESUME_WAIT))
    }
  }
}

/**
 * Runs `doSite` for each of `sites` in turn. With `resumeSession` (which must
 * leave the browser signed in on the application's landing page), the browser
 * session is recycled every SESSION_RECYCLE_EVERY sites, and a site whose
 * session is lost is redone once in a new one: `doSite(site, {retrying: true})`.
 */
async function forEachSite(sites, label, doSite, resumeSession) {
  for (const [index, site] of sites.entries()) {
    if (resumeSession && index > 0 && index % SESSION_RECYCLE_EVERY === 0) {
      await resumeWithRetries(resumeSession)
    }
    try {
      await doSite(site, { retrying: false })
    } catch (err) {
      if (!resumeSession || !sessionLost(err)) {
        throw err
      }
      process.stdout.write(
        `Browser session lost at ${label.toLowerCase()} ${site.id}; resuming in a new one\n`
      )
      await resumeWithRetries(resumeSession)
      await doSite(site, { retrying: true })
    }
    reportProgress(label, index + 1, sites.length)
  }
}

// Submits the form the browser is on and waits for it to leave that page.
async function continueFrom(page) {
  const from = await browser.getUrl()
  await page.continue()
  await browser.waitUntil(async () => (await browser.getUrl()) !== from, {
    timeoutMsg: `Continuing did not leave ${from}`
  })
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
 * @param {() => Promise<void>} [options.resumeSession] see forEachSite
 * @returns {Promise<string[]>} the ORS ids added
 */
export async function addRegisteredSitesToAccreditation(
  applicationId,
  { baselCode = 'B3011', checkPage = noCheck, resumeSession } = {}
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

  await forEachSite(
    links,
    'Added registered site',
    async ({ id, href }, { retrying }) => {
      if (retrying) {
        // The lost session may have got as far as adding it.
        await openSelectOverseasSites(applicationId)
        if (
          !(await OverseasReprocessingSitesPage.addToAccreditationButton(
            id
          ).isExisting())
        ) {
          return
        }
      }
      await browser.url(new URL(href, await frontendOrigin()).toString())
      await expect(browser).toHaveUrl(
        expect.stringContaining('/check-your-answers')
      )
      await completeSiteDetails(applicationId, id, { baselCode, checkPage })
    },
    resumeSession
  )

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
 * @param {() => Promise<void>} [options.resumeSession] see forEachSite
 * @returns {Promise<string[]>} the ORS ids completed
 */
export async function completeIncompleteOverseasSites(
  applicationId,
  { baselCode = 'B3011', checkPage = noCheck, resumeSession } = {}
) {
  const completed = []
  for (let pass = 0; pass < 3; pass++) {
    await openSelectOverseasSites(applicationId)
    const incomplete = []
    for (const tag of await $$('[data-testid*="-incomplete-"]')) {
      const testId = await tag.getAttribute('data-testid')
      const [prefix, id] = testId.split('-incomplete-')
      const edit = $(`[data-testid="${prefix}-row-${id}"] a[href*="/edit/"]`)
      incomplete.push({ id, href: await edit.getAttribute('href') })
    }
    if (!incomplete.length) {
      return completed
    }

    await forEachSite(
      incomplete,
      'Completed incomplete site',
      async ({ id, href }, { retrying }) => {
        if (retrying) {
          // The lost session may have got as far as completing it.
          await openSelectOverseasSites(applicationId)
          if (!(await $(`[data-testid$="-incomplete-${id}"]`).isExisting())) {
            completed.push(id)
            return
          }
        }
        await browser.url(new URL(href, await frontendOrigin()).toString())
        await expect(browser).toHaveUrl(
          expect.stringContaining('/check-your-answers')
        )
        await completeSiteDetails(applicationId, id, { baselCode, checkPage })
        completed.push(id)
      },
      resumeSession
    )
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
 * Where they go depends on the frontend's multipleInterimSitesEnabled flag
 * (RA-603). With it on, an overseas site offers "Add another interim site"
 * and all of them go on the new site. With it off, as on test today, an
 * overseas site takes one, so each of the rest goes on an accredited site
 * that has none yet, through that site's "Save and add interim site".
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

  await addOverseasSiteWithInterimSite({ site, interimSite })
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
    name: interimSite.name
  }))
  expect(interimSites).toHaveLength(1)

  const multipleAllowed =
    await OverseasReprocessingSitesPage.addInterimSiteLink(orsId).isExisting()
  // Accredited sites with no interim site yet, for when the new one can take
  // only one.
  const accreditedPrefix = 'accredited-site-row-'
  const hosts = []
  if (!multipleAllowed) {
    for (const id of await testIdSuffixes(
      `[data-testid^="${accreditedPrefix}"]`,
      accreditedPrefix
    )) {
      if (
        !(await OverseasReprocessingSitesPage.interimSiteDisclosure(
          id
        ).isExisting())
      ) {
        hosts.push(id)
      }
    }
  }

  for (let n = 2; n <= interimSiteCount; n++) {
    let host = orsId
    if (multipleAllowed) {
      await OverseasReprocessingSitesPage.addAnotherInterimSite(orsId)
    } else {
      host = hosts.shift()
      if (!host) {
        throw new Error(
          `No accredited site without an interim site left for interim site ${n}`
        )
      }
      const href =
        await OverseasReprocessingSitesPage.editAccreditedButton(
          host
        ).getAttribute('href')
      await browser.url(new URL(href, await frontendOrigin()).toString())
      await expect(browser).toHaveUrl(
        expect.stringContaining('/check-your-answers')
      )
      await AddOrsCyaPage.saveAndAddInterimSite()
    }
    // addInterimSite's own address, a German one, for the second and later.
    const name = `${interimSite.name} ${n}`
    await addInterimSite({ siteName: name, operationCodes: ['R12'] })

    await OverseasReprocessingSitesPage.openInterimSiteDisclosure(host)
    const ids = await interimSiteIds(host)
    const known = interimSites.map(({ interimSiteId }) => interimSiteId)
    const added = ids.filter((id) => !known.includes(id))
    expect(added).toHaveLength(1)
    interimSites.push({ orsId: host, interimSiteId: added[0], name })
  }

  return { orsId, interimSites }
}
