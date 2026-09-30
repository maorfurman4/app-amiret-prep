import type { ReactNode } from 'react';

/**
 * A region that slides open (grid-rows 0fr → 1fr) and is inert while closed.
 * Closed content stays in the DOM (nothing is lost, just folded away); `inert`
 * keeps it out of the tab order and the accessibility tree until it opens.
 */
export function Reveal({ open, id, children }: { open: boolean; id: string; children: ReactNode }) {
  return (
    <div
      id={id}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-spring-soft motion-reduce:transition-none ${
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
