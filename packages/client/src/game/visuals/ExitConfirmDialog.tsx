import React from "react";

type ExitConfirmDialogProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function ExitConfirmDialog({ onConfirm, onCancel }: ExitConfirmDialogProps) {
  return (
    <div className="exit-confirm-dialog overlay" role="dialog" aria-modal="true">
      <div className="panel">
        <p>Are you sure you want to exit?</p>
        <button className="danger" onClick={onConfirm}>Exit Game</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
