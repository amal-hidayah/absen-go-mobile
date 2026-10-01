import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
  className?: string;
}

/**
 * Kepala halaman seragam untuk semua panel.
 * Mobile: judul dan tombol aksi ditumpuk, tombol jadi selebar layar agar mudah dijangkau ibu jari.
 * Desktop: judul kiri, aksi kanan, sejajar dengan baseline judul.
 */
export function PageHeader({ title, subtitle, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
          {Icon ? <Icon className="size-5 shrink-0 text-primary sm:size-6" aria-hidden /> : null}
          <span className="min-w-0 text-balance">{title}</span>
        </h1>
        {subtitle ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground text-pretty">
            {subtitle}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-col gap-2 [&>*]:w-full sm:flex-row sm:items-center [&>*]:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
