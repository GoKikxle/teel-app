import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

// Shared by every "+ New gathering" entry point (Board, Nav). Signed-in
// sessions go straight to /create; anonymous sessions get the sign-in modal
// instead — the Create form itself never renders until the session is
// persistent, so there's nothing to resume or reconstruct afterwards.
export function useCreateGate() {
  const { isPersistent } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function requestCreate() {
    if (isPersistent) {
      navigate('/create');
    } else {
      setOpen(true);
    }
  }

  function close() {
    setOpen(false);
    // If the modal is closing because sign-in just completed, continue on
    // to Create. If they cancelled instead, isPersistent is still false and
    // this is a no-op — they stay right where they were.
    if (isPersistent) navigate('/create');
  }

  return { open, requestCreate, close };
}
