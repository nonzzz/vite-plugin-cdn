import vm from 'vm'

export function createVM() {
  const context = Object.create(null)
  vm.createContext(context)
  const run = (code: string): Record<string, unknown> => {
    return vm.runInContext(code, context)
  }
  return { run }
}
