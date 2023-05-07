class InternalNode<T> {
  value: T
  prev: InternalNode<T> | null
  next: InternalNode<T> | null
  constructor(value: T) {
    this.value = value
    this.prev = null
    this.next = null
  }
}

class LinkedList<T> {
  private head: InternalNode<T> | null
  private tail: InternalNode<T> | null
  constructor() {
    this.head = null
    this.tail = null
  }
  insert() {
    //
  }
}
