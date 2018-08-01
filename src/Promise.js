const PROMISE_STATUS = {
  PENDING: 'pending', // 等待态
  RESOLVE: 'resolve', // 执行态
  REJECTED: 'rejected', // 拒绝态
}

function Promise(executor) {
  const self = this
  // 存放 Promise 当前的状态，共有三种状态
  self.status = PROMISE_STATUS.PENDING
  // 存放 Promise 的值（eventual value）
  self.data = undefined
  // 存放Promise回调事件的列表
  self.onResolvedCallbacks = []
  self.onRejectedCallbacks = []

  function resolve(value) {
    // resolve 和 reject 都要求异步执行
    setTimeout(() => {
      if (self.status === PROMISE_STATUS.PENDING) {
        self.status = PROMISE_STATUS.RESOLVE
        self.data = value
        self.onResolvedCallbacks.forEach(callback => {
          callback(value)
        })
      }
    })
  }

  function reject(reason) {
    setTimeout(() => {
      if (self.status === PROMISE_STATUS.PENDING) {
        self.status = PROMISE_STATUS.REJECTED
        self.data = reason
        self.onRejectedCallbacks.forEach(callback => {
          callback(reason)
        })
      }
    })
  }

  try {
    executor(resolve, reject)
  } catch (error) {
    reject(error)
  }
}

/**
 * Promise 解析过程 [[Resolve](promise, x)]
 * @param {*} promise 
 * @param {*} x 
 * @param {*} resolve 
 * @param {*} reject 
 */
function resolvePromise(promise, x, resolve, reject) {
  let then,
    thenCalledOrThrow = false

  // 2.3.1 如果 x 与 promise 指向同一个对象，则以 TypeError reject
  if (x === promise) {
    reject(new TypeError('Chaining cycle detected for Promise'))
  }

  // 2.3.2 如果 x 为 Promise
  if (x instanceof Promise) {
    // 2.3.2.1 如果 `x` 处于等待态， `promise` 需保持为等待态直至 `x` 被执行或拒绝
    if (x.status === PROMISE_STATUS.PENDING) {
      x.then(value => {
        resolvePromise(promise, value, resolve, reject)
      }, reject)
    } else {
      // 2.3.2.2：如果 `x` 处于执行态，用相同的值执行 `promise`。
      // 2.3.2.3：如果 `x` 处于拒绝态，用相同的据因拒绝 `promise`
      x.then(resolve, reject)
    }
    return
  }

  // 2.3.3 如果 x 是对象或者函数
  if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
    try {
      // 2.3.3.1 将 x.then 赋值给 then
      then = x.then
      // 2.3.3.3 如果 `then` 是函数，将 `x` 作为函数的作用域 `this` 调用之。传递两个回调函数作为参数，第一个参数叫做 `resolvePromise` ，第二个参数叫做 `rejectPromise
      // 这种 thenable 特性使得 Promise的实现更具有通用性。Promise 只要暴露 then 方法就可以与其他实现的 Promise 共存
      if (typeof then === 'function') {
        then.call(
          x,
          function rs(y) {
            // 2.3.3.3.3 如果 `resolvePromise` 和 `rejectPromise` 均被调用，或者被同一参数调用了多次，则优先采用首次调用并忽略剩下的调用
            if (thenCalledOrThrow) return
            thenCalledOrThrow = true
            // 2.3.3.3.1 如果 `resolvePromise` 以值 `y` 为参数被调用，则运行 `[[Resolve]](promise, y)`
            return resolvePromise(promise, y, resolve, reject)
          },
          function rj(reason) {
            if (thenCalledOrThrow) return
            // 2.3.3.3.2 如果 `rejectPromise` 以据因 `r` 为参数被调用，则以据因 `r` 拒绝 `promise`
            thenCalledOrThrow = true
            reject(reason)
          },
        )
      } else {
        // 2.3.3.4 如果 `then` 不是函数，以 `x` 为参数 resolve `promise`
        resolve(x)
      }
    } catch (error) {
      if (thenCalledOrThrow) return
      thenCalledOrThrow = true
      // 2.3.3.2 如果取 `x.then` 的值时抛出错误 `e` ，则以 `e` 为据因拒绝 `promise`
      reject(error)
    }
  } else {
    // 2.3.4  如果 `x` 不为对象或者函数，以 `x` 为参数执行 `promise`
    resolve(x)
  }
}

Promise.prototype.then = function(onResolved, onRejected) {
  const self = this
  let promise2

  /** 2.2.1.1 和 2.2.1.2
   * onResolve、onRejected 如果不是函数，则必须忽略
   * 
   * 因为在 2.2.7.3 中提到，如果 onResolved 不是函数，且 promise1 成功执行，则 promose2 必须成功执行并返回相同的值，所以添加了一个默认返回值的函数
   * 2.2.7.4 同理
   */

  onResolved =
    typeof onResolved === 'function'
      ? onResolved
      : function(v) {
          return v
        }
  onRejected =
    typeof onRejected === 'function'
      ? onRejected
      : function(r) {
          throw r
        }

  if (self.status === PROMISE_STATUS.RESOLVE) {
    return (promise2 = new Promise((resolve, reject) => {
      // 异步执行 onResolve
      setTimeout(() => {
        try {
          const x = onResolved(self.data)
          resolvePromise(promise2, x, resolve, reject)
        } catch (error) {
          // 如果抛出异常，则必须拒绝执行，并返回 reason
          reject(error)
        }
      })
    }))
  }

  if (self.status === PROMISE_STATUS.REJECTED) {
    return (promise2 = new Promise((resolve, reject) => {
      // 异步执行 onRejected
      setTimeout(() => {
        try {
          const x = onRejected(self.data)
          resolvePromise(promise2, x, resolve, reject)
        } catch (error) {
          reject(error)
        }
      })
    }))
  }

  // 如果处于 pending，则需要等到 Promise 的状态确定后才能决定如何处理
  if (self.status === PROMISE_STATUS.PENDING) {
    return (promise2 = new Promise((resolve, reject) => {
      self.onResolvedCallbacks.push(value => {
        try {
          const x = onResolved(self.data)
          resolvePromise(promise2, x, resolve, reject)
        } catch (error) {
          reject(error)
        }
      })

      self.onRejectedCallbacks.push(value => {
        try {
          const x = onRejected(self.data)
          resolvePromise(promise2, x, resolve, reject)
        } catch (error) {
          reject(error)
        }
      })
    }))
  }
}

Promise.prototype.catch = function(onRejected) {
  return this.then(null, onRejected)
}

Promise.deferred = Promise.defer = function() {
  var dfd = {}
  dfd.promise = new Promise(function(resolve, reject) {
    dfd.resolve = resolve
    dfd.reject = reject
  })
  return dfd
}

try {
  module.exports = Promise
} catch (e) {}
