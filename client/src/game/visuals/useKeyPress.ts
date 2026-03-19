import { useEffect, type DependencyList } from "react";
/**
 * useKeyPress
 * @param {string} key - the name of the key to respond to, compared against event.key
 * @param {function} action - the action to perform on key press
 */
export function useKeypress(key: string, action: () => void, deps: DependencyList = []) {
  useEffect(() => {
    function onKeyup(e: KeyboardEvent) {
      if (e.code === key) action();
    }
    window.addEventListener("keyup", onKeyup);
    return () => window.removeEventListener("keyup", onKeyup);
  }, [key, action, ...deps]);
}
