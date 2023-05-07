//  refer: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script

import { Window } from 'happy-dom'
import type { IIFEModuleInfo, CDNPluginOptions } from './interface'

class InjectScript {
  private input: Record<string, IIFEModuleInfo>
  private window: Window
  constructor(modules: Record<string, IIFEModuleInfo>) {
    this.input = modules
    this.window = new Window()
  }
  toString() {
    //
  }
  inject(html: string, transformHook: undefined | CDNPluginOptions['transform']) {
    const { document } = this.window
    document.body.innerHTML = html
    if (transformHook) {
      // const { script, link } = transformHook()
      for (const module in this.input) {
        //
      }
    }
  }
}

export function createInjectScript(modules: Record<string, IIFEModuleInfo>) {
  return new InjectScript(modules)
}
