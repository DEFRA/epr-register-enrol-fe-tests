import { browser } from '@wdio/globals'

// Waits until the browser's URL satisfies predicate and returns that URL.
// The default timeout is generous because the slowest hops it guards (a
// sign-in hand-off, a virus scan's status page) are well over wdio's 10s
// waitforTimeout.
export async function waitForUrl(
  predicate,
  timeoutMsg,
  { timeout = 60000 } = {}
) {
  let url
  await browser.waitUntil(
    async () => {
      url = await browser.getUrl()
      return predicate(url)
    },
    { timeout, timeoutMsg }
  )
  return url
}
