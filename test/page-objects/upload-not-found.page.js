import { Page } from 'page-objects/page'

// The page every upload status route renders in place of the polling status
// page once the backend no longer has a record of the upload (it expired, or
// never started there): shared by the sampling plan and BES evidence journeys.
class UploadNotFoundPage extends Page {
  get pageHeading() {
    return $('[data-testid="upload-not-found-heading"]')
  }

  get message() {
    return $('[data-testid="upload-not-found-message"]')
  }

  get uploadAgainLink() {
    return $('[data-testid="upload-again-link"]')
  }

  // The status page's meta refresh is how it polls; its absence is how the
  // operator stops being sent round the status check again.
  get metaRefresh() {
    return $('meta[http-equiv="refresh"]')
  }
}

export default new UploadNotFoundPage()
