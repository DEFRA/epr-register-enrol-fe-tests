import { browser } from '@wdio/globals'
import { Page } from 'page-objects/page'

class BusinessPlanDetailPage extends Page {
  get pageHeading() {
    return $('h1')
  }

  get textareas() {
    return $$('.govuk-textarea')
  }

  get errorSummary() {
    return $('[data-testid="error-summary"]')
  }

  get errorSummaryTitle() {
    return $('[data-testid="error-summary"] .govuk-error-summary__title')
  }

  get errorLinks() {
    return $$('[data-testid="error-summary"] .govuk-error-summary__list li a')
  }

  // RA-268: the per-FIELD error message govukCharacterCount renders inline
  // (controller.js#buildTextareaInputs sets data-testid="field-error-{id}"
  // on it). Distinct from errorSummary above: the live-clearing fix in
  // application.js only ever removes this element once the field's own
  // value is back within the 500-character limit — it never touches the
  // error summary, which stays as it was until the next real submit.
  fieldError(fieldId) {
    return $(`[data-testid="field-error-${fieldId}"]`)
  }

  async textareaFor(fieldId) {
    return $(`[data-testid="textarea-${fieldId}"]`)
  }

  // The live "X characters remaining"/"too many" status govuk-frontend's own
  // CharacterCount module writes into (the govukHint with id "{id}-info" —
  // see govuk-frontend's character-count component). Reading this alongside
  // fieldError() is what proves the real component is driving both the live
  // count AND, via application.js, the field error's own removal — not just
  // that the error happened to disappear for some unrelated reason.
  countMessageFor(fieldId) {
    return $(`#${fieldId}-info`)
  }

  get saveAndContinueButton() {
    return $('button=Save and continue')
  }

  get saveAndComeLaterButton() {
    return $('[data-testid="save-come-back-button"]')
  }

  async fillDescriptions(
    text = 'Investment in reprocessing infrastructure and equipment to improve capacity and quality.'
  ) {
    const areas = await this.textareas
    for (const area of areas) {
      if (await area.isDisplayed()) {
        await area.scrollIntoView()
        // Use JS to bypass maxlength attribute so over-500 strings can be set
        await browser.execute(
          (el, val) => {
            el.value = val
          },
          area,
          text
        )
      }
    }
  }

  async saveAndContinue() {
    await this.clickReliably(this.saveAndContinueButton)
  }

  async saveAndComeLater() {
    await this.clickReliably(this.saveAndComeLaterButton)
  }
}

export default new BusinessPlanDetailPage()
