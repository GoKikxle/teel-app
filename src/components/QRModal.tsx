import { Dialog } from '@base-ui/react/dialog';
import { QRCode } from './QRCode';

// Figma 1129:4761 — QR code only ever shows inside this modal now,
// triggered by SharePanel's "View QR code" button, not inline in the
// card at all times.
export function QRModal({
  open,
  onClose,
  title,
  hint,
  value,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  hint: string;
  value: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-backdrop" />
        <Dialog.Viewport className="modal-viewport">
          <Dialog.Popup className="qr-modal-card">
            <div className="qr-modal-head">
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Close className="qr-modal-close" aria-label="Close">
                <img src="/icons/board/close-md.svg" alt="" width={24} height={24} />
              </Dialog.Close>
            </div>
            <p className="poll-hint" style={{ marginTop: 0 }}>
              {hint}
            </p>
            <QRCode value={value} size={409} />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
