'use strict'

const origDebug = require('debug')

const timeSpan = require('@kikobeats/time-span')({
  format: require('pretty-ms')
})

const encode = require('./encode')

/**
 * This methods override the default `formatArgs` to don't print diff information.
 */
if (process.env.DEBUG_COLORS === 'false') {
  origDebug.formatArgs = function formatArgs (args) {
    args[0] = this.namespace + ' ' + args[0]
  }
} else {
  origDebug.formatArgs = function formatArgs (args) {
    const colorCode = `\u001B[3${this.color < 8 ? this.color : `8;5;${this.color}`}`
    const prefix = `  ${colorCode};1m${this.namespace} \u001B[0m`
    args[0] = prefix + args[0].replace(/\n/g, `\n${prefix}`)
  }
}

const createDebug = require('./lazy')(origDebug)

const LEVELS = ['info', 'warn', 'error']

const createLogger =
  log =>
    (...args) =>
      log(
        args.reduce((result, arg, index) => {
          const encoded = typeof arg === 'string' ? arg : encode(arg)
          if (!encoded) return result
          return result + (index > 0 ? ' ' : '') + encoded
        }, '')
      )

module.exports = (env, { levels = LEVELS } = {}) => {
  const debug = createLogger(createDebug(env))
  levels.forEach(level => (debug[level] = createLogger(createDebug(`${env}:${level}`))))

  debug.duration = (...args) => {
    const duration = timeSpan()

    const create =
      type =>
        (...opts) => {
          ;(type ? debug[type] : debug)(...args, ...opts, {
            duration: duration()
          })
          return true
        }

    const fn = create()
    fn.error = create('error')
    fn.info = create('info')

    return fn
  }

  return debug
}
