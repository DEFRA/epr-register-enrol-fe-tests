import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorPage from 'page-objects/operator.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'

describe('RA-102: Operator Accreditation Landing Page', () => {
  beforeEach(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('Should display the accreditation landing page heading', async () => {
    await OperatorPage.navigateToOperatorAccreditation()
    const heading = await OperatorAccreditationPage.pageHeading.getText()
    await expect(heading).toEqual('Accreditation applications')
  })

  it('Should display Re/Ex service back link', async () => {
    await OperatorAccreditationPage.open()
    const backLink = OperatorAccreditationPage.reExBackLink
    await expect(backLink).toBeDisplayed()
    const text = await backLink.getText()
    await expect(text).toEqual('Return to Re/Ex service')
  })

  it('Should display start-new CTA when operator has no applications', async () => {
    await OperatorAccreditationPage.open()
    const startNewLink = await OperatorAccreditationPage.startNewLink
    await expect(startNewLink).toBeDisplayed()
    const text = await startNewLink.getText()
    await expect(text).toEqual('Start new accreditation application')
  })

  it('Should navigate to material selection from start-new CTA', async () => {
    await OperatorAccreditationPage.open()
    await OperatorAccreditationPage.startNewLink.click()
    const url = await browser.getUrl()
    await expect(url).toContain('/accreditation/material-selection')
  })
})
