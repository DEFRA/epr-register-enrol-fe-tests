import { browser, $, $$, expect } from '@wdio/globals'
import { readFile, writeFile } from 'node:fs/promises'
import { Page } from '../page-objects/page.js'

const summary =
  '/granted-accreditation/50006/aaa000000000000000050006/reex-acc-50006-Glass-2026/Glass/2026'

describe('RA-622 connected submitted-request withdrawal', () => {
  before(async function () {
    if (process.env.RA_622_SPIKE_TESTS !== 'true') {
      this.skip()
    }
    await browser.deleteCookies()
    await browser.url('/auth/stub/login')
    await $('input[type="radio"]').click()
    await new Page().clickReliably($('button.govuk-button'))
  })

  it('withdraws the real case, preserves all approved sites and submits a distinct new attempt', async () => {
    const file = process.env.RA_622_SPIKE_RECEIPT_FILE
    if (!file) {
      throw new Error(
        'Set RA_622_SPIKE_RECEIPT_FILE to the actual submission receipt.'
      )
    }
    const receipt = JSON.parse(await readFile(file, 'utf8'))
    const backend = process.env.OPERATOR_BACKEND_URL || 'http://localhost:5000'
    const targetUrl =
      backend +
      '/api/v1/accreditation-changes/' +
      [
        receipt.target.organisationId,
        receipt.target.registrationId,
        receipt.target.accreditationId,
        receipt.target.materialType,
        receipt.target.year
      ]
        .map(encodeURIComponent)
        .join('/')
    const headers = {
      Authorization: `Bearer ${process.env.OPERATOR_FRONTEND_SECRET || 'ra-622-spike-operator-frontend'}`
    }
    const readTarget = async () => {
      const response = await fetch(targetUrl, { headers })
      expect(response.status).toBe(200)
      return response.json()
    }
    const before = await readTarget()
    expect(before.activeRequest.requestId).toBe(receipt.requestId)
    expect(before.activeRequest.caseState).toBe('submitted')
    await browser.url(summary)
    await expect($('[data-testid="withdraw-ors-request"]')).toHaveText(
      'Withdraw request'
    )
    await new Page().clickReliably($('[data-testid="withdraw-ors-request"]'))
    await expect($('[data-testid="active-change-request"]')).not.toExist()
    await expect($('[data-testid="granted-status"]')).toHaveText('Granted')
    await expect($('[data-testid="accreditation-change"]')).toBeDisplayed()
    const history = $(
      `[data-testid="closed-change-request"][data-request-id="${receipt.requestId}"]`
    )
    await expect(history).toHaveText(expect.stringContaining('Withdrawn'))
    expect(await history.getAttribute('data-case-id')).toBe(receipt.caseId)
    expect(await history.getAttribute('data-site-id')).toBe(
      receipt.proposedSiteId
    )
    const readSiteEntries = () =>
      $$('[data-testid="approved-sites"] li').map((site) => site.getText())
    expect(await readSiteEntries()).toEqual(receipt.baselineSiteEntries)
    const closed = await readTarget()
    expect(closed.activeRequest).toBe(null)
    expect(closed.history).toHaveLength(before.history.length + 1)
    expect(
      closed.history.filter(
        (attempt) => attempt.requestId !== receipt.requestId
      )
    ).toEqual(before.history)
    expect(closed.approvedAdditions).toEqual(before.approvedAdditions)
    expect(closed.overseasSites).toEqual(before.overseasSites)
    expect(closed.status).toBe('Granted')
    await browser.refresh()
    await expect(history).toHaveText(expect.stringContaining('Withdrawn'))
    await expect($('[data-testid="withdraw-ors-request"]')).not.toExist()
    await $('[data-testid="accreditation-change"]').click()
    await new Page().clickReliably($('[data-testid="submit-ors-example"]'))
    await expect($('[data-testid="active-change-request"]')).toHaveText(
      expect.stringContaining('Submitted')
    )
    const nextRead = await readTarget()
    const next = nextRead.activeRequest
    for (const field of ['requestId', 'caseId', 'proposedSiteId']) {
      expect(next[field]).toMatch(/^[0-9a-f-]{36}$/i)
      expect(next[field]).not.toBe(receipt[field])
    }
    expect(next.caseState).toBe('submitted')
    expect(nextRead.history).toEqual(closed.history)
    expect(nextRead.approvedAdditions).toEqual(closed.approvedAdditions)
    const replay = await fetch(
      `${targetUrl}/requests/${receipt.requestId}/withdraw`,
      { method: 'POST', headers }
    )
    expect(replay.status).toBe(200)
    const replayed = await readTarget()
    expect(replayed.activeRequest.requestId).toBe(next.requestId)
    expect(replayed.activeRequest.caseId).toBe(next.caseId)
    expect(replayed.activeRequest.caseState).toBe('submitted')
    expect(replayed.history).toEqual(closed.history)
    expect(await readSiteEntries()).toEqual(receipt.baselineSiteEntries)
    await browser.refresh()
    await expect($('[data-testid="withdraw-ors-request"]')).toHaveText(
      'Withdraw request'
    )
    await writeFile(
      file,
      JSON.stringify({
        ...receipt,
        withdrawnRequest: {
          requestId: receipt.requestId,
          caseId: receipt.caseId,
          proposedSiteId: receipt.proposedSiteId
        },
        requestId: next.requestId,
        caseId: next.caseId,
        proposedSiteId: next.proposedSiteId,
        caseReference: next.caseReference,
        finalSiteCount: receipt.baselineSiteEntries.length
      }) + '\n'
    )
  })
})
