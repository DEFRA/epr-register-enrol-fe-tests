import { Page } from 'page-objects/page'

// Parts of a case management work item only the monorepo specs
// (test/specs/monorepo) use: the case header's payment and due dates, the
// actions that change them, Continue review, and the reprocessor's business
// plan and sampling plan values. The rest of the work item is CmWorkItemPage.
class CmWorkItemReviewPage extends Page {
  // Case header values: "Not received" / "—" until set, then dd MMM yyyy.
  get paymentDate() {
    return $('[data-testid="case-header-payment-date"]')
  }

  get dueDate() {
    return $('[data-testid="case-header-due-on"]')
  }

  get changePaymentDateLink() {
    return $('[data-testid="change-payment-date-link"]')
  }

  get changeDeterminationDeadlineLink() {
    return $('[data-testid="action-sla-extend"]')
  }

  // On an Updated work item: takes the operator's query response back into
  // review, after which a determination can be made.
  get continueReviewButton() {
    return $('[data-testid="action-continue-review"]')
  }

  get makeDeterminationLink() {
    return $('[data-testid="log-decision-cta"]')
  }

  get businessPlanValue() {
    return $('[data-testid="app-detail-value-business-plan"]')
  }

  get samplingPlanValue() {
    return $('[data-testid="app-detail-value-sampling-inspection-plan"]')
  }

  async startChangePaymentDate() {
    await this.clickReliably(this.changePaymentDateLink)
  }

  async startChangeDeterminationDeadline() {
    await this.clickReliably(this.changeDeterminationDeadlineLink)
  }

  async continueReview() {
    await this.clickReliably(this.continueReviewButton)
  }
}

export default new CmWorkItemReviewPage()
