import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Kolom kata sandi dengan tombol lihat/sembunyikan.
 * Admin sering perlu membaca kata sandi sementara untuk menyalinnya ke karyawan,
 * jadi tampilkan hanya atas permintaan, bukan terbuka secara bawaan.
 */
export function PasswordInput({ className, ...props }: ComponentProps<typeof Input>) {
  const [terlihat, setTerlihat] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={terlihat ? "text" : "password"}
        autoComplete="new-password"
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setTerlihat((v) => !v)}
        aria-pressed={terlihat}
        aria-label={terlihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        className="absolute right-0 top-0 flex h-full w-11 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {terlihat ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
