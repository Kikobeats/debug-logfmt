'use strict'

const test = require('ava')

const encode = require('../src/encode')

test('encodes a string', t => {
  t.is(encode({ foo: 'bar' }), 'foo=bar')
})

test('encodes an empty string', t => {
  t.is(encode({ foo: '' }), 'foo=""')
})

test('encodes a string with whitespace', t => {
  t.is(encode({ foo: 'bar baz' }), 'foo="bar baz"')
})

test('encodes a string with double quotes', t => {
  t.is(encode({ foo: 'bar"baz"qux' }), 'foo=bar\\"baz\\"qux')
})

test('encodes a string with double quotes and whitespace', t => {
  t.is(encode({ foo: 'bar "baz" qux' }), 'foo="bar \\"baz\\" qux"')
})

test('encodes a string with an equals sign', t => {
  t.is(encode({ foo: 'bar=baz' }), 'foo="bar=baz"')
})

test('encodes a string with newlines', t => {
  t.is(encode({ foo: 'bar\nbaz' }), 'foo="bar baz"')
})

test('encodes a string with backslashes', t => {
  t.is(encode({ foo: 'bar\\baz' }), 'foo=bar\\\\baz')
})

test('encodes `null`', t => {
  t.is(encode({ foo: null }), 'foo=null')
})

test('encodes `undefined`', t => {
  t.is(encode({ foo: undefined }), 'foo=undefined')
})

test('encodes a number', t => {
  t.is(encode({ foo: 1 }), 'foo=1')
})

test('encodes inherited properties', t => {
  t.is(encode(Object.create({ foo: 'bar' })), 'foo=bar')
})

test('encodes stringified values', t => {
  const obj = {
    toString () {
      return '"bar"'
    }
  }

  t.is(encode({ foo: obj }), 'foo=\\"bar\\"')
})

test('encodes multiple values', t => {
  t.is(encode({ foo: 'bar', baz: 'qux' }), 'foo=bar baz=qux')
})
