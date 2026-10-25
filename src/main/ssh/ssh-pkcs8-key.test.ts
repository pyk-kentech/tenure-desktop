import { generateKeyPairSync } from 'node:crypto'
import { utils, type ParsedKey } from 'ssh2'
import { describe, expect, it } from 'vitest'
import { toSsh2PrivateKeyContents } from './ssh-pkcs8-key'

function parsedType(contents: Buffer): string {
  const parsed = utils.parseKey(contents) as ParsedKey | ParsedKey[] | Error
  if (parsed instanceof Error) {
    return `error: ${parsed.message}`
  }
  return (Array.isArray(parsed) ? parsed[0] : parsed).type
}

describe('toSsh2PrivateKeyContents (DESIGN.md 36.26)', () => {
  it('makes an unencrypted PKCS#8 RSA key readable by ssh2', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pkcs8 = Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' }))
    expect(parsedType(pkcs8)).toBe('error: Unsupported key format')
    expect(parsedType(toSsh2PrivateKeyContents(pkcs8))).toBe('ssh-rsa')
  })

  it('makes an unencrypted PKCS#8 EC key readable by ssh2', () => {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
    const pkcs8 = Buffer.from(privateKey.export({ type: 'pkcs8', format: 'pem' }))
    expect(parsedType(toSsh2PrivateKeyContents(pkcs8))).toBe('ecdsa-sha2-nistp256')
  })

  it('passes other formats and unreadable keys through unchanged', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const pkcs1 = Buffer.from(privateKey.export({ type: 'pkcs1', format: 'pem' }))
    expect(toSsh2PrivateKeyContents(pkcs1)).toBe(pkcs1)
    const encrypted = Buffer.from(
      privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'pw' })
    )
    expect(toSsh2PrivateKeyContents(encrypted)).toBe(encrypted)
    const garbage = Buffer.from(
      '-----BEGIN PRIVATE KEY-----\nnot a key\n-----END PRIVATE KEY-----\n'
    )
    expect(toSsh2PrivateKeyContents(garbage)).toBe(garbage)
  })
})
