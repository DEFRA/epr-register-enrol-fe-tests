import { browser } from '@wdio/globals'

// A <select> progressively enhanced into a GDS accessible-autocomplete
// <input> by a deferred JS module. Interacting before the enhancement lands
// hits the raw <select>, which doesn't accept typed text the way the
// enhanced widget does.
export async function waitForAutocomplete(input, { label = 'Field' } = {}) {
  await input.waitForDisplayed()
  await browser.waitUntil(async () => (await input.getTagName()) === 'input', {
    timeout: 10000,
    timeoutMsg: `${label} did not enhance into an autocomplete input`
  })
}

// Types value into an enhanced autocomplete, then blurs it.
// accessible-autocomplete only writes the typed value back into the
// underlying (POSTed) <select> on blur (confirmOnBlur, its default), and
// Page.clickReliably's JS-dispatched click on Continue doesn't reliably blur
// the previously focused input the way a real focus change does.
export async function enterAutocompleteValue(input, value) {
  await input.setValue(value)
  await browser.execute((el) => el.blur(), await input)
}
