import { browser, $, $$, expect } from '@wdio/globals'
import { readFile, writeFile } from 'node:fs/promises'
import { Page } from '../page-objects/page.js'

const summary =
  '/granted-accreditation/50006/aaa000000000000000050006/reex-acc-50006-Glass-2026/Glass/2026'

const readSiteEntries = () =>
  $$('[data-testid="approved-sites"] li').map((site) => site.getText())

describe('RA-622 actual approval readback and repeated prepared ORS additions', () => {
  before(async function () {
    if (process.env.RA_622_SPIKE_TESTS !== 'true') {
      this.skip()
    }
    await browser.deleteCookies()
    await browser.url('/auth/stub/login')
    await $('input[type="radio"]').click()
    await new Page().clickReliably($('button.govuk-button'))
  })

  it('adds one entry per approved request, retains earlier entries and restores Change without resetting data', async () => {
    const file = process.env.RA_622_SPIKE_RECEIPT_FILE
    if (!file) {
      throw new Error(
        'Set RA_622_SPIKE_RECEIPT_FILE to the actual submission receipt.'
      )
    }
    const receipt = JSON.parse(await readFile(file, 'utf8'))
    const approvedRequests = [
      ...(receipt.approvedRequests || []),
      {
        requestId: receipt.requestId,
        caseId: receipt.caseId,
        proposedSiteId: receipt.proposedSiteId
      }
    ]
    const readTarget = async () => {
      const response = await fetch(
        `${process.env.OPERATOR_BACKEND_URL || 'http://localhost:5000'}/api/v1/accreditation-changes/${receipt.target.organisationId}/${receipt.target.registrationId}/${receipt.target.accreditationId}/${receipt.target.materialType}/${receipt.target.year}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPERATOR_FRONTEND_SECRET || 'ra-622-spike-operator-frontend'}`
          }
        }
      )
      expect(response.status).toBe(200)
      return response.json()
    }
    await browser.url(summary)
    await expect($('[data-testid="active-change-request"]')).not.toExist()
    await expect($('[data-testid="granted-status"]')).toHaveText('Granted')
    await expect($('[data-testid="accreditation-change"]')).toBeDisplayed()
    const entries = await readSiteEntries()
    expect(entries).toHaveLength(
      receipt.baselineSiteEntries.length + approvedRequests.length
    )
    expect(entries.slice(0, receipt.baselineSiteEntries.length)).toEqual(
      receipt.baselineSiteEntries
    )
    for (const request of approvedRequests) {
      const history = $(
        `[data-testid="closed-change-request"][data-request-id="${request.requestId}"]`
      )
      await expect(history).toHaveText(expect.stringContaining('Granted'))
      expect(await history.getAttribute('data-case-id')).toBe(request.caseId)
      expect(await history.getAttribute('data-site-id')).toBe(
        request.proposedSiteId
      )
      const site = $(
        `[data-testid="approved-ors-addition"][data-site-id="${request.proposedSiteId}"]`
      )
      await expect(site).toHaveText(
        'Spike Glass Recycling — 25 Example Road, Hamburg, Germany'
      )
      expect(await site.getAttribute('data-request-id')).toBe(request.requestId)
    }
    const read = await readTarget()
    expect(read.activeRequest).toBe(null)
    expect(read.status).toBe('Granted')
    for (const request of approvedRequests) {
      expect(
        read.approvedAdditions.filter(
          (site) => site.siteId === request.proposedSiteId
        )
      ).toHaveLength(1)
    }
    await browser.refresh()
    expect(await readSiteEntries()).toEqual(entries)
    if (process.env.RA_622_SPIKE_PHASE === 'approval-repeat') {
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
        for (const earlier of approvedRequests) {
          expect(next[field]).not.toBe(earlier[field])
        }
      }
      const submitted = await readTarget()
      expect(submitted.activeRequest.requestId).toBe(next.requestId)
      expect(submitted.approvedAdditions).toEqual(read.approvedAdditions)
      expect(submitted.history).toEqual(read.history)
      expect(await readSiteEntries()).toEqual(entries)
      await expect($('[data-testid="accreditation-change"]')).not.toExist()
      await writeFile(
        file,
        JSON.stringify({
          ...receipt,
          ...next,
          approvedRequests,
          caseReference: submitted.activeRequest.caseReference
        }) + '\n'
      )
    } else {
      expect(approvedRequests).toHaveLength(2)
      await writeFile(
        file,
        JSON.stringify({
          ...receipt,
          approvedRequests,
          finalSiteCount: entries.length
        }) + '\n'
      )
    }
  })
})
