import { Page } from 'page-objects/page'

class OrgDetailsPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get pageBody() {
    return $(".govuk-body[data-testid='app-page-body']")
  }

  get orgDetailsList() {
    return $$(".govuk-body[data-testid='app-page-body'] ul li")
  }

  get summaryKeys() {
    return $$('.govuk-summary-list__key')
  }

  get summaryValues() {
    return $$('.govuk-summary-list__value')
  }

  get organisationId() {
    return $('[data-testid="organisation-id"]')
  }

  get companyName() {
    return $('[data-testid="company-name"]')
  }

  get registrationNumber() {
    return $('[data-testid="registration-number"]')
  }

  get businessType() {
    return $('[data-testid="business-type"]')
  }

  get contact() {
    return $('[data-testid="contact"]')
  }

  async getSummaryItems() {
    const keys = await this.summaryKeys
    const values = await this.summaryValues
    const items = {}
    let lastKey = ''
    for (const [index, key] of keys.entries()) {
      const keyText = await key.getText()
      const valueText = await values[index].getText()
      if (keyText) {
        lastKey = keyText
        items[lastKey] = valueText
      } else {
        items[lastKey] = items[lastKey]
          ? items[lastKey] + '\n' + valueText
          : valueText
      }
    }
    return items
  }
}

export default new OrgDetailsPage()
