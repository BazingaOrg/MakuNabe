const IGNORED_MESSAGE_ERRORS = [
  'Extension context invalidated',
  'No response from message target',
  'disconnected',
]

export const isIgnorableMessagingError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false
  }

  return IGNORED_MESSAGE_ERRORS.some(message => error.message.includes(message))
}

export const logMessagingError = (scope: string, error: unknown) => {
  if (isIgnorableMessagingError(error)) {
    console.debug(`[message:${scope}] ignored`, error)
    return
  }

  console.error(`[message:${scope}]`, error)
}
