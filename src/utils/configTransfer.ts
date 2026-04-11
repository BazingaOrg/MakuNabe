import {sanitizeEnvData} from './envSanitizer'

const APP_ID = 'bilibili-subtitle'
const CONFIG_VERSION = 1
const PBKDF2_ITERATIONS = 310000
const PBKDF2_HASH = 'SHA-256'
const AES_ALGORITHM = 'AES-GCM'
const AES_KEY_LENGTH = 256
const SALT_LENGTH = 16
const IV_LENGTH = 12

export type ConfigTransferErrorCode =
  | 'INVALID_FILE'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_FORMAT'
  | 'DECRYPT_FAILED'
  | 'INVALID_PAYLOAD'

export class ConfigTransferError extends Error {
  code: ConfigTransferErrorCode

  constructor(code: ConfigTransferErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

export interface ExportConfigV1 {
  version: 1
  app: typeof APP_ID
  createdAt: string
  encryption: {
    algorithm: typeof AES_ALGORITHM
    kdf: 'PBKDF2-SHA-256'
    iterations: typeof PBKDF2_ITERATIONS
    saltB64: string
    ivB64: string
  }
  payloadB64: string
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const toBase64 = (data: ArrayBuffer | Uint8Array): string => {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

const fromBase64 = (base64: string): Uint8Array => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const deriveCryptoKey = async (passphrase: string, salt: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    {name: 'PBKDF2'},
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    {
      name: AES_ALGORITHM,
      length: AES_KEY_LENGTH,
    },
    false,
    usages,
  )
}

const ensurePassphrase = (passphrase: string) => {
  if (!passphrase || !passphrase.trim()) {
    throw new ConfigTransferError('INVALID_FORMAT', '口令不能为空')
  }
}

const assertExportConfigV1 = (data: unknown): ExportConfigV1 => {
  if (data == null || typeof data !== 'object') {
    throw new ConfigTransferError('INVALID_FILE', '配置文件不是合法的 JSON 对象')
  }

  const config = data as Partial<ExportConfigV1>
  if (config.version !== 1 || config.app !== APP_ID) {
    throw new ConfigTransferError('UNSUPPORTED_VERSION', '配置文件版本不受支持')
  }

  if (
    config.encryption == null ||
    config.encryption.algorithm !== AES_ALGORITHM ||
    config.encryption.kdf !== 'PBKDF2-SHA-256' ||
    config.encryption.iterations !== PBKDF2_ITERATIONS ||
    typeof config.encryption.saltB64 !== 'string' ||
    typeof config.encryption.ivB64 !== 'string' ||
    typeof config.payloadB64 !== 'string'
  ) {
    throw new ConfigTransferError('INVALID_FORMAT', '配置文件的加密元数据无效')
  }

  return config as ExportConfigV1
}

export const exportConfigFilename = () => 'bilibili-subtitle-config.v1.json'

export const encryptEnvDataForExport = async (envData: EnvData, passphrase: string): Promise<ExportConfigV1> => {
  ensurePassphrase(passphrase)

  const sanitized = sanitizeEnvData(envData) ?? {}
  const plainText = JSON.stringify(sanitized)
  const plainBytes = textEncoder.encode(plainText)
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveCryptoKey(passphrase, salt, ['encrypt'])
  const encrypted = await crypto.subtle.encrypt(
    {
      name: AES_ALGORITHM,
      iv,
    },
    key,
    plainBytes,
  )

  return {
    version: CONFIG_VERSION,
    app: APP_ID,
    createdAt: new Date().toISOString(),
    encryption: {
      algorithm: AES_ALGORITHM,
      kdf: 'PBKDF2-SHA-256',
      iterations: PBKDF2_ITERATIONS,
      saltB64: toBase64(salt),
      ivB64: toBase64(iv),
    },
    payloadB64: toBase64(encrypted),
  }
}

export const decryptEnvDataFromImport = async (rawText: string, passphrase: string): Promise<EnvData> => {
  ensurePassphrase(passphrase)

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch (error) {
    throw new ConfigTransferError('INVALID_FILE', '配置文件不是合法 JSON')
  }

  const config = assertExportConfigV1(parsed)
  let decryptedText = ''

  try {
    const key = await deriveCryptoKey(passphrase, fromBase64(config.encryption.saltB64), ['decrypt'])
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: AES_ALGORITHM,
        iv: fromBase64(config.encryption.ivB64),
      },
      key,
      fromBase64(config.payloadB64),
    )
    decryptedText = textDecoder.decode(decryptedBuffer)
  } catch (error) {
    throw new ConfigTransferError('DECRYPT_FAILED', '配置解密失败，请检查口令是否正确')
  }

  let envData: unknown
  try {
    envData = JSON.parse(decryptedText)
  } catch (error) {
    throw new ConfigTransferError('INVALID_PAYLOAD', '解密后的配置内容不是合法 JSON')
  }

  const sanitized = sanitizeEnvData(envData as EnvData)
  if (sanitized == null) {
    throw new ConfigTransferError('INVALID_PAYLOAD', '解密后的配置内容为空')
  }

  return sanitized
}
