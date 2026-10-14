"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CheckCircle2, CircleAlert, Copy, Eye, FileText, Hash, IdCard, Loader2, MessageCircle, Printer, RefreshCw, Send, Stethoscope, Upload, X } from "lucide-react";
import PatientPdfViewer from "./PatientPdfViewer";
import type { PatientRecord } from "@/lib/patient-data";
import { getStateMeta } from "@/lib/patient-states";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { usePatient } from "@/lib/use-patients";
import { Avatar, Card, ErrorBanner, PageBody, PageHero } from "@/components/ui";

type StepStatus = "done" | "current" | "error" | "upcoming";

function displayValue(value: string | null | undefined) {
  return !value || value === "N/A" ? "—" : value;
}

function DetailRow({
  label,
  value,
  mono,
  valueClassName = "",
  valueTitle,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
  valueTitle?: string;
}) {
  const shownValue = displayValue(value);
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5 py-2.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd title={valueTitle} className={`max-w-full truncate text-left text-sm font-semibold text-ink-900 ${mono ? "font-mono" : ""} ${valueClassName}`}>{shownValue}</dd>
    </div>
  );
}

function statusColors(state: string) {
  const key = getStateMeta(state).key;
  if (key === "sent") return { badge: "bg-emerald-100 text-emerald-800 ring-emerald-600/25", dot: "bg-emerald-500" };
  if (key === "failed") return { badge: "bg-rose-100 text-rose-800 ring-rose-600/25", dot: "bg-rose-500" };
  if (key === "waiting") return { badge: "bg-slate-100 text-slate-600 ring-slate-500/20", dot: "bg-slate-400" };
  if (key === "no_number" || key === "pending") return { badge: "bg-amber-100 text-amber-900 ring-amber-600/30", dot: "bg-amber-500" };
  if (key === "no_whatsapp") return { badge: "bg-sky-100 text-sky-800 ring-sky-600/25", dot: "bg-sky-500" };
  if (key === "signed_out") return { badge: "bg-violet-100 text-violet-800 ring-violet-600/25", dot: "bg-violet-500" };
  return { badge: "bg-blue-100 text-blue-800 ring-blue-600/25", dot: "bg-blue-500" };
}

function waitingTimeTone(timer: string) {
  const [hours, minutes, seconds] = timer.split(":").map(Number);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  if (!Number.isFinite(totalSeconds)) return "bg-slate-100 text-slate-600";
  if (totalSeconds >= 4 * 3600) return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  if (totalSeconds >= 2 * 3600) return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  return "bg-slate-100 text-slate-600";
}

function localEgyptianNumber(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = digits.slice(4);
  else if (digits.startsWith("20") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  return digits.slice(0, 10);
}

function formatLocalEgyptianNumber(value: string) {
  const digits = localEgyptianNumber(value);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function internationalEgyptianNumber(value: string) {
  const digits = localEgyptianNumber(value);
  return digits ? `+20${digits}` : "";
}

function elapsedTimer(patient: PatientRecord, now: number) {
  if (!now || patient.sentAt !== "N/A") return patient.timer;
  const [date, time] = patient.reportCreationDate.split(" ");
  const startedAt = new Date(`${date}T${time}:00`).getTime();
  if (!Number.isFinite(startedAt)) return patient.timer;
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function Step({
  title,
  detail,
  status,
  timer,
  last,
}: {
  title: string;
  detail?: string;
  status: StepStatus;
  timer?: string;
  last?: boolean;
}) {
  const bubble = {
    done: "bg-emerald-500 text-white",
    current: "bg-brand-500 text-white ring-4 ring-brand-500/20",
    error: "bg-rose-500 text-white ring-4 ring-rose-500/20",
    upcoming: "bg-slate-100 text-slate-400",
  }[status];

  return (
    <li className="relative flex gap-3 pb-6 last:pb-0">
      {!last && (
        <span
          className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${
            status === "done" ? "bg-emerald-300" : "bg-slate-200"
          }`}
        />
      )}
      <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bubble}`}>
        {status === "done" && <Check className="h-4 w-4" />}
        {status === "error" && <X className="h-4 w-4" />}
        {status === "current" && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
      </span>
      <div className="pt-0.5">
        <p className={`text-sm font-semibold ${status === "upcoming" ? "text-slate-400" : "text-ink-900"}`}>
          {title}
        </p>
        {detail && (
          <p className={`text-xs ${status === "error" ? "text-rose-600" : "text-slate-500"}`}>{detail}</p>
        )}
        {timer && (
          <span className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${waitingTimeTone(timer)}`}>
            Waiting {timer} since print job
          </span>
        )}
      </div>
    </li>
  );
}

export default function PatientDetailView({ patientId }: { patientId: string }) {
  const { patient: found, isLoading, error, refresh: refreshPatient } = usePatient(patientId);
  const reportRef = useRef<HTMLDivElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [isCheckingPdf, setIsCheckingPdf] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfActionError, setPdfActionError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [clock, setClock] = useState(0);

  // Last number received from the server, so live updates don't overwrite what the user is typing
  const syncedPhone = useRef("");

  useEffect(() => {
    if (!found) return;
    setPatient(found);
    const phone = !found.whatsappNum || found.whatsappNum === "N/A" ? "" : formatLocalEgyptianNumber(found.whatsappNum);
    // Capture now: the updater runs later, after the ref below is overwritten
    const previous = syncedPhone.current;
    setPhoneDraft((draft) => (draft === previous ? phone : draft));
    syncedPhone.current = phone;
    setLastChecked(new Date());
  }, [found]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const savedPhone = patient && patient.whatsappNum !== "N/A" ? normalizePhone(patient.whatsappNum) : "";
  const phoneDirty = internationalEgyptianNumber(phoneDraft) !== savedPhone;
  const phoneDigits = localEgyptianNumber(phoneDraft);
  const phoneIsValid = /^1[0125]\d{8}$/.test(phoneDigits);
  const phoneSourceLabel = phoneDirty
    ? "Edited · unsaved"
    : savedPhone
      ? patient?.phoneSource === "manual" ? "Edited manually" : "From hospital system"
      : "No number on file";

  const savePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNum: internationalEgyptianNumber(phoneDraft) }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Could not save the number");
      const phone = result.data.whatsappNum === "N/A" ? "" : formatLocalEgyptianNumber(result.data.whatsappNum);
      setPatient(result.data);
      setPhoneDraft(phone);
      syncedPhone.current = phone;
      setSaveState("saved");
      setCopyState("idle");
      setCopyState("idle");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save the number");
      setSaveState("idle");
    }
  };

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(internationalEgyptianNumber(phoneDraft));
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  const checkPdfAgain = async () => {
    setIsCheckingPdf(true);
    setPdfActionError(null);
    try {
      const response = await fetch("/api/admin/patients?sync", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not check for the report PDF");
      await refreshPatient();
      setLastChecked(new Date());
    } catch (err) {
      setPdfActionError(err instanceof Error ? err.message : "Could not check for the report PDF");
    } finally {
      setIsCheckingPdf(false);
    }
  };

  const uploadPdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !patient) return;
    setIsUploadingPdf(true);
    setPdfActionError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/admin/patients/${patient.id}/pdf`, { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not upload the report PDF");
      setPatient(result.data);
      setLastChecked(new Date());
    } catch (err) {
      setPdfActionError(err instanceof Error ? err.message : "Could not upload the report PDF");
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const steps = useMemo(() => {
    if (!patient) return [];
    const meta = getStateMeta(patient.state);
    const hasPhone = patient.whatsappNum !== "N/A";
    const hasPdf = patient.pdfs.length > 0;

    const sendStep: { status: StepStatus; detail?: string } =
      meta.key === "sent"
        ? { status: "done", detail: patient.sentAt }
        : meta.isIssue && meta.key !== "no_number"
          ? { status: "error", detail: meta.label }
          : meta.key === "pending"
            ? { status: "current", detail: "Ready, waiting for the sender" }
            : { status: "upcoming" };

    const timer = elapsedTimer(patient, clock);
    return [
      { title: "Print job received", detail: patient.reportCreationDate, status: "done" as StepStatus },
      {
        title: "Report PDF",
        detail: hasPdf
          ? patient.pdfs.filter((p) => !p.url.endsWith("n=all")).map((p) => p.label).join(", ")
          : patient.pdfBlockedReason
            ? "Can't be matched automatically"
            : `Waiting for ${patient.pdfExpectedName ?? "the PDF"}`,
        status: (hasPdf ? "done" : patient.pdfBlockedReason ? "error" : "current") as StepStatus,
        timer: hasPdf ? undefined : timer,
      },
      {
        title: "WhatsApp number",
        detail: hasPhone
          ? `${formatPhone(patient.whatsappNum)} · ${patient.phoneSource === "manual" ? "entered manually" : "from hospital system"}`
          : "Missing, add it below",
        // Only a problem once the PDF is there and nothing else is holding it up
        status: (hasPhone ? "done" : hasPdf ? "error" : "upcoming") as StepStatus,
      },
      { title: "Sent on WhatsApp", ...sendStep },
    ];
  }, [patient, clock]);

  const hasPdf = patient?.pdfs.length ? patient.pdfs.length > 0 : false;
  const sendReason = !hasPdf
    ? "A report PDF is not available yet."
    : !savedPhone
      ? "Add a valid WhatsApp number first."
      : getStateMeta(patient?.state).key === "no_whatsapp"
        ? "This number is not registered on WhatsApp."
        : "WhatsApp sending is not connected in this app.";

  const previewReport = () => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const printReport = () => {
    if (hasPdf) window.print();
  };

  const backLink = (
    <Link
      href="/admin"
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-white/80 transition hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to dashboard
    </Link>
  );

  if (isLoading || !patient) {
    return (
      <>
        <PageHero title={isLoading ? "Loading patient…" : "Patient not found"}>{backLink}</PageHero>
        <PageBody>
          {error && <ErrorBanner message={error} />}
          <Card className="p-10 text-center text-slate-500">
            {isLoading ? (
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
            ) : (
              "We couldn't find this patient. They may have been removed from the print queue."
            )}
          </Card>
        </PageBody>
      </>
    );
  }

  return (
    <>
      <PageHero
        titleClassName="font-sans [text-shadow:none]"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={patient.patientName} size="lg" statusDot={statusColors(patient.state).dot} />
            <span>{patient.patientName}</span>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${statusColors(patient.state).badge}`}>
              <span className={`h-2 w-2 rounded-full ${statusColors(patient.state).dot}`} />
              {getStateMeta(patient.state).label}
            </span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <span className="flex items-center gap-1.5">
              <IdCard className="h-4 w-4" /> {displayValue(patient.patientId)}
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Hash className="h-4 w-4" /> {displayValue(patient.accessionNum)}
            </span>
            <span className="flex items-center gap-1.5">
              <Stethoscope className="h-4 w-4" /> {displayValue(patient.modality)} · {displayValue(patient.studyDesc)}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={previewReport} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20">
              <Eye className="h-4 w-4" /> Preview
            </button>
            <button type="button" onClick={printReport} disabled={!hasPdf} title={hasPdf ? "Print the report" : "A report PDF is not available yet."} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button type="button" disabled title={sendReason} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white/60 disabled:cursor-not-allowed">
              <Send className="h-4 w-4" /> Send on WhatsApp
            </button>
            <span className="max-w-56 text-xs text-white/80">{sendReason}</span>
          </div>
        }
      >
        {backLink}
      </PageHero>

      <PageBody>
        <div className="mx-auto grid w-full max-w-6xl items-stretch gap-4 lg:grid-cols-[1.1fr_1fr]">
          <Card className="h-full p-5">
            <h2 className="mb-4 font-semibold text-ink-900">Delivery progress</h2>
            <ol>
              {steps.map((step, i) => (
                <Step key={step.title} {...step} last={i === steps.length - 1} />
              ))}
            </ol>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="px-5 py-3">
              <h2 className="py-2 font-semibold text-ink-900">Study details</h2>
              <dl className="grid grid-cols-2 gap-x-6 divide-y divide-slate-100">
                <DetailRow label="Study date" value={patient.createdOn} />
                <DetailRow label="Received from ETIAM" value={patient.reportCreationDate} />
                <DetailRow label="Sent at" value={patient.sentAt} />
                <DetailRow
                  label="Waiting time"
                  value={elapsedTimer(patient, clock)}
                  mono
                  valueClassName={`rounded-md px-2 py-1 ${waitingTimeTone(elapsedTimer(patient, clock))}`}
                  valueTitle="Time since the print job was received. Amber after 2 hours; red after 4 hours."
                />
              </dl>
            </Card>

            <Card className="p-5">
              <form onSubmit={savePhone}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <label htmlFor="whatsapp" className="flex items-center gap-2 font-semibold text-ink-900">
                    <MessageCircle className="h-4 w-4 text-teal-500" />
                    WhatsApp number
                  </label>
                  <span
                    title={phoneDirty
                      ? "This change has not been saved yet. Saving will replace the current number and re-queue the report."
                      : patient.phoneSource === "manual"
                        ? "This number was entered manually and takes priority over the hospital system."
                        : "This number was read from the hospital system."}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${phoneDirty ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-500"}`}
                  >
                    {phoneSourceLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <div className="relative flex min-w-0 flex-1 items-center rounded-xl border border-slate-200 bg-slate-50 focus-within:border-teal-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-teal-400/20">
                    <span className="shrink-0 border-r border-slate-200 px-3 text-sm text-slate-500">+20</span>
                    <input
                      id="whatsapp"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={phoneDraft}
                      placeholder="112 711 4501"
                      aria-invalid={phoneDraft.trim().length > 0 && !phoneIsValid}
                      aria-describedby="whatsapp-feedback"
                      onChange={(e) => {
                        setPhoneDraft(formatLocalEgyptianNumber(e.target.value));
                        setSaveError(null);
                        setCopyState("idle");
                      }}
                      className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm text-ink-900 outline-none"
                    />
                    {phoneDraft.trim() && (
                      <span className="mr-3 shrink-0" title={phoneIsValid ? "Valid Egyptian mobile number" : "Enter a valid 10-digit Egyptian mobile number"}>
                        {phoneIsValid
                          ? <CheckCircle2 aria-label="Valid phone number" className="h-4 w-4 text-emerald-600" />
                          : <CircleAlert aria-label="Invalid phone number" className="h-4 w-4 text-rose-600" />}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyPhone()}
                    disabled={!phoneIsValid}
                    title="Copy number in international format"
                    aria-label="Copy WhatsApp number"
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
                  >
                    {copyState === "copied" ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    type="submit"
                    disabled={!phoneIsValid || saveState === "saving"}
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                  >
                    {saveState === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {saveState === "saved" && <Check className="h-4 w-4" />}
                    {saveState === "saved" ? "Queued" : "Save and send"}
                  </button>
                </div>
                {saveError ? (
                  <p id="whatsapp-feedback" role="alert" className="mt-2 text-xs text-rose-600">{saveError}</p>
                ) : phoneDraft.trim() && !phoneIsValid ? (
                  <p id="whatsapp-feedback" className="mt-2 text-xs text-rose-600">Enter a valid 10-digit Egyptian mobile number.</p>
                ) : copyState === "copied" ? (
                  <p id="whatsapp-feedback" aria-live="polite" className="mt-2 text-xs text-emerald-700">Number copied in international format.</p>
                ) : copyState === "error" ? (
                  <p id="whatsapp-feedback" role="status" className="mt-2 text-xs text-rose-600">Could not copy the number.</p>
                ) : (
                  <p id="whatsapp-feedback" className="mt-2 text-xs text-slate-500">
                    Saving updates the number and returns the report to the send queue. Manual numbers take priority over the hospital system.
                  </p>
                )}
              </form>
            </Card>
          </div>
        </div>

        <div ref={reportRef} id="patient-report" className="patient-report mx-auto mt-6 w-full max-w-6xl scroll-mt-6">
          <Card className="p-5">
            <h2 className="patient-report-heading mb-1 flex items-center gap-2 font-semibold text-ink-900">
              <FileText className="h-4 w-4 text-brand-500" />
              Report
            </h2>
            {hasPdf ? (
              <PatientPdfViewer pdfs={patient.pdfs} />
            ) : (
              <div className="flex min-h-[250px] flex-col items-center justify-center px-4 py-8 text-center">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <FileText className="h-6 w-6" />
                </span>
                <h3 className="font-semibold text-ink-900">Waiting for {patient.pdfExpectedName ?? "report PDF"}</h3>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  {patient.pdfBlockedReason ?? "The report has not arrived yet. This page updates when it does."}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void checkPdfAgain()}
                    disabled={isCheckingPdf || isUploadingPdf}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${isCheckingPdf ? "animate-spin" : ""}`} />
                    {isCheckingPdf ? "Checking" : "Check again"}
                  </button>
                  <input ref={uploadInput} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={uploadPdf} />
                  <button
                    type="button"
                    onClick={() => uploadInput.current?.click()}
                    disabled={isCheckingPdf || isUploadingPdf}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-ink-800 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isUploadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {isUploadingPdf ? "Uploading" : "Upload PDF manually"}
                  </button>
                </div>
                {pdfActionError && <p role="alert" className="mt-3 text-sm text-rose-600">{pdfActionError}</p>}
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Live · last checked {lastChecked?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "just now"}
                </p>
              </div>
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
