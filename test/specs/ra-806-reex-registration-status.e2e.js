import { browser, expect } from '@wdio/globals'
import LoginPage from 'page-objects/login.page'
import OperatorAccreditationPage from 'page-objects/operator-accreditation.page'
import ManageRegistrationAccreditationPage from 'page-objects/manage-registration-accreditation.page'
import ChangeRequestsPage from 'page-objects/change-requests.page'
import ErrorPage from 'page-objects/error.page'
import {
  APPROVED_REGISTRATION_ORG,
  CREATED_REGISTRATION_ORG
} from '../fixtures/reex-registration-status-orgs.js'
import { readSeededYear } from '../helpers/seeded-year.js'
import { skipDockerOnlyOnDeployedEnvironment } from '../helpers/docker-only.js'

// RA-806: the operator journey's copy of a registration
// (registrationVersions) takes its status from ReEx whenever an application
// is seeded. Before the fix the seed never copied ReEx's status, so every
// registration it wrote stayed Created and its in-year changes were refused.
// That passed unnoticed here because the dev seeds write their registrations
// as Approved. This spec's two orgs are in no dev seed: their registration is
// written only by the seed dual-write (DomainModel:DualWriteSeed, on in this
// stack as in test and prod), from the status the stub ReEx gives.
// Unit tests cover the mapping. This spec proves the status reaches the
// pages: an approved ReEx registration opens the manage pages and their
// change requests; a created one gets the service-problem page that the
// frontend shows for a registration that isn't Approved.
//
// Each org is used once, by its own test, so they don't race other specs.
describe('RA-806: a registration takes its status from ReEx when its application is seeded @docker-only', () => {
  before(function () {
    skipDockerOnlyOnDeployedEnvironment(this)
  })

  beforeEach(async () => {
    await browser.deleteCookies()
    await LoginPage.open()
    await browser.execute(() => {
      // eslint-disable-next-line no-undef
      localStorage.clear()
      // eslint-disable-next-line no-undef
      sessionStorage.clear()
    })
    await LoginPage.openOperatorLogin()
    await LoginPage.loginAsOperator()
  })

  afterEach(async () => {
    await LoginPage.signOut()
  })

  it('an approved ReEx registration opens the manage pages and their in-year change requests', async () => {
    const org = APPROVED_REGISTRATION_ORG

    await OperatorAccreditationPage.openLanding(org.accreditationPath)

    // The manage page renders, with its caption; no accreditation yet, so
    // the registration only.
    const year = await readSeededYear(org)
    const managePage = ManageRegistrationAccreditationPage
    await expect(managePage.registrationStatusTag).toHaveText('GRANTED')
    await expect(managePage.registrationNumber).toHaveText(
      org.registrationNumber
    )
    await expect(managePage.applicationStatusTag).not.toBeExisting()

    await ChangeRequestsPage.open(`${org.managePath}/change-requests`)
    await expect(ChangeRequestsPage.pageHeading).toHaveText(
      'In year change requests'
    )
    await expect(ChangeRequestsPage.pageCaption).toHaveText(
      `${org.organisationName} (${year}, ${org.material})`
    )
  })

  it('a created ReEx registration gets the service-problem page, not the manage pages', async () => {
    const org = CREATED_REGISTRATION_ORG

    await OperatorAccreditationPage.openLanding(org.accreditationPath)

    for (const path of [org.managePath, `${org.managePath}/change-requests`]) {
      await ManageRegistrationAccreditationPage.open(path)
      await expect(ErrorPage.serviceProblemHeading).toHaveText(
        'Sorry, there is a problem with the service'
      )
      await expect(ErrorPage.tryAgainLink).toHaveAttribute('href', path)
      await expect(
        ManageRegistrationAccreditationPage.registrationStatusTag
      ).not.toBeExisting()
    }
  })
})
