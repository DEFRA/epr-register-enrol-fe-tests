import { $ } from '@wdio/globals'

/**
 * Types a date into a GOV.UK date input: three boxes with ids
 * "<idPrefix>-day", "<idPrefix>-month" and "<idPrefix>-year".
 *
 * @param {string} idPrefix the date input's id, e.g. payment-date
 * @param {Date} date
 */
export async function enterGovukDate(idPrefix, date) {
  const day = $(`#${idPrefix}-day`)
  await day.waitForDisplayed({ timeout: 30000 })
  await day.setValue(String(date.getDate()))
  await $(`#${idPrefix}-month`).setValue(String(date.getMonth() + 1))
  await $(`#${idPrefix}-year`).setValue(String(date.getFullYear()))
}
