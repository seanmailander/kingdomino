import { useState, useEffect } from "react";

function throttle(callback, wait = 50, immediate = false) {
  let timeout = null;
  let initialCall = true;

  return function throttle() {
    const callNow = immediate && initialCall;
    const next = () => {
      // @ts-expect-error as-is
      callback.apply(this, arguments);
      timeout = null;
    };

    if (callNow) {
      initialCall = false;
      next();
    }

    if (!timeout) {
      // @ts-expect-error as-is
      timeout = setTimeout(next, wait);
    }
  };
}

const convertMouseToBoard = ({ x, y, top, left, right, bottom }) => {
  const isWithinX = left <= x && x <= right;
  const isWithinY = top <= y && y <= bottom;

  // console.debug(x, y);

  if (isWithinX && isWithinY) {
    const thirteenX = (right - left) / 13;
    const thirteenY = (bottom - top) / 13;

    const xOffset = x - left;
    const yOffset = y - top;

    const xGrid = Math.floor(xOffset / thirteenX);
    const yGrid = Math.floor(yOffset / thirteenY);
    return { x: xGrid, y: yGrid };
  }
  return { x: null, y: null };
};

const useBoardPosition = (boardNodePosition) => {
  const [boardPosition, setBoardPosition] = useState({ x: null, y: null });

  const { top, left, right, bottom } = boardNodePosition || {};

  const updateMousePosition = (ev) => {
    const { clientX: mouseX, clientY: mouseY } = ev;
    // Convert mouse coords to board coords
    const converted = convertMouseToBoard({
      x: mouseX,
      y: mouseY,
      top,
      left,
      right,
      bottom,
    });
    // @ts-expect-error as-is
    setBoardPosition(converted);
  };

  useEffect(() => {
    console.debug("remount handlers");
    const throttledMouseMove = throttle(updateMousePosition);
    window.addEventListener("mousemove", throttledMouseMove);

    return () => window.removeEventListener("mousemove", throttledMouseMove);
  }, [top, left, right, bottom]);

  return boardPosition;
};

export default useBoardPosition;
