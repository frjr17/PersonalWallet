import { useState } from 'react';
import { Download, FileJson, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/authentication/AuthProvider';
import {
  backupEntityCount,
  createBackup,
  downloadJson,
  parseBackup,
  type Backup,
} from '@/services/backup';
import { restoreBackup } from '@/services/repositories';
export function BackupPage() {
  const { user } = useAuth(),
    [candidate, setCandidate] = useState<Backup | null>(null);
  const download = async () => {
    if (!user) return;
    const data = await createBackup(user.uid);
    downloadJson(data, `personal-ledger-${new Date().toISOString().slice(0, 10)}.backup.json`);
    toast.success('Backup downloaded');
  };
  const choose = async (file?: File) => {
    if (!file) return;
    try {
      setCandidate(parseBackup(await file.text()));
    } catch {
      toast.error('This is not a supported version 1 backup');
    }
  };
  const restore = async (mode: 'merge' | 'replace') => {
    if (!user || !candidate) return;
    if (mode === 'replace') {
      const current = await createBackup(user.uid);
      downloadJson(current, `personal-ledger-before-restore-${Date.now()}.backup.json`);
    }
    await restoreBackup(user.uid, candidate, mode);
    toast.success(mode === 'merge' ? 'Backup merged' : 'Backup replaced');
    setCandidate(null);
  };
  return (
    <Page eyebrow="Versioned JSON" title="Backup and restore">
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <Download className="text-jade" />
          <h2 className="mt-5 font-display text-xl">Export everything</h2>
          <p className="my-3 opacity-65">
            Download settings, accounts, categories, transactions, budgets, and recurring templates.
          </p>
          <Button onClick={() => void download()}>Download backup</Button>
        </Card>
        <Card>
          <Upload className="text-apricot" />
          <h2 className="mt-5 font-display text-xl">Restore a backup</h2>
          <p className="my-3 opacity-65">
            The file is validated and previewed before any data changes.
          </p>
          <label className="inline-flex h-11 cursor-pointer items-center rounded-xl border px-4 font-bold">
            <FileJson className="mr-2" size={18} />
            Choose JSON
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>
          {candidate && (
            <div className="mt-5 rounded-2xl bg-mist/60 p-4">
              <p className="font-semibold">
                Backup from {new Date(candidate.exportedAt).toLocaleString()}
              </p>
              <p className="text-sm opacity-60">
                {backupEntityCount(candidate)} records · schema version 1
              </p>
              <div className="mt-4 flex gap-2">
                <ConfirmDialog
                  trigger={<Button>Merge</Button>}
                  title="Merge this backup?"
                  description="Matching document IDs will be updated. New records will be added."
                  onConfirm={() => restore('merge')}
                />
                <ConfirmDialog
                  trigger={<Button variant="danger">Replace</Button>}
                  title="Replace all ledger data?"
                  description="A current backup downloads first. Replacement uses multiple safe batches and cannot be globally atomic."
                  onConfirm={() => restore('replace')}
                />
              </div>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
