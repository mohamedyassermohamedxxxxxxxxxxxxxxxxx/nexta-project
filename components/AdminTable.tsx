"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileStack,
  Inbox,
  ListFilter,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useSearch } from "@/context/SearchContext";
import DateFilterBar from "@/components/DateFilterBar";
import { describeDateFilter, matchesDate } from "@/lib/date-filter";
import { getStateMeta } from "@/lib/patient-states";
import { matchesSearch, usePatients } from "@/lib/use-patients";
import { formatPhone } from "@/lib/phone";
import { Avatar, Card, ErrorBanner, HeroButton, PageBody, PageHero, StateBadge, SyncNotice, TruncatedNotice } from "@/components/ui";

type StatFilter = "all" | "sent" | "pending" | "issues";
type MenuOption = { value: string; label: string };

const modalityLabels: Record<string, string> = {
  CR: "X-Ray (CR)",
  DX: "X-Ray (DX)",
  MG: "Mammography (MG)",
  MR: "MRI (MR)",
  CT: "Computed Tomography (CT)",
  US: "Ultrasound (US)",
};

const modalityOptions: MenuOption[] = [
  { value: "all", label: "All modalities" },
  ...Object.entries(modalityLabels).map(([value, label]) => ({ value, label })),
];

function normalizeModality(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ").toUpperCase();
  const matches = Object.entries(modalityLabels).filter(([code, label]) => {
    const normalizedLabel = label.toUpperCase();
    const shortLabel = normalizedLabel.replace(/\s+\([A-Z]+\)$/, "");
    return normalized === code || normalized === normalizedLabel || normalized === shortLabel;
  });
  return matches.length === 1 ? matches[0][0] : normalized;
}

const columns = [
  "Patient",
  "WhatsApp",
  "Study",
  "Accession",
  "Study Date",
  "Received",
  "Sent at",
  "Timer",
  "State",
];

function formatDisplay(value: string | null | undefined) {
  if (!value || value === "N/A") return "—";
  return value;
}

function containsArabic(value: string) {
  return /[\u0600-\u06ff]/.test(value);
}

function findWaitColor(timer: string) {
  const [h, m, s] = timer.split(":").map(Number);
  const totalSeconds = h * 3600 + m * 60 + s;
  if (totalSeconds >= 4 * 3600) return "bg-rose-50 text-rose-700";
  if (totalSeconds >= 2 * 3600) return "text-amber-800 bg-amber-50";
  return "text-slate-600 bg-slate-100";
}

function statFilterMatches(filter: StatFilter, state: string) {
  if (filter === "all") return true;
  const meta = getStateMeta(state);
  if (filter === "issues") return meta.isIssue;
  return meta.key === filter;
}

function FilterMenu({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  width,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  options: MenuOption[];
  onChange: (value: string) => void;
  width: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold text-ink-800 shadow-sm shadow-slate-900/[0.03] transition ${
          open
            ? "border-brand-300 bg-brand-50/70 ring-2 ring-brand-100"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 text-brand-600" />
        <span className="whitespace-nowrap">{selected?.label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={label}
          className={`absolute left-0 top-full z-50 mt-1 ${width} overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/15 ring-1 ring-slate-900/5`}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-700 hover:bg-slate-50 hover:text-ink-900"
                }`}
              >
                {option.label}
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const statTones = {
  blue: {
    count: "text-blue-600",
    border: "border-blue-200 bg-white",
    icon: "bg-blue-50 text-blue-600",
    activeBg: "bg-[#D3EEF5]",
    activeBorder: "border-[#3F67C4]",
    hover: "hover:-translate-y-0.5 hover:border-blue-300",
  },
  emerald: {
    count: "text-emerald-600",
    border: "border-emerald-200 bg-white",
    icon: "bg-emerald-50 text-emerald-600",
    activeBg: "bg-[#d9f2ea]",
    activeBorder: "border-[#5fc8a4]",
    hover: "hover:-translate-y-0.5 hover:border-emerald-300",
  },
  amber: {
    count: "text-amber-600",
    border: "border-amber-200 bg-white",
    icon: "bg-amber-50 text-amber-600",
    activeBg: "bg-[#f8e7c7]",
    activeBorder: "border-[#e7a94a]",
    hover: "hover:-translate-y-0.5 hover:border-amber-300",
  },
  rose: {
    count: "text-rose-600",
    border: "border-rose-200 bg-white",
    icon: "bg-rose-50 text-rose-600",
    activeBg: "bg-[#f9d9df]",
    activeBorder: "border-[#e65c7e]",
    hover: "hover:-translate-y-0.5 hover:border-rose-300",
  },
} as const;

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = 0;
    const to = value;
    const duration = 700;
    const startTime = performance.now();

    const animate = (now: number) => {
      const rawProgress = Math.min((now - startTime) / duration, 1);
      const easedProgress = 1 - (1 - rawProgress) ** 3;
      const nextValue = Math.round(from + (to - from) * easedProgress);
      setDisplayValue(nextValue);

      if (rawProgress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    setDisplayValue(0);
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value]);

  return <span className="block text-2xl font-bold tabular-nums tracking-tight">{displayValue ?? 0}</span>;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tint: string;
  tone: keyof typeof statTones;
  active: boolean;
  onClick: () => void;
}) {
  const colors = statTones[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group flex items-center gap-3 rounded-[1.75rem] border p-3.5 text-left transition-all duration-200 ease-out sm:p-4",
        active ? `${colors.activeBg} ${colors.activeBorder}` : `${colors.border}`,
        active ? "shadow-none ring-0" : "",
        colors.hover,
      ].join(" ")}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colors.icon}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className={`block ${colors.count}`}>
          <AnimatedNumber value={value} />
        </span>
        <span className="block text-sm font-medium text-slate-600">{label}</span>
      </span>
    </button>
  );
}

export default function AdminTable() {
  const [statFilter, setStatFilter] = useState<StatFilter>("all");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [pageSelection, setPageSelection] = useState<{ filterKey: string; page: number }>({ filterKey: "", page: 1 });
  const router = useRouter();
  const { searchQuery, setSearchQuery, dateFilter, setDateFilter } = useSearch();
  const { data, total, sync, isLoading, error, refresh } = usePatients(dateFilter);

  const datedData = useMemo(() => data.filter((p) => matchesDate(p.createdOn, dateFilter)), [data, dateFilter]);

  const counts = useMemo(() => {
    const c = { all: datedData.length, sent: 0, pending: 0, issues: 0 };
    datedData.forEach((p) => {
      const meta = getStateMeta(p.state);
      if (meta.key === "sent") c.sent++;
      else if (meta.key === "pending") c.pending++;
      if (meta.isIssue) c.issues++;
    });
    return c;
  }, [datedData]);

  const filteredData = useMemo(() => {
    const rows = datedData.filter((p) => {
      const matchesText = matchesSearch(p, searchQuery);
      const matchesStat = statFilterMatches(statFilter, p.state);
      const matchesModality = modalityFilter === "all" || normalizeModality(p.modality) === normalizeModality(modalityFilter);
      return matchesText && matchesStat && matchesModality;
    });
    return [...rows].sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  }, [datedData, searchQuery, statFilter, modalityFilter]);

  const filterKey = JSON.stringify([statFilter, modalityFilter, searchQuery, dateFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredData.length / 25));
  const page = Math.min(pageSelection.filterKey === filterKey ? pageSelection.page : 1, pageCount);
  const pageData = filteredData.slice((page - 1) * 25, page * 25);
  const toggleFilter = (filter: StatFilter) => setStatFilter((cur) => (cur === filter ? "all" : filter));

  const clearFilters = () => {
    setStatFilter("all");
    setModalityFilter("all");
    setSearchQuery("");
  };

  const goToPage = (nextPage: number) => {
    setPageSelection({ filterKey, page: nextPage });
    window.scrollTo(0, 0);
  };

  return (
    <>
      <PageHero
        title="Reports dashboard"
        subtitle="Track every study report from print to WhatsApp delivery."
        actions={
          <>
            <DateFilterBar />
            <HeroButton onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading ? "Refreshing" : "Refresh"}
            </HeroButton>
          </>
        }
      />

      <PageBody>
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="All studies"
            value={counts.all}
            icon={FileStack}
            tint="bg-blue-50 text-blue-600"
            tone="blue"
            active={statFilter === "all"}
            onClick={() => setStatFilter("all")}
          />
          <StatCard
            label="Sent"
            value={counts.sent}
            icon={CheckCircle2}
            tint="bg-emerald-50 text-emerald-600"
            tone="emerald"
            active={statFilter === "sent"}
            onClick={() => toggleFilter("sent")}
          />
          <StatCard
            label="Ready to send"
            value={counts.pending}
            icon={Clock3}
            tint="bg-amber-50 text-amber-600"
            tone="amber"
            active={statFilter === "pending"}
            onClick={() => toggleFilter("pending")}
          />
          <StatCard
            label="Needs attention"
            value={counts.issues}
            icon={AlertTriangle}
            tint="bg-rose-50 text-rose-600"
            tone="rose"
            active={statFilter === "issues"}
            onClick={() => toggleFilter("issues")}
          />
        </div>

        {error && <ErrorBanner message={error} />}
        <SyncNotice sync={sync} />
        <TruncatedNotice shown={data.length} total={total} />

        <Card className="relative overflow-visible">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-xl font-bold text-ink-900">Studies</h2>
              <p className="text-sm text-slate-500">
                {isLoading
                  ? "Loading…"
                  : `${filteredData.length} of ${datedData.length} studies · ${describeDateFilter(dateFilter)}${
                      searchQuery ? ` · matching “${searchQuery}”` : ""
                    }`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FilterMenu
                icon={ListFilter}
                label="Filter by modality"
                value={modalityFilter}
                onChange={setModalityFilter}
                width="w-60"
                options={modalityOptions}
              />
              {(statFilter !== "all" || modalityFilter !== "all" || searchQuery) && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700"
                >
                  Clear filter
                </button>
              )}
            </div>
          </div>

          <div className="w-full overflow-hidden rounded-b-2xl">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[48%] sm:w-[28%] xl:w-[18%]" />
                <col className="hidden xl:table-column xl:w-[11%]" />
                <col className="w-[27%] sm:w-[20%] xl:w-[12%]" />
                <col className="hidden xl:table-column xl:w-[7%]" />
                <col className="hidden sm:table-column sm:w-[12%] xl:w-[8%]" />
                <col className="hidden sm:table-column sm:w-[18%] xl:w-[11%]" />
                <col className="hidden xl:table-column xl:w-[10%]" />
                <col className="hidden xl:table-column xl:w-[9%]" />
                <col className="w-[25%] sm:w-[22%] xl:w-[14%]" />
              </colgroup>
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className={`truncate whitespace-nowrap px-1.5 py-2 ${column === "State" ? "pr-4" : ""} ${["WhatsApp", "Accession", "Sent at", "Timer"].includes(column) ? "hidden xl:table-cell" : ""} ${["Study Date", "Received"].includes(column) ? "hidden sm:table-cell" : ""}`}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>

              {isLoading ? (
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {columns.map((c) => (
                        <td key={c} className={`px-1.5 py-4 ${["WhatsApp", "Accession", "Sent at", "Timer"].includes(c) ? "hidden xl:table-cell" : ""} ${["Study Date", "Received"].includes(c) ? "hidden sm:table-cell" : ""}`}>
                          <div className="h-3.5 w-full max-w-[120px] animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              ) : filteredData.length === 0 ? (
                <tbody>
                  <tr>
                    <td colSpan={columns.length} className="px-5 py-16 text-center">
                      <Inbox className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-3 font-medium text-ink-900">No studies found</p>
                      <p className="text-sm text-slate-500">
                        {searchQuery || statFilter !== "all" || modalityFilter !== "all"
                          ? "Try a different search or clear the filter."
                          : dateFilter.preset !== "all"
                            ? `No print jobs ${describeDateFilter(dateFilter)}.`
                            : "New print jobs will show up here."}
                      </p>
                      {dateFilter.preset !== "all" && (
                        <button
                          type="button"
                          onClick={() => setDateFilter({ ...dateFilter, preset: "all" })}
                          className="mt-4 rounded-lg px-3 py-1.5 text-sm font-semibold text-brand-600 ring-1 ring-brand-200 transition hover:bg-brand-50"
                        >
                          Show all dates
                        </button>
                      )}
                    </td>
                  </tr>
                </tbody>
              ) : (
                <tbody>
                  {pageData.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => router.push(`/patient/${row.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          router.push(`/patient/${row.id}`);
                        }
                      }}
                      tabIndex={0}
                      className="group cursor-pointer border-t border-slate-100 transition hover:bg-brand-100 focus-visible:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
                    >
                              <td className="min-w-0 px-1.5 py-2.5 pl-3">
                                <div className="flex items-center gap-3">
                                  <Avatar name={row.patientName} size="sm" />
                                  <div className="min-w-0">
                                    <p
                                      title={row.patientName}
                                      dir="auto"
                                      className={`line-clamp-2 max-w-full break-words text-sm font-semibold leading-5 text-ink-900 ${containsArabic(row.patientName) ? "font-arabic" : ""}`}
                                    >
                                      {row.patientName}
                                    </p>
                                    <p dir="auto" className="mt-0.5 text-xs text-slate-600">ID {row.patientId}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="hidden whitespace-nowrap px-1.5 py-2.5 text-slate-600 xl:table-cell">
                                <span title={formatPhone(row.whatsappNum)} className="block min-w-0 max-w-full truncate px-1 py-1 font-medium text-slate-700">
                                  {row.whatsappNum === "N/A" ? "—" : formatPhone(row.whatsappNum)}
                                </span>
                              </td>
                              <td className="min-w-0 px-1.5 py-2.5 text-slate-600">
                                <span title={formatDisplay(row.studyDesc)} className="block truncate font-medium">{formatDisplay(row.studyDesc)}</span>
                              </td>
                              <td className="hidden whitespace-nowrap px-1.5 py-2.5 font-mono text-xs text-slate-700 xl:table-cell">
                                <span title={formatDisplay(row.accessionNum)} className="px-1.5 py-1 text-sm font-semibold">
                                  {formatDisplay(row.accessionNum)}
                                </span>
                              </td>
                              <td className="hidden whitespace-nowrap px-1.5 py-2.5 font-medium text-slate-700 sm:table-cell">{formatDisplay(row.createdOn)}</td>
                              <td title={formatDisplay(row.reportCreationDate)} className="hidden truncate whitespace-nowrap px-1.5 py-2.5 text-slate-600 sm:table-cell">{formatDisplay(row.reportCreationDate)}</td>
                              <td title={formatDisplay(row.sentAt)} className="hidden truncate whitespace-nowrap px-1.5 py-2.5 text-slate-600 xl:table-cell">{formatDisplay(row.sentAt) === "—" ? "—" : row.sentAt}</td>
                              <td className="hidden whitespace-nowrap px-1.5 py-2.5 font-mono text-xs tabular-nums xl:table-cell">
                                <span title={`Elapsed from report received (${row.reportCreationDate}) to ${row.sentAt === "N/A" ? "now" : `sent at ${row.sentAt}`}. Amber after 2 hours; red after 4 hours.`} className={`inline-flex rounded-md px-2 py-1 font-medium ${findWaitColor(row.timer)}`}>
                                  {row.timer === "00:00:00" ? "—" : row.timer}
                                </span>
                              </td>
                              <td className="px-1.5 py-2.5 pr-4">
                                <StateBadge state={row.state} />
                              </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {filteredData.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:px-5">
              <p className="text-sm text-slate-600">
                Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, filteredData.length)} of {filteredData.length} studies
                <span className="ml-2 text-slate-500">25 per page</span>
              </p>
              <nav aria-label="Study pages" className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <span aria-live="polite" className="min-w-24 text-center text-sm font-medium tabular-nums text-slate-700">
                  Page {page} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(Math.min(pageCount, page + 1))}
                  disabled={page === pageCount}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </Card>
      </PageBody>

    </>
  );
}
