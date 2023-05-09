export function sleep(delay: number) {
  return new Promise((resolve) => setTimeout(resolve, delay))
}

export function getId() {
  return Math.random().toString(32).slice(2, 10)
}
