// Minimal browser event polyfills required by wallet/auth dependencies.
if (typeof globalThis.Event !== 'function') {
  class EventPolyfill {
    constructor(type, options = {}) {
      this.type = type
      this.bubbles = Boolean(options.bubbles)
      this.cancelable = Boolean(options.cancelable)
      this.composed = Boolean(options.composed)
      this.defaultPrevented = false
      this.timeStamp = Date.now()
    }

    preventDefault() {
      if (this.cancelable) {
        this.defaultPrevented = true
      }
    }

    stopPropagation() {}
    stopImmediatePropagation() {}
  }

  globalThis.Event = EventPolyfill
}

if (typeof globalThis.CustomEvent !== 'function') {
  class CustomEventPolyfill extends globalThis.Event {
    constructor(type, options = {}) {
      super(type, options)
      this.detail = options.detail ?? null
    }
  }

  globalThis.CustomEvent = CustomEventPolyfill
}

// Import required polyfills first
import 'fast-text-encoding'
import 'react-native-get-random-values'
import '@ethersproject/shims'

import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
