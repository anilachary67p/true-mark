import { Alert } from '@/components/ui/Alert';

export function FeedbackAlert({
  message,
  severity = 'success',
}: {
  message: string;
  severity?: 'success' | 'error' | 'info';
}) {
  if (!message) return null;
  const variant = severity === 'error' ? 'error' : severity === 'info' ? 'info' : 'success';
  return <Alert variant={variant}>{message}</Alert>;
}
