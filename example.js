'use strict'

const { setTimeout } = require('timers/promises')
const debug = require('.')

const log = debug('metascraper')

log('retry', { url: 'https://kikobeats.com' })
log.info('done', { time: Date.now() })
log.warn('token expired', { timestamp: Date.now() })
log.error('whoops', { message: 'expected `number`, got `NaN`' })

const duration = log.duration()
setTimeout(1001).then(() => duration.info())
