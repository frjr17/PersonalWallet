import { useState } from 'react';
import { format } from 'date-fns';
import { DatabaseBackup, Download, ShieldAlert, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { logError, userMessage } from '@/lib/errors';
import { toDateInput } from '@/lib/dates';
import { useLedger } from '@/app/DataProvider';
import { downloadFile } from '@/services/csv';
import {
  exportBackup,
  restoreBackup,
  validateBackup,
  type BackupFile,
  type RestoreMode,
} from '@/services/backup';

export function BackupPage() {
  const { uid } = useLedger();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [mode, setMode] = useState<RestoreMode>('merge');
  const [progress, setProgress] = useState<string | null>(null);

  async function downloadBackup(): Promise<boolean> {
    try {
      const backup = await exportBackup(uid);
      downloadFile(
        `pocket-ledger-${toDateInput(new Date())}.backup.json`,
        JSON.stringify(backup, null, 2),
        'application/json',
      );
      return true;
    } catch (error) {
      logError('backup', error);
      toast.error(userMessage(error, 'The backup export failed. Try again.'));
      return false;
    }
  }

  async function handleExport() {
    setBusy(true);
    if (await downloadBackup()) toast.success('Backup downloaded');
    setBusy(false);
  }

  async function handleFile(file: File) {
    try {
      const text = await file.text();
      const backup = validateBackup(JSON.parse(text));
      setPending(backup);
      setPendingName(file.name);
    } catch (error) {
      logError('backup', error);
      setPending(null);
      toast.error(
        error instanceof SyntaxError
          ? 'That file is not JSON.'
          : userMessage(error, 'That file is not a valid backup.'),
      );
    }
  }

  async function runRestore() {
    if (!pending) return;
    setBusy(true);
    setProgress('Preparing…');
    try {
      if (mode === 'replace') {
        setProgress('Downloading a safety backup of current data…');
        const saved = await downloadBackup();
        if (!saved) return; // never wipe data without the safety copy
      }
      await restoreBackup(uid, pending, mode, (done, total) =>
        setProgress(`Writing ${done} of ${total}…`),
      );
      toast.success(mode === 'replace' ? 'Backup restored (replace)' : 'Backup merged');
      setPending(null);
    } catch (error) {
      logError('backup', error);
      toast.error(userMessage(error, 'The restore failed.'));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const counts = pending
    ? ([
        ['Accounts', pending.accounts.length],
        ['Categories', pending.categories.length],
        ['Transactions', pending.transactions.length],
        ['Budgets', pending.budgets.length],
        ['Recurring', pending.recurringTransactions.length],
      ] as const)
    : [];

  return (
    <Page title="Backup" description="Your whole ledger, in a file you keep.">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
            <CardDescription>
              Download everything — settings, accounts, categories, transactions, budgets, and
              recurring templates — as one JSON file.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void handleExport()} disabled={busy}>
              <Download /> Download backup
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Backups contain your full financial history. Store them somewhere private.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Restore</CardTitle>
            <CardDescription>
              Load a backup file, review what it contains, then choose how to apply it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="backup-file">Backup file</Label>
              <Input
                id="backup-file"
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </div>

            {pending && (
              <>
                <div className="rounded-md border bg-secondary/50 p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <DatabaseBackup className="size-4" /> {pendingName}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Exported {format(new Date(pending.exportedAt), "MMM d, yyyy 'at' HH:mm")}
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
                    {counts.map(([label, count]) => (
                      <li key={label} className="flex justify-between">
                        <span className="font-sans text-muted-foreground">{label}</span>
                        <span>{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="restore-mode">Mode</Label>
                  <Select value={mode} onValueChange={(value) => setMode(value as RestoreMode)}>
                    <SelectTrigger id="restore-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="merge">
                        Merge — upsert by id, keep everything else
                      </SelectItem>
                      <SelectItem value="replace">Replace — wipe current data first</SelectItem>
                    </SelectContent>
                  </Select>
                  {mode === 'replace' && (
                    <p className="flex items-start gap-1.5 text-xs text-destructive">
                      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                      Replace deletes everything currently in the ledger. A safety backup of the
                      current data downloads automatically first.
                    </p>
                  )}
                </div>

                {progress && <p className="font-mono text-xs text-muted-foreground">{progress}</p>}

                {mode === 'replace' ? (
                  <ConfirmDialog
                    title="Replace all data?"
                    description="Current accounts, transactions, budgets, and recurring templates are deleted and replaced by the backup. A safety backup downloads first."
                    confirmLabel="Replace everything"
                    onConfirm={() => void runRestore()}
                  >
                    <Button variant="destructive" disabled={busy}>
                      <Upload /> Restore (replace)
                    </Button>
                  </ConfirmDialog>
                ) : (
                  <Button onClick={() => void runRestore()} disabled={busy}>
                    <Upload /> Restore (merge)
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
