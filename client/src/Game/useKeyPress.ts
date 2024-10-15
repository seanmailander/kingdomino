import { useEffect } from "react";
/**
 * useKeyPress
 * @param {string} key - the name of the key to respond to, compared against event.key
 * @param {function} action - the action to perform on key press
 */
export default function useKeypress(key, action, deps) {
  useEffect(() => {
    //TODO: dont readd every time action changes
    function onKeyup(e) {
      if (e.code === key) action();
    }
    window.addEventListener("keyup", onKeyup);
    return () => window.removeEventListener("keyup", onKeyup);
  }, [key, action, ...deps]);
}
