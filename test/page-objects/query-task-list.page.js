import { Page } from 'page-objects/page'

class QueryTaskListPage extends Page {
  open(appId) {
    return super.open(`/accreditation/query-task-list/${appId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get regulatorQueryBanner() {
    return $('[data-testid="regulator-query-banner"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  taskLink(testId) {
    return $(`[data-testid="${testId}-link"]`)
  }

  taskTag(testId) {
    return $(`[data-testid="${testId}-tag"]`)
  }

  async continueToDeclaration() {
    await this.clickReliably(this.continueButton)
  }
}

export default new QueryTaskListPage()
