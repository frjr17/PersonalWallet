import { useState } from 'react';
import { clearIndexedDbPersistence, terminate } from 'firebase/firestore';
import { Calculator, HardDrive, Link as LinkIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Money } from '@/components/money';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '@/lib/firebase';
import { useTheme } from '@/lib/theme';
import { logError, userMessage } from '@/lib/errors';
import { useLedger, useSettings } from '@/app/DataProvider';
import {
  applyRecalculation,
  previewRecalculation,
  type RecalculationRow,
} from '@/services/finance';

const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'MXN', 'COP', 'PAB'] as const;
const locales = [
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['es-PA', 'Español (Panamá)'],
  ['es-ES', 'Español (España)'],
] as const;
const timeZones = [
  'America/Panama',
  'America/New_York',
  'America/Mexico_City',
  'America/Bogota',
  'Europe/Madrid',
  'UTC',
] as const;

function PreferenceRow({
  id,
  label,
  description,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed py-3 last:border-b-0">
      <div>
        <Label htmlFor={id}>{label}</Label>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="w-44">{children}</div>
    </div>
  );
}

function RecalculateDialog() {
  const { uid } = useLedger();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<RecalculationRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function openPreview() {
    setOpen(true);
    setRows(null);
    try {
      setRows(await previewRecalculation(uid));
    } catch (error) {
      logError('recalculate', error);
      toast.error(userMessage(error, 'The preview failed. Try again.'));
      setOpen(false);
    }
  }

  async function apply() {
    if (!rows) return;
    setBusy(true);
    try {
      await applyRecalculation(uid, rows);
      toast.success('Balances recalculated');
      setOpen(false);
    } catch (error) {
      logError('recalculate', error);
      toast.error(userMessage(error, 'Recalculation failed. No balances were changed.'));
    } finally {
      setBusy(false);
    }
  }

  const drifted = rows?.filter((row) => row.recordedMinor !== row.computedMinor) ?? [];

  return (
    <>
      <Button variant="outline" onClick={() => void openPreview()}>
        <Calculator /> Recalculate balances
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recalculate balances</DialogTitle>
            <DialogDescription>
              Each balance is recomputed from its opening balance plus every transaction. Nothing
              changes until you apply.
            </DialogDescription>
          </DialogHeader>
          {rows === null ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Checking the ledger…</p>
          ) : (
            <>
              <ul className="grid gap-2">
                {rows.map((row) => {
                  const drift = row.computedMinor !== row.recordedMinor;
                  return (
                    <li
                      key={row.account.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">{row.account.name}</span>
                      <span className="flex items-center gap-2 font-mono text-xs">
                        <Money minor={row.recordedMinor} className="text-xs" />
                        {drift && (
                          <>
                            <span aria-hidden="true">→</span>
                            <Money minor={row.computedMinor} className="text-xs font-semibold" />
                          </>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">
                {drifted.length === 0
                  ? 'All balances already match their transaction history.'
                  : `${drifted.length} ${drifted.length === 1 ? 'account needs' : 'accounts need'} correction.`}
              </p>
              <Button onClick={() => void apply()} disabled={busy || drifted.length === 0}>
                Apply corrections
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { theme, setTheme } = useTheme();

  async function update(patch: Parameters<typeof updateSettings>[0]) {
    try {
      await updateSettings(patch);
      toast.success('Settings saved');
    } catch (error) {
      logError('settings', error);
      toast.error(userMessage(error, 'Settings were not saved. Try again.'));
    }
  }

  async function clearLocalData() {
    try {
      await terminate(db);
      await clearIndexedDbPersistence(db);
    } catch (error) {
      // Continue: local storage still gets cleared and the reload re-syncs from the server.
      logError('clear-local', error);
    }
    localStorage.clear();
    window.location.reload();
  }

  return (
    <Page title="Settings" description="Defaults, appearance, and maintenance.">
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Formatting defaults for money and dates.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <PreferenceRow id="setting-currency" label="Currency">
              <Select
                value={settings.currency}
                onValueChange={(value) => void update({ currency: value })}
              >
                <SelectTrigger id="setting-currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PreferenceRow>
            <PreferenceRow id="setting-locale" label="Number & date format">
              <Select
                value={settings.locale}
                onValueChange={(value) => void update({ locale: value })}
              >
                <SelectTrigger id="setting-locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PreferenceRow>
            <PreferenceRow id="setting-timezone" label="Time zone">
              <Select
                value={settings.timeZone}
                onValueChange={(value) => void update({ timeZone: value })}
              >
                <SelectTrigger id="setting-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeZones.map((zone) => (
                    <SelectItem key={zone} value={zone}>
                      {zone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PreferenceRow>
            <PreferenceRow id="setting-weekstart" label="Week starts on">
              <Select
                value={String(settings.weekStartsOn)}
                onValueChange={(value) => void update({ weekStartsOn: value === '1' ? 1 : 0 })}
              >
                <SelectTrigger id="setting-weekstart">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </PreferenceRow>
            <PreferenceRow id="setting-theme" label="Theme">
              <Select value={theme} onValueChange={(value) => setTheme(value as typeof theme)}>
                <SelectTrigger id="setting-theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </PreferenceRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backup</CardTitle>
            <CardDescription>Export or restore your entire ledger as JSON.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/settings/backup">
                <LinkIcon /> Open backup & restore
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance</CardTitle>
            <CardDescription>
              Tools that keep the ledger healthy. Both show what happens before touching data.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <RecalculateDialog />
            <ConfirmDialog
              title="Clear local data?"
              description="The offline cache and sign-in state on this device are erased, then the app reloads. Your data stays safe in Firestore — unsynced offline changes on this device are lost."
              confirmLabel="Clear and reload"
              onConfirm={() => void clearLocalData()}
            >
              <Button variant="outline">
                <HardDrive /> Clear local data
              </Button>
            </ConfirmDialog>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Offline & privacy</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              This app keeps a copy of your financial data on this device so it works offline.
              Changes made offline queue up and sync when you reconnect. Only install it on devices
              you trust, and clear local data before handing a device to someone else.
            </p>
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
