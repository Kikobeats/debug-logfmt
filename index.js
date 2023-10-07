'use strict'

const origDebug = require('debug')

/**
 * This methods override the default `formatArgs` to don't print diff information.
 */
if (process.env.DEBUG_COLORS === 'false') {
  origDebug.formatArgs = function formatArgs (args) {
    args[0] = this.namespace + ' ' + args[0]
  }
} else {
  origDebug.formatArgs = function formatArgs (args) {
    const colorCode = `\u001B[3${
      this.color < 8 ? this.color : `8;5;${this.color}`
    }`
    const prefix = `  ${colorCode};1m${this.namespace} \u001B[0m`
    args[0] = prefix + args[0].replace(/\n/g, `\n${prefix}`)
  }
}

const { encode } = require('@jclem/logfmt2')
const debug = require('debug-fabulous')(origDebug)

const LEVELS = ['info', 'warn', 'error']

const createLogger =
  log =>
  (...args) =>
    log(
      args.map(arg => (typeof arg === 'string' ? arg : encode(arg))).join(' ')
    )

module.exports = (env, { levels = LEVELS } = {}) => {
  const log = createLogger(debug(env))
  levels.forEach(level => (log[level] = createLogger(debug(`${env}:${level}`))))
  return log
}
