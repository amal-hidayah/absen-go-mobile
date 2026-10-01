import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/siswa")({
  beforeLoad: () => {
    throw redirect({ to: "/karyawan" });
  },
  component: () => null,
});
