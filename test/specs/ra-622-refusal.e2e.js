import { browser, $, expect } from '@wdio/globals'
import { readFile, writeFile } from 'node:fs/promises'
import { Page } from '../page-objects/page.js'

const summary =
  '/granted-accreditation/50006/aaa000000000000000050006/reex-acc-50006-Glass-2026/Glass/2026'

describe('RA-622 actual refusal readback and a new request', () => {
  before(async function () {
    if (process.env.RA_622_SPIKE_TESTS !== 'true') {
      this.skip()
    }
    await browser.deleteCookies()
    await browser.url('/auth/stub/login')
    await $('input[type="radio"]').click()
    await new Page().clickReliably($('button.govuk-button'))
  })

  it('retains the refused request, restores Change and submits a distinct request with the prepared proposal', async () => {
    const file = process.env.RA_622_SPIKE_RECEIPT_FILE
    if (!file) {
      throw new Error(
        'Set RA_622_SPIKE_RECEIPT_FILE to the actual submission receipt.'
      )
    }
    const original = JSON.parse(await readFile(file, 'utf8'))
    await browser.url(summary)
    await expect($('[data-testid="active-change-request"]')).not.toExist()
    const history = $(
      `[data-testid="closed-change-request"][data-request-id="${original.requestId}"]`
    )
    await expect(history).toHaveText(expect.stringContaining('Refused'))
    expect(await history.getAttribute('data-case-id')).toBe(original.caseId)
    expect(await history.getAttribute('data-site-id')).toBe(
      original.proposedSiteId
    )
    await expect($('[data-testid="granted-status"]')).toHaveText('Granted')
    expect(await $('[data-testid="approved-sites"]').getText()).toBe(
      original.baselineSites
    )
    await expect($('[data-testid="accreditation-change"]')).toBeDisplayed()
    await browser.refresh()
    await expect(history).toHaveText(expect.stringContaining('Refused'))
    await $('[data-testid="accreditation-change"]').click()
    await expect($('[data-testid="prepared-ors-proposal"]')).toHaveText(
      expect.stringContaining('Spike Glass Recycling')
    )
    await new Page().clickReliably($('[data-testid="submit-ors-example"]'))
    const active = $('[data-testid="active-change-request"]')
    await expect(active).toHaveText(expect.stringContaining('Submitted'))
    const next = {
      requestId: await active.getAttribute('data-request-id'),
      caseId: await active.getAttribute('data-case-id'),
      proposedSiteId: await active.getAttribute('data-site-id')
    }
    for (const field of ['requestId', 'caseId', 'proposedSiteId']) {
      expect(next[field]).toMatch(/^[0-9a-f-]{36}$/i)
      expect(next[field]).not.toBe(original[field])
    }
    await expect(history).toHaveText(expect.stringContaining('Refused'))
    await expect($('[data-testid="accreditation-change"]')).not.toExist()
    await expect($('[data-testid="granted-status"]')).toHaveText('Granted')
    expect(await $('[data-testid="approved-sites"]').getText()).toBe(
      original.baselineSites
    )
    await browser.refresh()
    expect(await active.getAttribute('data-request-id')).toBe(next.requestId)
    const response = await fetch(
      `http://localhost:5000/api/v1/accreditation-changes/50006/aaa000000000000000050006/reex-acc-50006-Glass-2026/Glass/2026`,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPERATOR_FRONTEND_SECRET || 'ra-622-spike-operator-frontend'}`
        }
      }
    )
    expect(response.status).toBe(200)
    const read = await response.json()
    expect(read.activeRequest.requestId).toBe(next.requestId)
    await writeFile(
      file,
      JSON.stringify({
        ...next,
        target: read.activeRequest.target,
        caseReference: read.activeRequest.caseReference,
        baselineSites: original.baselineSites,
        refusedRequest: original
      }) + '\n'
    )
  })
})
