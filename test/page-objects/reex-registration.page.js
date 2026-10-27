import { Page } from 'page-objects/page'

// A single site/material registration page on the Re-Ex frontend. Its
// "Registration and accreditation" task offers an "apply for <year>
// accreditation" link, which is the hand-off into epr-register-enrol-frontend
// (a different origin) — the only route in, since deep-linking the
// register-enrol URL directly has no session there and bounces back to
// the Re-Ex start page.
//
// The link is only rendered for a material that is actually accredited and
// whose reapplication window for that year is open, so its absence is the
// signal to try another material rather than a failure.
class ReexRegistrationPage extends Page {
  applyForAccreditationLink(year) {
    return $(`a*=apply for ${year} accreditation`)
  }

  async hasApplyForAccreditationLink(year) {
    return this.applyForAccreditationLink(year).isExisting()
  }

  async applyForAccreditation(year) {
    const link = this.applyForAccreditationLink(year)
    await link.waitForDisplayed({ timeout: 30000 })
    await this.clickReliably(link)
  }
}

export default new ReexRegistrationPage()
