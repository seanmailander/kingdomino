import { useState, useEffect } from "react";

type BoardPosition = { x: number | null; y: number | null };
type BoardRect = Pick<DOMRect, "top" | "left" | "right" | "bottom">;

function throttle<Args extends unknown[]>(
  callback: (...args: Args) => void,
  wait = 50,
  immediate = false,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let initialCall = true;

  return (...args: Args) => {
    const callNow = immediate && initialCall;
    const next = () => {
      callback(...args);
      timeout = null;
    };

    if (callNow) {
      initialCall = false;
      next();
      return;
    }

    if (!timeout) {
      timeout = setTimeout(next, wait);
    }
  };
}

const convertMouseToBoard = ({
  x,
  y,
  top,
  left,
  right,
  bottom,
}: { x: number; y: number } & Partial<BoardRect>): BoardPosition => {
  if (top === undefined || left === undefined || right === undefined || bottom === undefined) {
    return { x: null, y: null };
  }

  const isWithinX = left <= x && x <= right;
  const isWithinY = top <= y && y <= bottom;

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

const useBoardPosition = (boardNodePosition?: BoardRect | null) => {
  const [boardPosition, setBoardPosition] = useState<BoardPosition>({ x: null, y: null });

  const { top, left, right, bottom } = boardNodePosition || {};

  const updateMousePosition = (ev: MouseEvent) => {
    const { clientX: mouseX, clientY: mouseY } = ev;
    const converted = convertMouseToBoard({
      x: mouseX,
      y: mouseY,
      top,
      left,
      right,
      bottom,
    });
    setBoardPosition(converted);
  };

  useEffect(() => {
    const throttledMouseMove = throttle(updateMousePosition);
    window.addEventListener("mousemove", throttledMouseMove);

    return () => window.removeEventListener("mousemove", throttledMouseMove);
  }, [top, left, right, bottom]);

  return boardPosition;
};

export default useBoardPosition;
