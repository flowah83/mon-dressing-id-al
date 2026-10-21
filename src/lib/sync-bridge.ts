type SyncFn = () => void;

let impl: SyncFn = () => {};
let timer: ReturnType<typeof setTimeout> | null = null;

export function registerSync(fn: SyncFn) {
  impl = fn;
  return () => {
    if (impl === fn) impl = () => {};
  };
}

export function requestSync() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    impl();
  }, 400);
}

export function requestSyncNow() {
  if (timer) clearTimeout(timer);
  timer = null;
  impl();
}
