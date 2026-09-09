export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
    </main>
  );
}
