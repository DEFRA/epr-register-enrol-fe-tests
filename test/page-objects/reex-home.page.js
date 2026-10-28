import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { reexFrontendUrl } from '../config.js'

// The organisation home page on the Re-Ex frontend, reached straight after
// sign-in. It carries two tabs — Reprocessing (the default) and Exporting —
// each listing the organisation's materials with their registration and
// accreditation status, and a "Select" link per material.
//
// Reprocessing groups its materials under an <h3> per site; Exporting has no
// site grouping at all (an exporter accredits against overseas sites, not a UK
// one), so `site` is null for every exporter row.
class ReexHomePage extends Page {
  // Located by href rather than tab text: wdio's `*=` partial-text syntax only
  // accepts a bare tag name in front of it, so `.govuk-tabs__tab*=Exporting`
  // is rejected by the driver as an invalid selector. Reprocessing is the
  // organisation page itself and Exporting is the one page below it, which
  // makes the two hrefs a cleaner discriminator than the text anyway.
  get reprocessingTab() {
    return $('.govuk-tabs__tab:not([href$="/exporting"])')
  }

  get exportingTab() {
    return $('.govuk-tabs__tab[href$="/exporting"]')
  }

  get tabPanel() {
    return $('.govuk-tabs__panel')
  }

  async waitUntilLoaded() {
    await this.tabPanel.waitForDisplayed({ timeout: 30000 })
  }

  async openReprocessing() {
    await this.clickReliably(this.reprocessingTab)
    await this.waitUntilLoaded()
  }

  async openExporting() {
    await this.clickReliably(this.exportingTab)
    await this.waitUntilLoaded()
  }

  /**
   * Reads every material row on the currently open tab.
   *
   * Done as one in-page read rather than a WebDriver round trip per cell:
   * the grid runs to 24 rows on the dev seed data and the caller only needs
   * the text, so per-element commands would cost minutes to no benefit.
   *
   * @returns {Promise<Array<{site: string|null, material: string,
   *   registration: string, accreditation: string, href: string|null}>>}
   */
  async materialRows() {
    await this.waitUntilLoaded()
    return browser.execute(() => {
      const panel = document.querySelector('.govuk-tabs__panel')
      const rows = []
      let site = null

      for (const element of panel.querySelectorAll('h3, table')) {
        if (element.tagName === 'H3') {
          site = element.innerText.trim()
          continue
        }
        for (const row of element.querySelectorAll('tbody tr')) {
          const cells = [...row.querySelectorAll('td')].map((cell) =>
            cell.innerText.trim()
          )
          rows.push({
            site,
            material: cells[0],
            registration: cells[1],
            accreditation: cells[2],
            href: row.querySelector('a')?.getAttribute('href') ?? null
          })
        }
      }
      return rows
    })
  }

  async openMaterial(row) {
    await browser.url(`${reexFrontendUrl}${row.href}`)
  }
}

export default new ReexHomePage()
