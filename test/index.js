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
