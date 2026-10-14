import { browser, $, $$, expect } from '@wdio/globals'
import { writeFile } from 'node:fs/promises'
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

  it('submits or resumes the prepared ORS through the real services and preserves Granted', async () => {
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
    const baselineSiteEntries = await $$(
      '[data-testid="approved-sites"] li'
    ).map((site) => site.getText())
    expect(baselineSiteEntries.length).toBeGreaterThanOrEqual(4)
    await expect($('[data-testid="approved-sites"]')).toHaveText(
      expect.stringContaining('Overseas Site 1 (Germany)')
    )
    const baselineSites = await $('[data-testid="approved-sites"]').getText()
    await browser.refresh()
    if (await $('[data-testid="accreditation-change"]').isExisting()) {
      await $('[data-testid="accreditation-change"]').click()
      await expect($('[data-testid="prepared-ors-proposal"]')).toHaveText(
        expect.stringContaining('Spike Glass Recycling')
      )
      await expect($('[data-testid="prepared-ors-proposal"]')).toHaveText(
        expect.stringContaining('25 Example Road, Hamburg')
      )
      await browser.refresh()
      await expect($('[data-testid="submit-ors-example"]')).toBeDisplayed()
      await new Page().clickReliably($('[data-testid="submit-ors-example"]'))
    } else {
      const crumb = (await browser.getCookies()).find(
        (cookie) => cookie.name === 'crumb'
      ).value
      const status = await browser.execute(
        async (url, token) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ crumb: token }),
            redirect: 'manual'
          })
          return response.type === 'opaqueredirect' ? 302 : response.status
        },
        summary + '/submit',
        crumb
      )
      expect(status).toBe(302)
      await browser.url(summary)
    }
    const active = $('[data-testid="active-change-request"]')
    await expect(active).toBeDisplayed()
    await expect(active).toHaveText(expect.stringContaining('Submitted'))
    const requestId = await active.getAttribute('data-request-id')
    const caseId = await active.getAttribute('data-case-id')
    const proposedSiteId = await active.getAttribute('data-site-id')
    for (const id of [requestId, caseId, proposedSiteId]) {
      expect(id).toMatch(/^[0-9a-f-]{36}$/i)
    }
    await expect($('[data-testid="accreditation-change"]')).not.toExist()
    await expect($('[data-testid="granted-status"]')).toHaveText('Granted')
    expect(await $('[data-testid="approved-sites"]').getText()).toBe(
      baselineSites
    )
    await browser.refresh()
    expect(await active.getAttribute('data-request-id')).toBe(requestId)
    expect(await active.getAttribute('data-case-id')).toBe(caseId)
    expect(await active.getAttribute('data-site-id')).toBe(proposedSiteId)
    const repeated = await fetch(
      backend +
        '/api/v1/accreditation-changes/50006/aaa000000000000000050006/reex-acc-50006-Glass-2026/Glass/2026/submit',
      { method: 'POST', headers }
    )
    expect(repeated.status).toBe(200)
    const replay = await repeated.json()
    expect(replay.requestId).toBe(requestId)
    expect(replay.caseId).toBe(caseId)
    expect(replay.proposedSiteId).toBe(proposedSiteId)
    if (process.env.RA_622_SPIKE_RECEIPT_FILE) {
      await writeFile(
        process.env.RA_622_SPIKE_RECEIPT_FILE,
        JSON.stringify({
          requestId,
          caseId,
          proposedSiteId,
          baselineSites,
          baselineSiteEntries,
          caseReference: replay.caseReference,
          target: replay.target
        }) + '\n'
      )
    }
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
