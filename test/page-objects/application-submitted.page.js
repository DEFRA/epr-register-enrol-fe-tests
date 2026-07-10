import { Page } from 'page-objects/page'

class ApplicationSubmittedPage extends Page {
  get panel() {
    return $('.govuk-panel')
  }

  get panelTitle() {
    return $('.govuk-panel__title')
  }

  get panelBody() {
    return $('.govuk-panel__body')
  }

  get referenceNumber() {
    return $('.govuk-panel__body strong')
  }

  get viewInvoiceLink() {
    return $('a=View invoice')
  }

  get returnToHomeLink() {
    return $('a=Return to home page')
  }
}

export default new ApplicationSubmittedPage()
