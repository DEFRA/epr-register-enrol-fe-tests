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
    return $('.govuk-grid-column-two-thirds p')
  }
}

export default new ErrorPage()
