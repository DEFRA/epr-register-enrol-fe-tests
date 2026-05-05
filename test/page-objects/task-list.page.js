import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

class TaskListPage extends Page {
  open(applicationId) {
    return super.open(`/accreditation/task-list/${applicationId}`)
  }

  get pageHeading() {
    return $('[data-testid="page-heading"]')
  }

  get backLink() {
    return $('[data-testid="back-link"]')
  }

  get saveAndComeLaterLink() {
    return $('[data-testid="save-come-back-link"]')
  }

  get continueButton() {
    return $('[data-testid="continue-button"]')
  }

  get prnsTaskLink() {
    return $('[data-testid="task-prns-link"]')
  }

  get prnsTaskStatus() {
    return $('[data-testid="task-prns-tag"]')
  }

  get businessPlanTaskStatus() {
    return $('[data-testid="task-business-plan-tag"]')
  }
}

export default new TaskListPage()
