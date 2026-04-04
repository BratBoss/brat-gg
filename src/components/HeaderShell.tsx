import type { ReactNode } from "react";

export default function HeaderShell({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="border-b border-[var(--th-border)] px-6 py-4">
      {/* Mobile (<sm): brand + auth on one line, nav below */}
      <div className="sm:hidden">
        <div className="flex items-center min-h-[24px]">
          <div className="min-w-0 flex items-center">{left}</div>
          <div className="ml-auto min-w-0 flex items-center justify-end">{right}</div>
        </div>
        {center && (
          <div className="mt-2 flex items-center justify-center">{center}</div>
        )}
      </div>
      {/* sm+: original 3-column grid, unchanged */}
      <div className="hidden sm:grid grid-cols-[1fr_auto_1fr] items-center gap-6 min-h-[24px]">
        <div className="min-w-0 flex items-center">{left}</div>
        <div className="flex items-center justify-center">{center}</div>
        <div className="min-w-0 flex items-center justify-end">{right}</div>
      </div>
    </header>
  );
}
