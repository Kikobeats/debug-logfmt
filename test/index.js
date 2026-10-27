'use strict'

const stripAnsi = require('strip-ansi')
const $ = require('tinyspawn')
const test = require('ava')

test('null is serialized as empty string', async t => {
  const { stderr } = await $('node', ['-e', "require('.')('test')({ value: null })"], {
    env: { ...process.env, DEBUG: 'test' }
  })

  t.is(stripAnsi(stderr), 'test value=null')
})

test('undefined is serialized as empty string', async t => {
  const { stderr } = await $('node', ['-e', "require('.')('test')({ value: undefined })"], {
    env: { ...process.env, DEBUG: 'test' }
  })

  t.is(stripAnsi(stderr), 'test value=undefined')
})

test('deleted falsy valuesnot passed as object', async t => {
  {
    const { stderr } = await $(
      'node',
      ['-e', "require('.')('test')({ foo:'bar'}, null, '', undefined)"],
      {
        env: { ...process.env, DEBUG: 'test' }
      }
    )
    t.is(stripAnsi(stderr), 'test foo=bar')
  }
  {
    const { stderr } = await $('node', ['-e', "require('.')('test')({ foo:'bar'}, false)"], {
      env: { ...process.env, DEBUG: 'test' }
    })
    t.is(stripAnsi(stderr), 'test foo=bar')
  }
})

test('disabled logger should not evaluate object getters', async t => {
  const { stdout } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('.')('test')
      let calls = 0
      debug({ get value () { calls += 1; return 'ok' } })
      process.stdout.write(String(calls))
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, '0')
})

test('duration should not create timer when logger is disabled', async t => {
  const { stdout } = await $(
    'node',
    [
      '-e',
      `
      const Module = require('module')
      const originalLoad = Module._load
      let timerCalls = 0

      Module._load = function (request, parent, isMain) {
        if (request === '@kikobeats/time-span') {
          return () => () => {
            timerCalls += 1
            return () => '0ms'
          }
        }
        return originalLoad.call(this, request, parent, isMain)
      }

      const debug = require('.')('test')
      const duration = debug.duration('query')
      duration('done')
      process.stdout.write(String(timerCalls))
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, '0')
})

test('disabled duration returns true from every level without writing', async t => {
  const { stdout, stderr } = await $(
    'node',
    [
      '-e',
      `
      const duration = require('.')('test').duration('query')
      process.stdout.write([duration('done'), duration.info('done'), duration.error('fail')].join())
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.is(stdout, 'true,true,true')
  t.is(stderr, '')
})

test('duration logs a level enabled on its own', async t => {
  const { stderr } = await $(
    'node',
    [
      '-e',
      `
      const duration = require('.')('test').duration('query')
      duration('done')
      duration.error('fail')
    `
    ],
    {
      env: { ...process.env, DEBUG: 'test:error' }
    }
  )

  t.regex(stripAnsi(stderr), /^test:error query fail duration=\S+$/)
})

test('duration follows namespaces enabled after the first call', async t => {
  const { stderr } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('.')('test')
      debug.duration('query')('skipped')
      require('debug').enable('test')
      debug.duration('query')('done')
    `
    ],
    {
      env: { ...process.env, DEBUG: '' }
    }
  )

  t.regex(stripAnsi(stderr), /^test query done duration=\S+$/)
})

test('duration logs with custom levels', async t => {
  const { stdout, stderr } = await $(
    'node',
    [
      '-e',
      `
      const debug = require('.')('test', { levels: ['warn'] })
      process.stdout.write(String(debug.duration('query')('done')))
    `
    ],
    {
      env: { ...process.env, DEBUG: 'test' }
    }
  )

  t.is(stdout, 'true')
  t.regex(stripAnsi(stderr), /^test query done duration=\S+$/)
})
