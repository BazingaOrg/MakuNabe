export const openUrl = (url?: string, target?: string, features?: string) => {
  if (typeof url === 'string' && url.length > 0) {
    window.open(url, target, features)
  }
}

export const isDarkMode = () => {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

export const subscribeSystemThemeChange = (onThemeChange: () => void) => {
  const mediaQueryList = window.matchMedia?.('(prefers-color-scheme: dark)')
  if (mediaQueryList == null) {
    return () => {}
  }

  // Keep compatibility with legacy browsers that still use addListener/removeListener.
  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', onThemeChange)
    return () => {
      mediaQueryList.removeEventListener('change', onThemeChange)
    }
  }

  mediaQueryList.addListener(onThemeChange)
  return () => {
    mediaQueryList.removeListener(onThemeChange)
  }
}
