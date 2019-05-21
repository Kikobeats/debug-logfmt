const debug = require('.')

const log = debug('metascraper')

log('retry', { url: 'https://kikobeats.com' })
log.info('done', { time: Date.now() })
log.warn('token expired', { timestamp: Date.now() })
log.error('whoops', { message: 'expected `number`, got `NaN`' })
