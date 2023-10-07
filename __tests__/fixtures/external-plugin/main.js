import _Button from './button'

function withInstall(component) {
  component.install = (app) => {
    app.component(component.name, component)
  }
}

const Button = withInstall(_Button)

export { Button }
