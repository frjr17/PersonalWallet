import { useEffect, useState } from 'react';
import {
  Download,
  LogOut,
  Monitor,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sun,
  WifiOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAuth } from '@/features/authentication/AuthProvider';
import { useData } from '@/app/DataProvider';
import { defaultSettings, type ProfileSettings, type Transaction } from '@/types/domain';
import {
  applyBalanceCorrections,
  loadAll,
  loadSettings,
  saveSettings,
} from '@/services/repositories';
import { recalculatePreview } from '@/services/finance';
import { formatMoney } from '@/lib/money';
import { setThemePreference, type ThemePreference } from '@/lib/theme';
export function SettingsPage() {
  const { user, logout } = useAuth(),
    { accounts } = useData(),
    [settings, setSettings] = useState<ProfileSettings>(defaultSettings),
    [preview, setPreview] = useState<ReturnType<typeof recalculatePreview>>([]);
  useEffect(() => {
    if (user)
      void loadSettings(user.uid).then((value) => {
        if (!value) return;
        setSettings(value);
        setThemePreference(value.theme);
      });
  }, [user]);
  const persist = async (next: ProfileSettings) => {
    setSettings(next);
    setThemePreference(next.theme);
    if (user) await saveSettings(user.uid, next);
    toast.success('Settings saved');
  };
  const recalc = async () => {
    if (!user || !navigator.onLine)
      return toast.error('Balance recalculation requires a connection');
    setPreview(recalculatePreview(accounts, await loadAll<Transaction>(user.uid, 'transactions')));
  };
  const enableOffline = () => {
    localStorage.setItem('ledger:offline-consent', 'yes');
    location.reload();
  };
  return (
    <Page eyebrow="Preferences and maintenance" title="Settings">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-xl">Regional settings</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Select
              label="Currency"
              value={settings.currency}
              options={['USD', 'EUR', 'GBP', 'CAD']}
              onChange={(v) => void persist({ ...settings, currency: v })}
            />
            <Select
              label="Locale"
              value={settings.locale}
              options={['en-US', 'en-GB', 'es-PA']}
              onChange={(v) => void persist({ ...settings, locale: v })}
            />
            <Select
              label="Time zone"
              value={settings.timeZone}
              options={['America/Panama', 'America/New_York', 'UTC']}
              onChange={(v) => void persist({ ...settings, timeZone: v })}
            />
            <ThemePicker
              value={settings.theme}
              onChange={(theme) => void persist({ ...settings, theme })}
            />
          </div>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 font-display text-xl">
            <WifiOff className="text-jade" />
            Trusted-device offline mode
          </h2>
          <p className="my-4 opacity-65">
            Persistent offline data lets the ledger work without a connection, but financial data
            remains stored on this device.
          </p>
          {localStorage.getItem('ledger:offline-consent') === 'yes' ? (
            <p className="flex items-center gap-2 font-semibold text-jade">
              <ShieldCheck />
              Enabled on this device
            </p>
          ) : (
            <Button onClick={enableOffline}>Enable and reload</Button>
          )}
          <ConfirmDialog
            trigger={
              <Button className="mt-3" variant="secondary">
                Clear local application data
              </Button>
            }
            title="Clear local data?"
            description="You will be signed out and this device's cached ledger data will be removed after reload."
            onConfirm={async () => {
              localStorage.clear();
              await logout();
              location.reload();
            }}
          />
        </Card>
        <Card>
          <h2 className="font-display text-xl">Balance integrity</h2>
          <p className="my-4 opacity-65">
            Compare every stored balance with its opening balance and complete transaction history.
          </p>
          <Button onClick={() => void recalc()}>
            <RefreshCw size={17} />
            Preview recalculation
          </Button>
          {preview.length > 0 && (
            <div className="mt-4 divide-y">
              {preview.map((p) => (
                <div className="flex justify-between py-2" key={p.account.id}>
                  <span>{p.account.name}</span>
                  <span className={`amount ${p.difference ? 'text-apricot' : 'text-jade'}`}>
                    {p.difference ? formatMoney(p.difference) : 'Correct'}
                  </span>
                </div>
              ))}
              <ConfirmDialog
                trigger={
                  <Button className="mt-4" variant="danger">
                    Apply corrections
                  </Button>
                }
                title="Apply balance corrections?"
                description="Stored account balances will be replaced with the previewed values."
                onConfirm={async () => {
                  if (user) {
                    await applyBalanceCorrections(
                      user.uid,
                      preview.map((p) => ({ id: p.account.id, expected: p.expected })),
                    );
                    setPreview([]);
                    toast.success('Balances recalculated');
                  }
                }}
              />
            </div>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-xl">Data and access</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/settings/backup">
                <Download size={17} />
                Backup and restore
              </Link>
            </Button>
            <Button variant="secondary" onClick={() => void logout()}>
              <LogOut size={17} />
              Sign out
            </Button>
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm opacity-55">
            <Moon size={16} />
            App Check complements owner-only security rules.
          </p>
        </Card>
      </div>
    </Page>
  );
}

const themes = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

function ThemePicker({
  value,
  onChange,
}: {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="label">Appearance</legend>
      <div className="grid grid-cols-3 gap-2" aria-label="Color theme">
        {themes.map(({ value: option, label, Icon }) => {
          const selected = value === option;
          return (
            <button
              type="button"
              key={option}
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${
                selected
                  ? 'border-ink bg-ink text-oat dark:border-white dark:bg-white dark:text-black'
                  : 'bg-white/50 hover:bg-white dark:bg-white/[.04] dark:hover:bg-white/[.08]'
              }`}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
}
