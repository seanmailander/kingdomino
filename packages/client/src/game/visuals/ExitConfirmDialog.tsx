import React from "react";

type ExitConfirmDialogProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function ExitConfirmDialog({ onConfirm, onCancel }: ExitConfirmDialogProps) {
  return (
    <div className="exit-confirm-dialog">
      <p>Are you sure you want to exit?</p>
      <button onClick={onConfirm}>Exit Game</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
