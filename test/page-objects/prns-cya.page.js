import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class PrnsCyaPage extends Page {
  open(applicationId) {
    return super.open(`/accreditation/prns-cya/${applicationId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get summaryList() {
    return $('[data-testid="summary-list"]')
  }

  get tonnageValue() {
    return $('[data-testid="tonnage-value"]')
  }

  get authorisersValue() {
    return $('[data-testid="authorisers-value"]')
  }

  get changeTonnageLink() {
    return $('[data-testid="change-tonnage-link"]')
  }

  get changeAuthorityLink() {
    return $('[data-testid="change-authority-link"]')
  }

  get confirmButton() {
    return $('[data-testid="confirm-button"]')
  }

  get saveAndComeBackButton() {
    return $('[data-testid="save-come-back-button"]')
  }
}

export default new PrnsCyaPage()
