import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

// Shared by every creation entry point (Board, Nav) for both the full
// "New gathering" flow and Split Bill. Signed-in sessions go straight to
// the target path; anonymous sessions get the sign-in modal instead — the
// Create form itself never renders until the session is persistent, so
// there's nothing to resume or reconstruct afterwards.
export function useCreateGate(path: string = '/create') {
  const { isPersistent } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function requestCreate() {
    if (isPersistent) {
      navigate(path);
    } else {
      setOpen(true);
    }
  }

  function close() {
    setOpen(false);
    // If the modal is closing because sign-in just completed, continue on
    // to the target path. If they cancelled instead, isPersistent is still
    // false and this is a no-op — they stay right where they were.
    if (isPersistent) navigate(path);
  }

  return { open, requestCreate, close };
}
