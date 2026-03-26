import { browser, $ } from '@wdio/globals'

class Page {
  get pageHeading() {
    return $('h1')
  }

  get pageText() {
    return $('span.govuk-caption-m')
  }

  open(path) {
    return browser.url(path)
  }
}

export { Page }
