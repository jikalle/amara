import webCrypto from 'expo-standard-web-crypto'

if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error - runtime polyfill
  globalThis.crypto = webCrypto
}
