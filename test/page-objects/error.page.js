import { $ } from '@wdio/globals'
import { Page } from 'page-objects/page'

// The service's generic error view (src/server/error/index.njk in
// epr-register-enrol-frontend, rendered by common/helpers/errors.js). It puts
// the status code in the heading and the human-readable reason in the body, and
// uses the shared appHeading component — hence the app-heading-title testid
// rather than the landing pages' page-heading.
class ErrorPage extends Page {
  get statusCode() {
    return $('[data-testid="app-heading-title"]')
  }

  get message() {
    return $('main .govuk-grid-column-two-thirds p')
  }

  // The manage pages' "Sorry, there is a problem with the service" page
  // (src/server/errors/service-problem.njk in epr-register-enrol-frontend).
  get serviceProblemHeading() {
    return $('[data-testid="service-problem-heading"]')
  }

  get tryAgainLink() {
    return $('[data-testid="try-again-link"]')
  }
}

export default new ErrorPage()
