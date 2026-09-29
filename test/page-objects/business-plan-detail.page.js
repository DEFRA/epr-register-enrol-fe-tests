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
  // CharacterCount module writes into.
  //
  // NOT the "{id}-info" element — that id stays on the ORIGINAL server-
  // rendered govukHint (the static "You can enter up to 500 characters"
  // line). CharacterCount's constructor reads that element once to find
  // where to attach, then creates a SEPARATE new sibling — class
  // govuk-character-count__status, no id of its own — immediately after it
  // and hides the original with govuk-visually-hidden (see govuk-frontend's
  // character-count.mjs). That new sibling is the one whose text actually
  // updates live; reading "{id}-info" instead reads the hidden, frozen
  // original and always sees the pre-enhancement static text. Confirmed
  // against the component source after CI caught this getter reading the
  // wrong element.
  countMessageFor(fieldId) {
    return $(`#${fieldId}-info + .govuk-character-count__status`)
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
