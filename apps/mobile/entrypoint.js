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
  if (typeof global !== 'undefined') {
    global.Event = EventPolyfill
  }
}

if (typeof globalThis.CustomEvent !== 'function') {
  class CustomEventPolyfill extends globalThis.Event {
    constructor(type, options = {}) {
      super(type, options)
      this.detail = options.detail ?? null
    }
  }

  globalThis.CustomEvent = CustomEventPolyfill
  if (typeof global !== 'undefined') {
    global.CustomEvent = CustomEventPolyfill
  }
}

if (typeof globalThis.EventTarget !== 'function') {
  class EventTargetPolyfill {
    constructor() {
      this._listeners = new Map()
    }

    addEventListener(type, listener) {
      if (!listener) return
      const listeners = this._listeners.get(type) ?? new Set()
      listeners.add(listener)
      this._listeners.set(type, listeners)
    }

    removeEventListener(type, listener) {
      const listeners = this._listeners.get(type)
      if (!listeners) return
      listeners.delete(listener)
      if (!listeners.size) {
        this._listeners.delete(type)
      }
    }

    dispatchEvent(event) {
      const listeners = this._listeners.get(event?.type)
      if (!listeners) return true
      listeners.forEach((listener) => {
        if (typeof listener === 'function') {
          listener.call(this, event)
        } else if (typeof listener?.handleEvent === 'function') {
          listener.handleEvent(event)
        }
      })
      return !event?.defaultPrevented
    }
  }

  globalThis.EventTarget = EventTargetPolyfill
  if (typeof global !== 'undefined') {
    global.EventTarget = EventTargetPolyfill
  }
}

if (typeof globalThis.window === 'object') {
  globalThis.window.Event = globalThis.Event
  globalThis.window.CustomEvent = globalThis.CustomEvent
  globalThis.window.EventTarget = globalThis.EventTarget
}

if (typeof globalThis.self === 'object') {
  globalThis.self.Event = globalThis.Event
  globalThis.self.CustomEvent = globalThis.CustomEvent
  globalThis.self.EventTarget = globalThis.EventTarget
}

// Load required polyfills only after the globals above are installed.
require('fast-text-encoding')
require('react-native-get-random-values')
require('@ethersproject/shims')

const { registerRootComponent } = require('expo')
const App = require('./App').default

registerRootComponent(App)
