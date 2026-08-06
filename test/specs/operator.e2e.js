import { browser } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'

describe('Operator Journey', () => {
  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.switchToOperator()
    await LoginPage.loginAsOperator()
    await OperatorPage.open()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('Should be able to apply for a new registration', async () => {
    await OperatorPage.navigateToOperatorRegistration()
    const headerText = await OperatorPage.pageHeading.getText()
    await expect(headerText).toEqual('Operator Registration')
  })

  it('Should be able to renew registration', async () => {
    await OperatorPage.navigateToOperatorRegistration()
    const headerText = await OperatorPage.pageHeading.getText()
    await expect(headerText).toEqual('Operator Registration')
  })

  it('Should render the footer support links with the correct hrefs', async () => {
    await expect(OperatorPage.footerContactLink).toHaveAttribute(
      'href',
      '/contact'
    )
    await expect(OperatorPage.footerPrivacyLink).toHaveAttribute(
      'href',
      'https://www.gov.uk/guidance/extended-producer-responsibility-for-packaging-privacy-policy'
    )
    await expect(OperatorPage.footerCookiesLink).toHaveAttribute(
      'href',
      '/cookies'
    )
    await expect(OperatorPage.footerAccessibilityLink).toHaveAttribute(
      'href',
      'https://www.gov.uk/guidance/extended-producer-responsibility-for-packaging-accessibility-statement'
    )
  })
})
