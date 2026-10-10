"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";

const navigationItem =
  "flex h-11 items-center gap-3 rounded-[14px] px-3 text-[13px] whitespace-nowrap [corner-shape:squircle] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const navigationLabel =
  "hidden min-[801px]:group-data-[expanded=true]/sidebar:inline";
const iconClass = "size-5 shrink-0 stroke-[1.6]";

export function WorkspaceSidebar() {
  const [expanded, setExpanded] = useState(false);
  let toggleLabel = "Expand sidebar";

  if (expanded) {
    toggleLabel = "Collapse sidebar";
  }

  return (
    <aside
      data-expanded={expanded}
      className="group/sidebar sticky top-3 z-10 my-3 ml-3 flex h-[calc(100dvh-24px)] w-18 shrink-0 flex-col rounded-3xl border border-sidebar-border bg-sidebar px-3 pb-5 text-sidebar-foreground transition-[width] duration-180 ease-in-out [corner-shape:squircle] data-[expanded=true]:w-58 motion-reduce:transition-none max-[800px]:mx-3 max-[800px]:h-auto max-[800px]:min-h-18 max-[800px]:w-auto max-[800px]:flex-row max-[800px]:items-center max-[800px]:justify-between max-[800px]:gap-3 max-[800px]:rounded-[20px] max-[800px]:p-3 max-[800px]:data-[expanded=true]:w-auto"
    >
      <div className="flex h-22 shrink-0 flex-col items-start justify-center max-[800px]:h-auto">
        <Link
          href="/"
          aria-label="Tradelyzer home"
          title="Tradelyzer"
          className="flex items-center gap-2.5 rounded-xl pl-[5px] text-[23px] font-[650] tracking-[-0.6px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-[800px]:pl-0 max-[800px]:text-[19px]"
        >
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground pr-[3px] pb-[3px] text-[30px] leading-none font-[650] tracking-[-2px] text-background [corner-shape:squircle]"
          >
            t.
          </span>
          <span className="hidden group-data-[expanded=true]/sidebar:inline max-[800px]:inline">
            tradelyzer
          </span>
        </Link>
      </div>
      <nav
        id="workspace-navigation"
        aria-label="Main navigation"
        className="flex min-h-0 flex-1 flex-col gap-2 pt-2 max-[800px]:flex-none max-[800px]:flex-row max-[800px]:gap-1 max-[800px]:pt-0"
      >
        <Link
          href="/"
          className={`${navigationItem} bg-sidebar-accent font-[550] text-sidebar-accent-foreground`}
          aria-current="page"
          aria-label="Calendar"
          title="Calendar"
        >
          <CalendarDays aria-hidden="true" className={iconClass} />
          <span className={navigationLabel}>Calendar</span>
        </Link>
        <button
          type="button"
          className={`${navigationItem} cursor-not-allowed text-left text-disabled`}
          aria-disabled="true"
          aria-label="Settings (coming soon)"
          title="Settings — coming soon"
        >
          <Settings aria-hidden="true" className={iconClass} />
          <span className={navigationLabel}>Settings</span>
          <span className="ml-auto hidden text-[10px] text-muted-foreground min-[801px]:group-data-[expanded=true]/sidebar:inline">
            Soon
          </span>
        </button>
      </nav>
      <div className="shrink-0 pt-4 max-[800px]:hidden">
        <button
          type="button"
          className={`${navigationItem} shrink-0 cursor-pointer hover:bg-secondary hover:text-foreground`}
          aria-label={toggleLabel}
          aria-expanded={expanded}
          aria-controls="workspace-navigation"
          title={toggleLabel}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded && (
            <PanelLeftClose aria-hidden="true" className={iconClass} />
          )}
          {!expanded && (
            <PanelLeftOpen aria-hidden="true" className={iconClass} />
          )}
        </button>
      </div>
    </aside>
  );
}
