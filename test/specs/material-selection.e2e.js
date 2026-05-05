import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import MaterialSelectionPage from 'page-objects/material-selection.page'

describe('RA-103: Material Selection Page', () => {
  beforeEach(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('Should display the material selection page heading', async () => {
    await MaterialSelectionPage.open()
    const heading = await MaterialSelectionPage.pageHeading.getText()
    await expect(heading).toEqual('Which material is this application for?')
  })

  it('Should display back link to operator accreditation page', async () => {
    await MaterialSelectionPage.open()
    const backLink = MaterialSelectionPage.backLink
    await expect(backLink).toBeDisplayed()
    const href = await backLink.getAttribute('href')
    await expect(href).toContain('/operator-accreditation')
  })

  it('Should show all 7 material radio options', async () => {
    await MaterialSelectionPage.open()
    await expect(MaterialSelectionPage.steelRadio).toBeDisplayed()
    await expect(MaterialSelectionPage.woodRadio).toBeDisplayed()
    await expect(MaterialSelectionPage.aluminiumRadio).toBeDisplayed()
    await expect(MaterialSelectionPage.fibreRadio).toBeDisplayed()
    await expect(MaterialSelectionPage.glassRadio).toBeDisplayed()
    await expect(MaterialSelectionPage.paperRadio).toBeDisplayed()
    await expect(MaterialSelectionPage.plasticRadio).toBeDisplayed()
  })

  it('Should show validation error when Continue clicked with no selection', async () => {
    await MaterialSelectionPage.open()
    await MaterialSelectionPage.continueButton.click()
    await expect(MaterialSelectionPage.errorSummary).toBeDisplayed()
    await expect(MaterialSelectionPage.fieldError).toBeDisplayed()
    const errorText = await MaterialSelectionPage.fieldError.getText()
    await expect(errorText).toContain('Select a material for this application')
  })

  it('Should navigate to task list after selecting Steel', async () => {
    await MaterialSelectionPage.open()
    await MaterialSelectionPage.selectMaterial('Steel')
    await MaterialSelectionPage.continueButton.click()
    const url = await browser.getUrl()
    await expect(url).toContain('/accreditation/task-list')
  })
})
