'use strict'

const logfmt = require('logfmt')
const debug = require('debug')

const LEVELS = ['info', 'warn', 'error']

const createLogger = log => (...args) =>
  log(
    args
      .map(arg => (typeof arg === 'string' ? arg : logfmt.stringify(arg)))
      .join(' ')
  )

module.exports = (env, { levels = LEVELS } = {}) => {
  const log = createLogger(debug(env))
  levels.forEach(level => (log[level] = createLogger(debug(`${env}:${level}`))))
  return log
}
