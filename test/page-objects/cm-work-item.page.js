import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'
import { caseManagementFrontendUrl } from '../config.js'

// A single work item in case management: the case header, the application
// summary tab and the actions panel.
class CmWorkItemPage extends Page {
  open(workItemId) {
    return browser.url(`${caseManagementFrontendUrl}/work-items/${workItemId}`)
  }

  get material() {
    return $('[data-testid="case-header-material"]')
  }

  get stateTag() {
    return $('[data-testid="work-item-state-tag"]')
  }

  get reference() {
    return $('[data-testid="case-header-accreditation-ref"]')
  }

  get notificationBanner() {
    return $('.govuk-notification-banner')
  }

  get assignToYourselfButton() {
    return $('[data-testid="self-assign-submit"]')
  }

  get dulyMakeLink() {
    return $('[data-testid="duly-make-cta"]')
  }

  get queryLink() {
    return $('[data-testid="action-query"]')
  }

  get overseasSitesValue() {
    return $('[data-testid="app-detail-value-ors"]')
  }

  get overseasSiteNames() {
    return $$('[data-testid="overseas-site-name"]')
  }

  get interimSiteNames() {
    return $$('[data-testid="interim-site-name"]')
  }

  // textContent, not getText(): the interim-site block nested inside the ORS
  // section is not rendered as visible text, so innerText — which getText() and
  // toHaveText() both use — comes back without it, even though the site name
  // and address are present in the markup.
  async overseasSitesText() {
    await this.overseasSitesValue.waitForExist({ timeout: 30000 })
    return browser.execute(
      (el) => el.textContent.replace(/\s+/g, ' ').trim(),
      await this.overseasSitesValue
    )
  }

  // Green flash banner shown after an action — duly making, sending a query,
  // logging a determination.
  get flashBanner() {
    return $('[data-testid="work-item-flash-banner"]')
  }

  get makeDeterminationLink() {
    return $('[data-testid="log-decision-cta"]')
  }

  // Accreditation id and start date, rendered only once a decision is logged.
  get decisionMetadata() {
    return $('[data-testid="re-accreditation-decision-metadata"]')
  }

  async startDetermination() {
    await this.clickReliably(this.makeDeterminationLink)
  }

  get besValue() {
    return $('[data-testid="app-detail-value-bes"]')
  }

  async waitUntilLoaded() {
    await this.stateTag.waitForDisplayed({ timeout: 30000 })
  }

  async startDulyMaking() {
    await this.clickReliably(this.dulyMakeLink)
  }

  async startQuery() {
    await this.clickReliably(this.queryLink)
  }
}

export default new CmWorkItemPage()
