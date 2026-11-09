import { browser, expect, $, $$ } from '@wdio/globals'
import OverseasReprocessingSitesPage from 'page-objects/overseas-reprocessing-sites.page'
import AddOrsSiteLocationPage from 'page-objects/add-ors-site-location.page'
import AddOrsSiteContactPage from 'page-objects/add-ors-site-contact.page'
import AddOrsRecyclingOperationPage from 'page-objects/add-ors-recycling-operation.page'
import AddOrsBaselCodesPage from 'page-objects/add-ors-basel-codes.page'
import AddOrsRepatriatedLoadsPage from 'page-objects/add-ors-repatriated-loads.page'
import AddOrsConditionsOfExportPage from 'page-objects/add-ors-conditions-of-export.page'
import AddOrsCyaPage from 'page-objects/add-ors-cya.page'

// The monorepo specs only. The stub exporter registrations the monorepo's
// local stack serves come with overseas sites that have only a name and a
// country, so the select-overseas-sites page tags every one Incomplete and
// will not continue until each is filled in. Deployed environments seed full
// sites and have their own journey for this
// (integration-organisation/seeded-accreditation-journey.js), which the
// monorepo specs leave alone.

async function continueFrom(page) {
  const from = await browser.getUrl()
  await page.continue()
  await page.waitToLeave(from)
}

/**
 * Fills in everything a stub overseas site is missing, through the
 * add-overseas-site wizard opened on it, and saves it. Starts on the site's
 * check-your-answers page; ends back on select-overseas-sites.
 */
async function completeStubSite(applicationId, orsId) {
  const wizard = `/accreditation/add-overseas-site/${applicationId}`
  const n = Number(orsId)
  const fill = async (path, page, enter) => {
    await browser.url(`${wizard}/${path}?from=check-your-answers`)
    await page.continueButton.waitForDisplayed()
    await enter()
    await continueFrom(page)
  }

  await fill('site-location', AddOrsSiteLocationPage, async () => {
    const blanks = [
      [AddOrsSiteLocationPage.addressLine1Input, `${n} Industriestrasse`],
      [AddOrsSiteLocationPage.townOrCityInput, 'Duisburg'],
      [AddOrsSiteLocationPage.coordinatesInput, '51.4344, 6.7623']
    ]
    for (const [input, value] of blanks) {
      if ((await input.isExisting()) && !(await input.getValue())) {
        await input.setValue(value)
      }
    }
  })
  await fill('site-contact-details', AddOrsSiteContactPage, () =>
    AddOrsSiteContactPage.enterContactDetails({
      name: 'Anna Becker',
      email: `ors${orsId}.contact@example.com`,
      phone: `+49 203 555 ${String(n).padStart(4, '0')}`
    })
  )
  await fill(
    'recycling-operation-details',
    AddOrsRecyclingOperationPage,
    async () => {
      await AddOrsRecyclingOperationPage.selectPrimaryOperationCode()
      await AddOrsRecyclingOperationPage.selectOperationCodes(['R12', 'R13'])
    }
  )
  await fill('basel-convention-and-oecd-code', AddOrsBaselCodesPage, () =>
    AddOrsBaselCodesPage.enterCodes(['B3011'])
  )
  await fill('repatriated-loads', AddOrsRepatriatedLoadsPage, () =>
    AddOrsRepatriatedLoadsPage.enterDescription(
      'Rejected or returned loads are held in a segregated bay and repatriated to the UK exporter within 30 days.'
    )
  )

  await browser.url(`${wizard}/check-your-answers`)
  await AddOrsCyaPage.summaryList.waitForDisplayed()
  // Only asked for materials with export conditions to meet.
  if (
    /Conditions of export\s*Not provided/.test(
      await AddOrsCyaPage.summaryList.getText()
    )
  ) {
    await fill('conditions-of-export', AddOrsConditionsOfExportPage, () =>
      AddOrsConditionsOfExportPage.selectYes()
    )
    await browser.url(`${wizard}/check-your-answers`)
    await AddOrsCyaPage.summaryList.waitForDisplayed()
  }
  await expect(AddOrsCyaPage.summaryList).not.toHaveText(
    expect.stringContaining('Not provided')
  )
  await AddOrsCyaPage.submit()
  await expect(browser).toHaveUrl(
    expect.stringContaining('/accreditation/select-overseas-sites/')
  )
}

/**
 * Completes every overseas site the select-overseas-sites page tags
 * Incomplete. Leaves the browser on that page, with none left.
 *
 * @param {string} applicationId
 */
export async function completeStubOverseasSites(applicationId) {
  await browser.url(`/accreditation/select-overseas-sites/${applicationId}`)
  await OverseasReprocessingSitesPage.pageHeading.waitForDisplayed()

  const incomplete = []
  for (const tag of await $$('[data-testid*="-incomplete-"]')) {
    const [prefix, id] = (await tag.getAttribute('data-testid')).split(
      '-incomplete-'
    )
    const edit = $(`[data-testid="${prefix}-row-${id}"] a[href*="/edit/"]`)
    incomplete.push({ id, href: await edit.getAttribute('href') })
  }

  for (const { id, href } of incomplete) {
    await browser.url(href)
    await expect(browser).toHaveUrl(
      expect.stringContaining('/check-your-answers')
    )
    await completeStubSite(applicationId, id)
  }

  await expect($$('[data-testid*="-incomplete-"]')).toBeElementsArrayOfSize(0)
}
