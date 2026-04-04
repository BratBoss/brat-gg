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
    <header className="border-b border-[#2a3a2c] px-6 py-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 min-h-[24px]">
        <div className="min-w-0 flex items-center">{left}</div>
        <div className="flex items-center justify-center">{center}</div>
        <div className="min-w-0 flex items-center justify-end">{right}</div>
      </div>
    </header>
  );
}
