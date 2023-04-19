import prettier from 'prettier'

const code = prettier.format('const a =3')

console.log(code)

export const cc = prettier.check