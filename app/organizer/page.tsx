'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock3,
  GripVertical,
  Hash,
  IdCard,
  MessageSquareOff,
  PlugZap,
  RefreshCw,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { useSearch } from '@/context/SearchContext';
import DateFilterBar from '@/components/DateFilterBar';
import type { PatientRecord } from '@/lib/patient-data';
import { matchesDate } from '@/lib/date-filter';
import { STATE_ORDER, STATES, getStateKey, type StateKey } from '@/lib/patient-states';
import { matchesSearch, usePatients } from '@/lib/use-patients';
import { Avatar, ErrorBanner, HeroButton, PageBody, PageHero, SyncNotice, TruncatedNotice } from '@/components/ui';

type Toast = { kind: 'success' | 'error'; message: string };

const hasPhone = (p: PatientRecord) => p.whatsappNum !== 'N/A';

const STATE_STYLES: Record<StateKey, { icon: typeof Clock3; tone: string; number: string; tile: string; hoverTile: string; activeTile: string; preview: string }> = {
  waiting: { icon: Clock3, tone: 'text-slate-600 bg-slate-100', number: 'text-slate-700', tile: 'border-slate-200', hoverTile: 'hover:bg-slate-50 focus-visible:bg-slate-50 hover:border-slate-300 focus-visible:border-slate-300 hover:ring-2 focus-visible:ring-2 hover:ring-slate-200 focus-visible:ring-slate-200', activeTile: 'bg-slate-50 border-slate-300 ring-2 ring-slate-200', preview: 'border-slate-200 bg-slate-50' },
  no_number: { icon: Ban, tone: 'text-orange-700 bg-orange-100', number: 'text-orange-700', tile: 'border-orange-200', hoverTile: 'hover:bg-orange-50 focus-visible:bg-orange-50 hover:border-orange-300 focus-visible:border-orange-300 hover:ring-2 focus-visible:ring-2 hover:ring-orange-200 focus-visible:ring-orange-200', activeTile: 'bg-orange-50 border-orange-300 ring-2 ring-orange-200', preview: 'border-orange-200 bg-orange-50' },
  pending: { icon: Send, tone: 'text-blue-700 bg-blue-100', number: 'text-blue-700', tile: 'border-blue-200', hoverTile: 'hover:bg-blue-50 focus-visible:bg-blue-50 hover:border-blue-300 focus-visible:border-blue-300 hover:ring-2 focus-visible:ring-2 hover:ring-blue-200 focus-visible:ring-blue-200', activeTile: 'bg-blue-50 border-blue-300 ring-2 ring-blue-200', preview: 'border-blue-200 bg-blue-50' },
  sent: { icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-100', number: 'text-emerald-700', tile: 'border-emerald-200', hoverTile: 'hover:bg-emerald-50 focus-visible:bg-emerald-50 hover:border-emerald-300 focus-visible:border-emerald-300 hover:ring-2 focus-visible:ring-2 hover:ring-emerald-200 focus-visible:ring-emerald-200', activeTile: 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-200', preview: 'border-emerald-200 bg-emerald-50' },
  failed: { icon: TriangleAlert, tone: 'text-red-700 bg-red-100', number: 'text-red-700', tile: 'border-red-200', hoverTile: 'hover:bg-red-50 focus-visible:bg-red-50 hover:border-red-300 focus-visible:border-red-300 hover:ring-2 focus-visible:ring-2 hover:ring-red-200 focus-visible:ring-red-200', activeTile: 'bg-red-50 border-red-300 ring-2 ring-red-200', preview: 'border-red-200 bg-red-50' },
  no_whatsapp: { icon: MessageSquareOff, tone: 'text-fuchsia-700 bg-fuchsia-100', number: 'text-fuchsia-700', tile: 'border-fuchsia-200', hoverTile: 'hover:bg-fuchsia-50 focus-visible:bg-fuchsia-50 hover:border-fuchsia-300 focus-visible:border-fuchsia-300 hover:ring-2 focus-visible:ring-2 hover:ring-fuchsia-200 focus-visible:ring-fuchsia-200', activeTile: 'bg-fuchsia-50 border-fuchsia-300 ring-2 ring-fuchsia-200', preview: 'border-fuchsia-200 bg-fuchsia-50' },
  signed_out: { icon: PlugZap, tone: 'text-violet-700 bg-violet-100', number: 'text-violet-700', tile: 'border-violet-200', hoverTile: 'hover:bg-violet-50 focus-visible:bg-violet-50 hover:border-violet-300 focus-visible:border-violet-300 hover:ring-2 focus-visible:ring-2 hover:ring-violet-200 focus-visible:ring-violet-200', activeTile: 'bg-violet-50 border-violet-300 ring-2 ring-violet-200', preview: 'border-violet-200 bg-violet-50' },
};

/** Why a card can't go into a column, or null if it can. Mirrors the server's rules. */
function blockedReason(p: PatientRecord, target: StateKey): string | null {
  if (getStateKey(p.state) === target) return 'Already here';
  if (target === 'waiting') return 'Set automatically until the PDF is found';
  if ((target === 'pending' || target === 'no_number') && p.pdfs.length === 0) return "PDF hasn't been found yet";
  if (target === 'pending' && !hasPhone(p)) return 'Needs a WhatsApp number';
  if (target === 'no_number' && hasPhone(p)) return 'Has a WhatsApp number';
  return null;
}

export default function PatientBoard() {
  const { searchQuery, dateFilter } = useSearch();
  const { data, total, sync, isLoading, error, refresh, replaceRecord } = usePatients(dateFilter);
  const router = useRouter();

  const [dragged, setDragged] = useState<PatientRecord | null>(null);
  const [overColumn, setOverColumn] = useState<StateKey | null>(null);
  // Optimistic moves: shown in the new column while the server confirms
  const [pendingMoves, setPendingMoves] = useState<Record<number, StateKey>>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [hoveredState, setHoveredState] = useState<StateKey | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(STATE_ORDER.map((key) => [key, [] as PatientRecord[]])) as Record<
      StateKey,
      PatientRecord[]
    >;
    data
      .filter((p) => matchesSearch(p, searchQuery) && matchesDate(p.createdOn, dateFilter))
      .forEach((p) => groups[pendingMoves[p.id] ?? getStateKey(p.state)].push(p));
    return groups;
  }, [data, searchQuery, dateFilter, pendingMoves]);

  const moveCard = async (patient: PatientRecord, target: StateKey) => {
    const meta = STATES[target];
    setPendingMoves((m) => ({ ...m, [patient.id]: target }));
    try {
      const res = await fetch(`/api/admin/patients/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: meta.dbState }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not move the card');
      replaceRecord(result.data);
      setToast({ kind: 'success', message: `${patient.patientName} moved to ${meta.label}` });
    } catch (err: unknown) {
      setToast({ kind: 'error', message: err instanceof Error ? err.message : 'Could not move the card' });
    } finally {
      setPendingMoves((moves) => {
        const remaining = { ...moves };
        delete remaining[patient.id];
        return remaining;
      });
    }
  };
  const endDrag = () => {
    setDragged(null);
    setOverColumn(null);
  };

  const renderPatientCard = (p: PatientRecord) => (
    <div
      key={p.id}
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(p.id));
        e.dataTransfer.effectAllowed = 'move';
        setDragged(p);
      }}
      onDragEnd={endDrag}
      onClick={() => router.push(`/patient/${p.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && router.push(`/patient/${p.id}`)}
      className={`group cursor-grab rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/20 active:cursor-grabbing ${
        dragged?.id === p.id ? 'opacity-40' : ''
      } ${pendingMoves[p.id] ? 'animate-pulse' : ''}`}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={p.patientName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p title={p.patientName} className="truncate text-sm font-semibold text-ink-900 group-hover:text-brand-600">
              {p.patientName}
            </p>
            {p.modality && p.modality !== 'N/A' && (
              <span title={p.modality} className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-bold text-brand-700">
                {p.modality}
              </span>
            )}
          </div>
          <p title={p.studyDesc} className="mt-0.5 truncate text-xs text-slate-500">{p.studyDesc}</p>
        </div>
        <GripVertical aria-label="Drag study" className="-mr-1 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400" />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">
        <span title={`Patient ID: ${p.patientId}`} className="flex min-w-0 items-center gap-1">
          <IdCard className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{p.patientId}</span>
        </span>
        <span title={`Accession number: ${p.accessionNum}`} className="flex min-w-0 items-center gap-1 font-mono">
          <Hash className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{p.accessionNum}</span>
        </span>
      </div>
    </div>
  );

  const previewState = hoveredState;

  return (
    <>
      <PageHero
        title="Delivery board"
        subtitle="Drag a card to another column to change its status."
        actions={
          <>
            <DateFilterBar />
            <HeroButton onClick={refresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </HeroButton>
          </>
        }
      />

      <PageBody>
        {error && <ErrorBanner message={error} />}
        <SyncNotice sync={sync} />
        <TruncatedNotice shown={data.length} total={total} />

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7">
          {STATE_ORDER.map((key, index) => {
            const meta = STATES[key];
            const patients = grouped[key];
            const reason = dragged ? blockedReason(dragged, key) : null;
            const isSource = dragged ? getStateKey(dragged.state) === key : false;
            const canDrop = !!dragged && !reason;
            const isOver = canDrop && overColumn === key;
            const { icon: Icon, tone, number, tile, hoverTile, activeTile, preview } = STATE_STYLES[key];
            const isPreviewActive = hoveredState === key && !dragged;

            return (
              <div
                key={key}
                className="relative min-w-0"
                onMouseEnter={() => setHoveredState(key)}
                onMouseLeave={() => setHoveredState((current) => current === key ? null : current)}
                onFocusCapture={() => setHoveredState(key)}
                onBlurCapture={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setHoveredState((current) => current === key ? null : current);
                  }
                }}
              >
                <div
                  role="group"
                  tabIndex={0}
                  aria-label={`${meta.label}: ${patients.length} studies`}
                onDragOver={(e) => {
                  if (!canDrop) return; // not calling preventDefault = drop not allowed
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (overColumn !== key) setOverColumn(key);
                }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverColumn(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragged && canDrop) moveCard(dragged, key);
                    endDrag();
                  }}
                  className={`flex min-h-28 min-w-0 items-center gap-3 rounded-2xl border p-4 text-left shadow-sm shadow-ink-900/5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none sm:gap-3.5 ${tile} ${isPreviewActive ? activeTile : `bg-white ${hoverTile}`} ${
                    isOver ? 'ring-2 ring-brand-400' : canDrop ? 'ring-2 ring-brand-200' : ''
                  } ${
                    dragged && !canDrop && !isSource ? 'opacity-50' : ''
                  }`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-2xl font-bold leading-7 ${number}`}>{isLoading ? '–' : patients.length}</span>
                    <span className={`block font-medium leading-5 text-slate-600 ${key === 'signed_out' ? 'whitespace-nowrap text-[11px]' : 'text-sm'}`}>
                      {meta.label}
                    </span>
                  </span>
                  {dragged && !isSource && (
                    <span className="sr-only">{canDrop ? 'Drop here' : reason}</span>
                  )}
                </div>

                {previewState === key && !dragged && (
                  <section
                    aria-label={`${meta.label} study preview`}
                    className={`absolute top-full z-30 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border p-3 shadow-xl shadow-ink-900/15 ${preview} ${
                      index < 2 ? 'left-0' : 'right-0'
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between px-0.5 text-xs text-slate-500">
                      <span>Preview</span>
                      <span>{patients.length} {patients.length === 1 ? 'study' : 'studies'}</span>
                    </div>
                    <div className="scroll-thin flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white" />)
                      ) : patients.length ? (
                        patients.map(renderPatientCard)
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-3 py-6 text-center text-sm text-slate-500">
                          No studies in this status
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-4 text-center text-sm text-slate-500">
          Hover over a status to preview its studies.
        </p>
      </PageBody>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl ${
            toast.kind === 'success' ? 'bg-ink-900' : 'bg-rose-600'
          }`}
        >
          {toast.kind === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-teal-300" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.message}
        </div>
      )}
    </>
  );
}
