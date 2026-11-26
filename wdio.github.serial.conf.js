import { config as githubConfig } from './wdio.github.conf.js'

// The specs in test/serial-specs, run one at a time after the parallel run
// (npm run test:github:serial, from run-journey-tests). They change state
// every other spec shares, such as a MongoDB fail point, so nothing else may
// run alongside them. No other config picks them up.
export const config = {
  ...githubConfig,
  specs: ['./test/serial-specs/**/*.js'],
  exclude: [],
  maxInstances: 1
}
