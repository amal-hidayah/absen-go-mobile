import type { ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DataColumn<T> {
  header: ReactNode;
  align?: "left" | "center" | "right";
  render: (row: T) => ReactNode;
}

interface DataListProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  /** Susunan kartu untuk layar sempit: satu kartu ringkas per baris, bukan tabel yang digeser. */
  renderCard: (row: T) => ReactNode;
  header?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  onRetry?: () => void;
  empty: ReactNode;
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

function PanelState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground text-pretty">
          {description}
        </p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/**
 * Daftar data dengan dua tampilan: tabel di layar lebar, kartu di layar sempit.
 * Alasannya bukan sekadar "responsif": tabel 5-7 kolom di HP hanya bisa dibaca
 * dengan digeser ke samping, jadi tiap halaman menulis ulang isi barisnya
 * sebagai kartu ringkas lewat `renderCard`.
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  renderCard,
  header,
  loading = false,
  loadingLabel = "Memuat data...",
  error = null,
  onRetry,
  empty,
}: DataListProps<T>) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)]">
      {header ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3.5 sm:px-5 sm:py-4">
          {header}
        </div>
      ) : null}

      {loading ? (
        <PanelState
          icon={<Loader2 className="size-5 animate-spin" aria-hidden />}
          title={loadingLabel}
        />
      ) : error ? (
        <PanelState
          icon={<TriangleAlert className="size-5 text-destructive" aria-hidden />}
          title="Data gagal dimuat"
          description={error}
          action={
            onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Coba lagi
              </Button>
            ) : null
          }
        />
      ) : rows.length === 0 ? (
        empty
      ) : (
        <>
          <div className="hidden md:block md:overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <tr>
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className={`px-5 py-3 font-semibold ${alignClass[col.align ?? "left"]}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={rowKey(row)} className="transition-colors hover:bg-muted/30">
                    {columns.map((col, i) => (
                      <td
                        key={i}
                        className={`px-5 py-3.5 align-middle ${alignClass[col.align ?? "left"]}`}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y md:hidden">
            {rows.map((row) => (
              <li key={rowKey(row)} className="p-4">
                {renderCard(row)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
