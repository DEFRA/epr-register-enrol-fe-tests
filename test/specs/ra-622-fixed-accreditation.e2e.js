import { browser, $, $$, expect } from '@wdio/globals'
import { Page } from '../page-objects/page.js'

const summary =
  '/granted-accreditation/50006/aaa000000000000000050006/reex-acc-50006-Glass-2026/Glass/2026'

describe('RA-622 fixed granted accreditation through the real backend', () => {
  before(async function () {
    if (process.env.RA_622_SPIKE_TESTS !== 'true') {
      this.skip()
    }
    await browser.deleteCookies()
    await browser.url('/auth/stub/login')
    await $('input[type="radio"]').click()
    await new Page().clickReliably($('button.govuk-button'))
    const cookies = await browser.getCookies()
    expect(
      cookies.some((cookie) => cookie.name === 'ra-622-spike-operator-session')
    ).toBe(true)
  })

  it('opens one granted target and its read-only prepared ORS without creating an application', async () => {
    const backend = process.env.OPERATOR_BACKEND_URL || 'http://localhost:5000'
    const headers = {
      Authorization: `Bearer ${process.env.OPERATOR_FRONTEND_SECRET || 'ra-622-spike-operator-frontend'}`
    }
    const readApplications = async () => {
      const response = await fetch(
        `${backend}/api/v1/accreditation-applications/50006`,
        { headers }
      )
      expect(response.status).toBe(200)
      return response.json()
    }
    const before = await readApplications()
    await browser.url('/operator')
    await expect(
      $$('[data-testid="spike-accreditation-link"]')
    ).toBeElementsArrayOfSize(1)
    await $('[data-testid="spike-accreditation-link"]').click()
    expect(new URL(await browser.getUrl()).pathname).toBe(summary)
    await expect($('[data-testid="granted-accreditation-summary"]')).toHaveText(
      expect.stringContaining('Global Glass Exports')
    )
    for (const identity of [
      '50006',
      'EXP-50006',
      'aaa000000000000000050006',
      'reex-acc-50006-Glass-2026',
      'Glass',
      '2026'
    ]) {
      await expect(
        $('[data-testid="granted-accreditation-summary"]')
      ).toHaveText(expect.stringContaining(identity))
    }
    await expect($('[data-testid="granted-status"]')).toHaveText('Granted')
    await expect(
      $$('[data-testid="approved-sites"] li')
    ).toBeElementsArrayOfSize(4)
    await expect($('[data-testid="approved-sites"]')).toHaveText(
      expect.stringContaining('Overseas Site 1 (Germany)')
    )
    await browser.refresh()
    await $('[data-testid="accreditation-change"]').click()
    await expect($('[data-testid="prepared-ors-proposal"]')).toHaveText(
      expect.stringContaining('Spike Glass Recycling')
    )
    await expect($('[data-testid="prepared-ors-proposal"]')).toHaveText(
      expect.stringContaining('25 Example Road, Hamburg')
    )
    await expect(
      $$('[data-testid="prepared-ors-proposal"] input')
    ).toBeElementsArrayOfSize(0)
    await expect(
      $$('[data-testid="prepared-ors-proposal"] form')
    ).toBeElementsArrayOfSize(0)
    await browser.refresh()
    await expect($('[data-testid="proposal-read-only"]')).toHaveText(
      'This example is ready to review. Submission is not available yet.'
    )
    expect(await readApplications()).toEqual(before)

    await browser.url(summary.replace('Glass/2026', 'Glass/2027'))
    await expect($('h1')).toHaveText('404')
    await browser.url('/operator')
    await expect(
      $(
        'a[href="/operator-accreditation/50002/aaa000000000000000050002/Glass/2027"]'
      )
    ).toBeDisplayed()
    await browser.url('/auth/logout')
    await browser.url(summary)
    expect(new URL(await browser.getUrl()).pathname).toBe('/auth/stub/login')
  })
})
