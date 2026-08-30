import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';

// Shared by every creation entry point (Board, Nav, SplitBillPayPanel's
// post-payment CTA) for both the full "New gathering" flow and Split
// Bill. Signed-in sessions go straight to the target path; anonymous
// sessions are sent to /signin, which resumes on to that same path once
// sign-in completes (see SignIn.tsx's isPersistent effect) — the Create
// form itself never renders until the session is persistent, so there's
// nothing else to resume or reconstruct here.
export function useCreateGate(path: string = '/create') {
  const { isPersistent } = useAuth();
  const navigate = useNavigate();

  function requestCreate() {
    if (isPersistent) {
      navigate(path);
    } else {
      navigate(`/signin?next=${encodeURIComponent(path)}`);
    }
  }

  return { requestCreate };
}
