import { browser } from '@wdio/globals'

// RA-603, RA-425: an ORS's interim sites sit behind a collapsed
// "Show interim sites (n)" govuk-details, one per ORS, rendered by the same
// shared macro on select-overseas-sites and on the read-only
// manage/overseas-sites page. Mixed into both page objects rather than
// duplicated so the two can't drift apart.
//
// The disclosure selectors take the PARENT ORS's id; the row selectors take
// the INTERIM site's own id, which is unique application-wide. A physical site
// used by several ORSs has a separate copy, with its own id, under each.
const withInterimSiteDisclosure = (Base) =>
  class extends Base {
    interimSiteRow(interimSiteId) {
      return $(`[data-testid="interim-site-row-${interimSiteId}"]`)
    }

    interimSiteNameValue(interimSiteId) {
      return $(`[data-testid="interim-site-name-${interimSiteId}"]`)
    }

    interimSiteDisclosure(siteId) {
      return $(`[data-testid="interim-sites-disclosure-${siteId}"]`)
    }

    interimSiteDisclosureSummary(siteId) {
      return $(`[data-testid="interim-sites-disclosure-summary-${siteId}"]`)
    }

    // One interim site's row within one ORS's disclosure.
    interimSiteRowIn(siteId, interimSiteId) {
      return this.interimSiteDisclosure(siteId).$(
        `[data-testid="interim-site-row-${interimSiteId}"]`
      )
    }

    // The interim-site ids listed under ONE ORS, in page order. Read within
    // that ORS's own <details>, never page-wide: the accreditation is shared
    // between specs and mongo is not reset between runs, so a page-wide read
    // also counts other ORSs' and other tests' interim sites - which is what
    // once made ra-603's `toHaveLength(2)` receive 4, then 8 on a second run.
    async interimSiteIdsIn(siteId) {
      await this.openInterimSiteDisclosure(siteId)

      const rows = await this.interimSiteDisclosure(siteId).$$(
        '[data-testid^="interim-site-row-"]'
      )

      const interimSiteIds = []
      for (const row of [...rows]) {
        interimSiteIds.push(
          (await row.getAttribute('data-testid')).replace(
            'interim-site-row-',
            ''
          )
        )
      }
      return interimSiteIds
    }

    // Idempotent — safe to call on an already-open disclosure, which matters
    // because the <details> re-renders collapsed after every POST (the open
    // state is not persisted server-side), so a journey that removes or
    // changes an interim site has to re-open it afterwards.
    //
    // Waits on the <details> `open` property rather than on the row being
    // displayed, because "displayed" does not mean the same thing across
    // browsers here: Chrome 123 (what CI runs) hides closed details content
    // with the UA stylesheet's `display: none`, while newer Chromium lays it
    // out via `content-visibility: hidden` and reports a real box for it.
    // `open` is the one signal that reads identically on both.
    async openInterimSiteDisclosure(siteId) {
      const details = this.interimSiteDisclosure(siteId)
      await details.waitForExist()
      await details.scrollIntoView()

      if (!(await details.getProperty('open'))) {
        await this.interimSiteDisclosureSummary(siteId).click()
      }

      await browser.waitUntil(() => details.getProperty('open'), {
        timeoutMsg: `Interim sites disclosure for site ${siteId} did not open`
      })
    }
  }

export { withInterimSiteDisclosure }
