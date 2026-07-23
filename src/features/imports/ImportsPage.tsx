import { useEffect, useMemo, useState } from 'react';
import { limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { format } from 'date-fns';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileUp, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/Page';
import { Money } from '@/components/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { ImportRecord } from '@/types/domain';
import { useLedger, useSettings } from '@/app/DataProvider';
import { getDocs } from 'firebase/firestore';
import {
  importsCol,
  parseImportRecord,
  parseTransaction,
  transactionsInRange,
} from '@/services/repositories';
import { importEntries, type EntryInput } from '@/services/finance';
import {
  csvDateFormats,
  emptyMapping,
  guessMapping,
  markDuplicates,
  normalizeCsvRow,
  parseCsvFile,
  type CsvDateFormat,
  type CsvMapping,
  type NormalizedCsvRow,
  type ParsedCsv,
} from '@/services/csv';

type Step = 'pick' | 'map' | 'preview' | 'done';

const mappingFields: { key: keyof CsvMapping; label: string; hint?: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'description', label: 'Description' },
  { key: 'amount', label: 'Amount (signed)', hint: 'Positive = income, negative = expense' },
  { key: 'debit', label: 'Debit', hint: 'Used when there is no signed amount column' },
  { key: 'credit', label: 'Credit' },
  { key: 'category', label: 'Category', hint: 'Matched to your categories by name' },
  { key: 'merchant', label: 'Merchant' },
];

export function ImportsPage() {
  const ledger = useLedger();
  const { uid, activeAccounts, categories } = ledger;
  const { settings } = useSettings();

  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>(emptyMapping);
  const [dateFormat, setDateFormat] = useState<CsvDateFormat>('yyyy-MM-dd');
  const [accountId, setAccountId] = useState('');
  const [rows, setRows] = useState<NormalizedCsvRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [history, setHistory] = useState<ImportRecord[]>([]);

  useEffect(() => {
    return onSnapshot(
      query(importsCol(uid), orderBy('createdAt', 'desc'), limit(10)),
      (snap) => setHistory(snap.docs.map(parseImportRecord)),
      (error) => logError('imports', error),
    );
  }, [uid]);

  async function handleFile(file: File) {
    try {
      const result = await parseCsvFile(file);
      if (result.rows.length === 0) {
        toast.error('That file has no data rows.');
        return;
      }
      setFileName(file.name);
      setParsed(result);
      setMapping(guessMapping(result.headers));
      setAccountId(activeAccounts[0]?.id ?? '');
      setStep('map');
    } catch (error) {
      logError('imports', error);
      toast.error('That file could not be read as CSV.');
    }
  }

  const mappingValid =
    mapping.date !== '' && (mapping.amount !== '' || mapping.debit !== '' || mapping.credit !== '');

  async function buildPreview() {
    if (!parsed || !accountId) return;
    setBusy(true);
    try {
      const normalized = parsed.rows.map((raw, index) =>
        normalizeCsvRow(raw, index, mapping, dateFormat, categories),
      );
      const valid = normalized.filter((row) => !row.error && row.occurredAt);
      const dates = valid.map((row) => row.occurredAt!.getTime());
      let existing: Awaited<ReturnType<typeof markDuplicates>> = normalized;
      if (dates.length > 0) {
        const start = new Date(Math.min(...dates));
        const end = new Date(Math.max(...dates) + 24 * 60 * 60 * 1000);
        const snap = await getDocs(transactionsInRange(uid, start, end));
        const existingTxns = snap.docs
          .map(parseTransaction)
          .filter((txn) => txn.accountId === accountId);
        existing = await markDuplicates(normalized, accountId, existingTxns);
      }
      setRows(existing);
      setStep('preview');
    } catch (error) {
      logError('imports', error);
      toast.error(userMessage(error, 'The preview failed. Check the column mapping.'));
    } finally {
      setBusy(false);
    }
  }

  const included = useMemo(() => rows.filter((row) => row.included && !row.error), [rows]);
  const failed = useMemo(() => rows.filter((row) => row.error), [rows]);
  const duplicates = useMemo(() => rows.filter((row) => row.duplicate), [rows]);

  function toggleRow(index: number, value: boolean) {
    setRows((current) =>
      current.map((row) => (row.index === index ? { ...row, included: value } : row)),
    );
  }

  async function runImport() {
    if (included.length === 0) return;
    setBusy(true);
    try {
      const entries: EntryInput[] = included.map((row) => ({
        type: row.type!,
        accountId,
        categoryId: row.categoryId,
        amountMinor: row.amountMinor!,
        currency: settings.currency,
        merchant: row.merchant,
        description: row.description,
        tags: [],
        occurredAt: row.occurredAt!,
      }));
      await importEntries(ledger, entries, {
        fileName,
        accountId,
        rowCount: rows.length,
        duplicateCount: duplicates.length,
      });
      setImportedCount(entries.length);
      setStep('done');
      toast.success(`Imported ${entries.length} transactions`);
    } catch (error) {
      logError('imports', error);
      toast.error(
        userMessage(
          error,
          'The import failed. No partial rows were silently dropped — review and retry.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep('pick');
    setParsed(null);
    setRows([]);
    setFileName('');
  }

  return (
    <Page title="Import CSV" description="Bring transactions in from a bank export.">
      {step === 'pick' && (
        <Card>
          <CardContent className="grid place-items-center gap-4 py-14 text-center">
            <FileUp className="size-8 text-muted-foreground" />
            <div>
              <p className="font-medium">Choose a CSV file</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Everything is parsed on this device — the file never leaves your browser.
              </p>
            </div>
            <Label htmlFor="csv-file" className="sr-only">
              CSV file
            </Label>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              className="max-w-xs"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </CardContent>
        </Card>
      )}

      {step === 'map' && parsed && (
        <Card>
          <CardHeader>
            <CardTitle>Map the columns</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {fileName} · {parsed.rows.length} rows. Point each field at the matching column.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {mappingFields.map((field) => (
                <div key={field.key} className="grid gap-1">
                  <Label htmlFor={`map-${field.key}`} className="text-xs text-muted-foreground">
                    {field.label}
                  </Label>
                  <Select
                    value={mapping[field.key] || 'none'}
                    onValueChange={(value) =>
                      setMapping((current) => ({
                        ...current,
                        [field.key]: value === 'none' ? '' : value,
                      }))
                    }
                  >
                    <SelectTrigger id={`map-${field.key}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not in this file</SelectItem>
                      {parsed.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                </div>
              ))}
              <div className="grid gap-1">
                <Label htmlFor="map-date-format" className="text-xs text-muted-foreground">
                  Date format
                </Label>
                <Select
                  value={dateFormat}
                  onValueChange={(value) => setDateFormat(value as CsvDateFormat)}
                >
                  <SelectTrigger id="map-date-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {csvDateFormats.map((formatOption) => (
                      <SelectItem key={formatOption} value={formatOption}>
                        {formatOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="map-account" className="text-xs text-muted-foreground">
                  Import into account
                </Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger id="map-account">
                    <SelectValue placeholder="Pick an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                <ArrowLeft /> Start over
              </Button>
              <Button
                onClick={() => void buildPreview()}
                disabled={!mappingValid || !accountId || busy}
              >
                Preview import <ArrowRight />
              </Button>
            </div>
            {!mappingValid && (
              <p className="text-xs text-muted-foreground">
                Map at least the date plus an amount (or debit/credit) column.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <CheckCircle2 /> {included.length} ready
            </Badge>
            {duplicates.length > 0 && (
              <Badge variant="secondary">
                <Copy /> {duplicates.length} probable duplicates
              </Badge>
            )}
            {failed.length > 0 && (
              <Badge variant="destructive">
                <AlertTriangle /> {failed.length} failed validation
              </Badge>
            )}
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={() => setStep('map')}>
                <ArrowLeft /> Back to mapping
              </Button>
              <Button onClick={() => void runImport()} disabled={busy || included.length === 0}>
                Import {included.length} rows
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th scope="col" className="p-3">
                      <span className="sr-only">Include</span>
                    </th>
                    <th scope="col" className="p-3">
                      Date
                    </th>
                    <th scope="col" className="p-3">
                      Description
                    </th>
                    <th scope="col" className="p-3">
                      Category
                    </th>
                    <th scope="col" className="p-3 text-right">
                      Amount
                    </th>
                    <th scope="col" className="p-3">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.index}
                      className={`border-b border-dashed last:border-b-0 ${row.error ? 'opacity-60' : ''}`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="size-4 accent-(--primary)"
                          checked={row.included}
                          disabled={Boolean(row.error)}
                          aria-label={`Include row ${row.index + 1}`}
                          onChange={(event) => toggleRow(row.index, event.target.checked)}
                        />
                      </td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">
                        {row.occurredAt ? format(row.occurredAt, 'yyyy-MM-dd') : '—'}
                      </td>
                      <td className="max-w-56 truncate p-3">{row.description || '—'}</td>
                      <td className="p-3 text-xs">
                        {row.categoryId
                          ? categories.find((category) => category.id === row.categoryId)?.name
                          : row.categoryName
                            ? `${row.categoryName} (no match)`
                            : '—'}
                      </td>
                      <td className="p-3 text-right">
                        {row.amountMinor != null && row.type ? (
                          <Money
                            minor={row.type === 'income' ? row.amountMinor : -row.amountMinor}
                            signed
                            tone="auto"
                            className="text-sm"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-3 text-xs">
                        {row.error ? (
                          <span className="text-destructive">{row.error}</span>
                        ) : row.duplicate === 'existing' ? (
                          <span className="text-chart-2">Already in the ledger?</span>
                        ) : row.duplicate === 'in-file' ? (
                          <span className="text-chart-2">Repeated in this file</span>
                        ) : (
                          <span className="text-muted-foreground">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'done' && (
        <Card>
          <CardContent className="grid place-items-center gap-3 py-14 text-center">
            <CheckCircle2 className="size-8 text-income" />
            <p className="font-medium">Imported {importedCount} transactions</p>
            <p className="text-sm text-muted-foreground">
              The account balance was updated in the same batch.
            </p>
            <Button onClick={reset}>Import another file</Button>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && step === 'pick' && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Previous imports</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-0">
            {history.map((record) => (
              <div key={record.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{record.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {record.importedCount}/{record.rowCount} rows ·{' '}
                  {format(record.createdAt, 'MMM d, yyyy')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </Page>
  );
}
