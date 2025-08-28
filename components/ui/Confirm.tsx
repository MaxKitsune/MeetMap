"use client";
import Modal from './Modal';

export function Confirm({ open, title = 'Are you sure?', body, confirmText = 'Delete', onConfirm, onCancel }: {
  open: boolean;
  title?: string;
  body?: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      {body && <p className="text-white/80 mb-4">{body}</p>}
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm}>{confirmText}</button>
      </div>
    </Modal>
  );
}

