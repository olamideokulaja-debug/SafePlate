// Toast notification dispatch. The Toasts component (in App.jsx) registers a
// sink via registerToast; any module calls toast() to show a message.
type ToastFn = (msg: string, kind?: string) => void
let _toastFns: ToastFn[] = []
export function registerToast(fn: ToastFn): () => void {
  _toastFns.push(fn)
  return () => { _toastFns = _toastFns.filter(f => f !== fn) }
}
export function toast(msg: string, kind?: string) { _toastFns.forEach(f => f(msg, kind)) }
