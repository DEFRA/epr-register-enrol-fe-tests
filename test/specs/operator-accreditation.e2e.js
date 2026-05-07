import { expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'

describe('RA-102-A: Operator Accreditation Landing Page', () => {
  beforeEach(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('displays the application summary when navigating with org/site/material/year params', async () => {
    await OperatorAccreditationPage.open()
    await expect(OperatorAccreditationPage.applicationSummary).toBeDisplayed()
  })

  it('displays site name from the URL params', async () => {
    await OperatorAccreditationPage.open()
    const text = await OperatorAccreditationPage.siteName.getText()
    await expect(text).toContain('Stub Site Alpha')
  })

  it('displays material name in summary', async () => {
    await OperatorAccreditationPage.open()
    const text = await OperatorAccreditationPage.materialDisplay.getText()
    await expect(text).toContain('Plastic')
  })

  it('displays a status tag', async () => {
    await OperatorAccreditationPage.open()
    await expect(OperatorAccreditationPage.statusTag).toBeDisplayed()
  })

  it('displays the Re/Ex service back link', async () => {
    await OperatorAccreditationPage.open()
    await expect(OperatorAccreditationPage.reExBackLink).toBeDisplayed()
    const text = await OperatorAccreditationPage.reExBackLink.getText()
    await expect(text).toEqual('Return to Re/Ex service')
  })

  it('displays Continue button linking to task list', async () => {
    await OperatorAccreditationPage.open()
    await expect(OperatorAccreditationPage.continueButton).toBeDisplayed()
    const href = await OperatorAccreditationPage.continueButton.getAttribute('href')
    await expect(href).toContain('/accreditation/task-list/')
  })
})
