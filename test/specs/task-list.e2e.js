import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import MaterialSelectionPage from 'page-objects/material-selection.page'
import TaskListPage from 'page-objects/task-list.page'

describe('RA-104: Accreditation Task List Hub', () => {
  let applicationId

  before(async () => {
    await LoginPage.open()
    await LoginPage.switchToOperator()
    await LoginPage.loginAsUser()

    // Seed an application via the material selection flow to get a real applicationId
    await MaterialSelectionPage.open()
    await MaterialSelectionPage.selectMaterial('Steel')
    await MaterialSelectionPage.continueButton.click()

    const url = await browser.getUrl()
    const match = url.match(/\/accreditation\/task-list\/([^/?]+)/)
    applicationId = match ? match[1] : null
  })

  after(async () => {
    await LoginPage.signOut()
  })

  it('Should display task list heading with material type', async () => {
    await TaskListPage.open(applicationId)
    const heading = await TaskListPage.pageHeading.getText()
    await expect(heading).toContain('Accredit to issue PRNs')
    await expect(heading).toContain('Steel')
    await expect(heading).toContain('packaging waste')
  })

  it('Should display back link to operator accreditation page', async () => {
    await TaskListPage.open(applicationId)
    const href = await TaskListPage.backLink.getAttribute('href')
    await expect(href).toContain('/operator-accreditation')
  })

  it('Should display save-and-come-back-later link to operator accreditation page', async () => {
    await TaskListPage.open(applicationId)
    await expect(TaskListPage.saveAndComeBackLink).toBeDisplayed()
    const href = await TaskListPage.saveAndComeBackLink.getAttribute('href')
    await expect(href).toContain('/operator-accreditation')
  })

  it('Should display all three task rows', async () => {
    await TaskListPage.open(applicationId)
    await expect(TaskListPage.prnsTask).toBeDisplayed()
    await expect(TaskListPage.businessPlanTask).toBeDisplayed()
    await expect(TaskListPage.samplingPlanTask).toBeDisplayed()
  })

  it('Should show NOT STARTED tags for all sections on a fresh application', async () => {
    await TaskListPage.open(applicationId)
    const prnsTagText = await TaskListPage.prnsTag.getText()
    const bpTagText = await TaskListPage.businessPlanTag.getText()
    const spTagText = await TaskListPage.samplingPlanTag.getText()

    await expect(prnsTagText).toEqual('NOT STARTED')
    await expect(bpTagText).toEqual('NOT STARTED')
    await expect(spTagText).toEqual('NOT STARTED')
  })

  it('Should have a clickable link for the PRNs task', async () => {
    await TaskListPage.open(applicationId)
    await expect(TaskListPage.prnsLink).toBeDisplayed()
    const href = await TaskListPage.prnsLink.getAttribute('href')
    await expect(href).toContain('/accreditation/prns-tonnage/')
  })

  it('Should not have a clickable link for the locked business plan task', async () => {
    await TaskListPage.open(applicationId)
    const bpLink = await TaskListPage.businessPlanLink
    await expect(bpLink).not.toBeDisplayed()
  })

  it('Should not have a clickable link for the locked sampling plan task', async () => {
    await TaskListPage.open(applicationId)
    const spLink = await TaskListPage.samplingPlanLink
    await expect(spLink).not.toBeDisplayed()
  })

  it('Should not show Continue button when sections are incomplete', async () => {
    await TaskListPage.open(applicationId)
    await expect(TaskListPage.continueButton).not.toBeDisplayed()
  })

  it('Should display year metadata', async () => {
    await TaskListPage.open(applicationId)
    await expect(TaskListPage.metadataYear).toBeDisplayed()
    const yearText = await TaskListPage.metadataYear.getText()
    await expect(yearText).toMatch(/^\d{4}$/)
  })

  it('Should navigate to PRNs tonnage page when clicking PRNs task link', async () => {
    await TaskListPage.open(applicationId)
    await TaskListPage.prnsLink.click()
    const url = await browser.getUrl()
    await expect(url).toContain('/accreditation/prns-tonnage/')
  })
})
