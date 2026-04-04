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
      {/*
        Mobile (<sm): flex-wrap two-row layout.
          Row 1: [left]  [right]  (right pushed to far end via ml-auto)
          Row 2: [center]         (w-full forces it to its own full-width row)
        sm+: restore the original 3-column grid.
          col-start overrides ensure visual order left | center | right
          regardless of DOM order (left, right, center).
      */}
      <div className="flex flex-wrap items-center gap-y-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6 sm:min-h-[24px]">
        <div className="min-w-0 flex items-center">{left}</div>
        <div className="ml-auto sm:ml-0 sm:col-start-3 min-w-0 flex items-center justify-end">{right}</div>
        {center && (
          <div className="w-full sm:w-auto sm:col-start-2 flex items-center justify-center">{center}</div>
        )}
      </div>
    </header>
  );
}
