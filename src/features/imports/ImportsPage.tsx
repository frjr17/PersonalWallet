import { useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useData } from '@/app/DataProvider';
import { useAuth } from '@/features/authentication/AuthProvider';
import { normalizeRows, parseCsv, type CsvMapping, type NormalizedRow } from '@/services/csv';
import { fingerprint } from '@/services/fingerprint';
import { importTransactions, loadAll, writeImportRecord } from '@/services/repositories';
import type { Transaction } from '@/types/domain';
import { formatMoney } from '@/lib/money';
export function ImportsPage() {
  const { accounts, categories } = useData(),
    { user } = useAuth(),
    [fileName, setFileName] = useState(''),
    [fields, setFields] = useState<string[]>([]),
    [raw, setRaw] = useState<Record<string, string>[]>([]),
    [accountId, setAccountId] = useState(''),
    [mapping, setMapping] = useState<CsvMapping>({ date: '', description: '', amount: '' }),
    [dateFormat, setDateFormat] = useState('MM/dd/yyyy'),
    [rows, setRows] = useState<NormalizedRow[]>([]);
  const choose = async (file?: File) => {
    if (!file) return;
    const parsed = parseCsv(await file.text());
    setFileName(file.name);
    setFields(parsed.fields);
    setRaw(parsed.rows);
    setMapping({
      date: parsed.fields.find((f) => /date/i.test(f)) ?? '',
      description: parsed.fields.find((f) => /description|memo/i.test(f)) ?? '',
      amount: parsed.fields.find((f) => /amount/i.test(f)) ?? '',
    });
  };
  const preview = async () => {
    if (!accountId) return toast.error('Choose a destination account');
    const normalized = normalizeRows(raw, mapping, dateFormat);
    const existing = user ? await loadAll<Transaction>(user.uid, 'transactions') : [];
    for (const row of normalized.filter((r) => r.valid)) {
      row.fingerprint = await fingerprint(
        accountId,
        row.occurredAt,
        row.amountMinor,
        row.description,
      );
      row.duplicate = existing.some((t) => t.fingerprint === row.fingerprint);
    }
    setRows(normalized);
  };
  const runImport = async () => {
    if (!user) return;
    const category = (type: 'income' | 'expense', name?: string) =>
      categories.find((c) => c.type === type && name && c.name.toLowerCase() === name.toLowerCase())
        ?.id ?? categories.find((c) => c.type === type)?.id;
    const selected = rows.filter((r) => r.valid && r.included && !r.duplicate);
    const items = selected.flatMap((r) => {
      const categoryId = category(r.type, r.categoryName);
      return categoryId
        ? [
            {
              type: r.type,
              accountId,
              categoryId,
              amountMinor: r.amountMinor,
              currency: 'USD',
              description: r.description,
              merchant: r.merchant,
              tags: [],
              occurredAt: r.occurredAt,
              source: 'csv-import' as const,
              fingerprint: r.fingerprint ?? '',
            },
          ]
        : [];
    });
    await importTransactions(user.uid, accountId, items);
    await writeImportRecord(user.uid, {
      fileName,
      accountId,
      imported: items.length,
      skipped: rows.length - items.length,
      duplicates: rows.filter((r) => r.duplicate).length,
    });
    toast.success(`${items.length} transactions imported`);
    setRows([]);
  };
  return (
    <Page eyebrow="Local processing" title="Import CSV">
      <div className="grid gap-5 lg:grid-cols-[.7fr_1.3fr]">
        <Card>
          <label className="grid min-h-40 cursor-pointer place-items-center rounded-2xl border border-dashed text-center">
            <div>
              <FileSpreadsheet className="mx-auto mb-2 text-jade" />
              <p className="font-semibold">{fileName || 'Choose a CSV file'}</p>
              <p className="text-sm opacity-55">The file stays in your browser.</p>
            </div>
            <input
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>
          {fields.length > 0 && (
            <div className="mt-5 space-y-4">
              <Select
                label="Destination account"
                value={accountId}
                onChange={setAccountId}
                options={accounts.filter((a) => !a.archived).map((a) => [a.id, a.name])}
              />
              <Select
                label="Date column"
                value={mapping.date}
                onChange={(v) => setMapping({ ...mapping, date: v })}
                options={fields.map((v) => [v, v])}
              />
              <Select
                label="Description column"
                value={mapping.description}
                onChange={(v) => setMapping({ ...mapping, description: v })}
                options={fields.map((v) => [v, v])}
              />
              <Select
                label="Amount column"
                value={mapping.amount ?? ''}
                onChange={(v) => setMapping({ ...mapping, amount: v })}
                options={fields.map((v) => [v, v])}
              />
              <Select
                label="Date format"
                value={dateFormat}
                onChange={setDateFormat}
                options={['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd'].map((v) => [v, v])}
              />
              <Button className="w-full" onClick={() => void preview()}>
                <Upload size={18} />
                Preview rows
              </Button>
            </div>
          )}
        </Card>
        <Card>
          <h2 className="font-display text-xl">Review</h2>
          {rows.length ? (
            <>
              <div className="mt-4 max-h-[34rem] overflow-auto divide-y">
                {rows.map((r, i) => (
                  <label key={r.row} className="flex items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={r.included && !r.duplicate}
                      disabled={!r.valid || r.duplicate}
                      onChange={(e) =>
                        setRows((v) =>
                          v.map((x, j) => (j === i ? { ...x, included: e.target.checked } : x)),
                        )
                      }
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{r.description || `Row ${r.row}`}</p>
                      <p className="text-sm opacity-55">
                        {r.error ??
                          (r.duplicate ? 'Probable duplicate' : r.occurredAt.toLocaleDateString())}
                      </p>
                    </div>
                    <span className="amount">{r.valid ? formatMoney(r.amountMinor) : '—'}</span>
                  </label>
                ))}
              </div>
              <Button className="mt-5" onClick={() => void runImport()}>
                <CheckCircle2 size={18} />
                Import selected rows
              </Button>
            </>
          ) : (
            <p className="grid min-h-64 place-items-center text-center opacity-55">
              Map the file to preview normalized transactions and duplicate warnings.
            </p>
          )}
        </Card>
      </div>
    </Page>
  );
}
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
