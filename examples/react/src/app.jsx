/* eslint-disable */
import { useState } from 'react'
import { Button } from '@geist-ui/core'

export function App() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <p>{count}</p>
      <Button onClick={() => setCount((pre) => pre+=1)}>Click</Button>
    </div>
  )
}
