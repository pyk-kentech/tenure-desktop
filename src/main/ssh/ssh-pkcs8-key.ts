import { createPrivateKey } from 'node:crypto'

const PKCS8_HEADER = '-----BEGIN PRIVATE KEY-----'

/**
 * tenure (DESIGN.md 36.26): ssh2 rejects unencrypted PKCS#8 keys (`BEGIN PRIVATE KEY`) as an
 * unsupported format, though OpenSSH accepts them, so a host that `ssh` reaches failed to connect
 * here. RSA and EC keys are re-encoded in memory to the PEM forms ssh2 reads (PKCS#1, SEC1); the
 * file is never rewritten. Anything else, including Ed25519 and encrypted PKCS#8, passes through.
 */
export function toSsh2PrivateKeyContents(contents: Buffer): Buffer {
  const text = contents.toString('utf8')
  if (!text.includes(PKCS8_HEADER)) {
    return contents
  }
  try {
    const key = createPrivateKey(text)
    if (key.asymmetricKeyType === 'rsa') {
      return Buffer.from(key.export({ type: 'pkcs1', format: 'pem' }))
    }
    if (key.asymmetricKeyType === 'ec') {
      return Buffer.from(key.export({ type: 'sec1', format: 'pem' }))
    }
  } catch {
    // Not a key Node can read without a passphrase: leave ssh2 to report it as before.
  }
  return contents
}
