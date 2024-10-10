'use strict'

const { setTimeout } = require('timers/promises')

const debug = require('.')('metascraper')

debug('retry', { url: 'https://kikobeats.com' })
debug.info('done', { time: Date.now() })
debug.warn('token expired', { timestamp: Date.now() })
debug.error('whoops', { message: 'expected `number`, got `NaN`' })

const duration = debug.duration()

setTimeout(1001).then(() => duration.error('timeout!'))
setTimeout(1100).then(() => duration.info('success'))
