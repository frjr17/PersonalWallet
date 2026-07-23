import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useLedger, useSettings } from '@/app/DataProvider';

/** One-time notice: financial data is cached on this device for offline use. */
export function OfflineNotice() {
  const { settings, updateSettings } = useSettings();
  const { loading } = useLedger();

  if (loading || settings.offlineWarningAcknowledged) return null;

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This ledger works offline</AlertDialogTitle>
          <AlertDialogDescription>
            To work without a connection, your financial data is stored on this device. Only use the
            app on devices you trust, keep the device locked, and use “Clear local data” in Settings
            before lending or retiring it. Changes made offline sync automatically when you
            reconnect.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => void updateSettings({ offlineWarningAcknowledged: true })}
          >
            Got it
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
