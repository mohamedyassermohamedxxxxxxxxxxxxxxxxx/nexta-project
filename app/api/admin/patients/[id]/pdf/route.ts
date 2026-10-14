/* app/api/admin/patients/[id]/pdf/route.ts
 * Serves a job's PDF: ?n=all merges every file into one (in print order,
 * cached on disk), ?n=0 / ?n=1 / … serves a single file. Files are streamed
 * from disk rather than loaded into memory; PDFs stored inside ETIAM's
 * database are read from there. */
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { jobPdfFile, notifyJobsChanged, readJobPdf } from "@/lib/etiam-sync";
import { addManualPdf, getJob, sharedPdfKeys } from "@/lib/nexta-db";
import { toPatientRecord } from "@/lib/patient-data";
import { mergedPdf } from "@/lib/pdf-merge";

export const dynamic = "force-dynamic";

function pdfResponse(source: { file: string } | { bytes: Buffer }, filename: string, download: boolean) {
  const headers: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  };
  if ("file" in source) {
    headers["Content-Length"] = String(fs.statSync(source.file).size);
    const stream = Readable.toWeb(fs.createReadStream(source.file)) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers });
  }
  headers["Content-Length"] = String(source.bytes.length);
  return new Response(new Uint8Array(source.bytes), { headers });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const job = getJob(Number(id));
  if (!job) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const url = new URL(req.url);
  const all = url.searchParams.get("n") === "all";
  const index = all ? 0 : Math.max(0, Number(url.searchParams.get("n")) || 0);

  let source: { file: string } | { bytes: Buffer } | null;
  if (all) {
    source = await mergedPdf(job);
  } else {
    const file = jobPdfFile(job, index);
    const bytes = file ? null : readJobPdf(job, index); // stored inside ETIAM's database
    source = file ? { file } : bytes ? { bytes } : null;
  }
  if (!source) return NextResponse.json({ error: "PDF not available" }, { status: 404 });

  const part = all ? "" : index > 0 ? `_${index + 1}` : "";
  const filename = `${job.patient_name || "report"} - ${job.accession || job.id}${part}.pdf`.replace(/[^\w .-]/g, "_");
  return pdfResponse(source, filename, url.searchParams.has("download"));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const jobId = Number(id);
  const job = Number.isInteger(jobId) ? getJob(jobId) : undefined;
  if (!job) return NextResponse.json({ error: "Patient not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a PDF file to upload" }, { status: 400 });
  }
  if (file.size === 0 || file.size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "PDF files must be smaller than 30 MB" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return NextResponse.json({ error: "The selected file is not a valid PDF" }, { status: 400 });
  }

  const databasePath = path.resolve(process.env.NEXTA_DB_PATH || path.join(process.cwd(), "data", "nexta.db"));
  const uploadDirectory = path.join(path.dirname(databasePath), "manual-pdf");
  const filePath = path.join(uploadDirectory, `patient-${jobId}-${randomUUID()}.pdf`);
  try {
    await fsPromises.mkdir(uploadDirectory, { recursive: true });
    await fsPromises.writeFile(filePath, bytes, { flag: "wx" });
    const updated = addManualPdf(jobId, filePath);
    if (!updated) {
      await fsPromises.unlink(filePath);
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }
    notifyJobsChanged([jobId]);
    return NextResponse.json({ data: toPatientRecord(updated, sharedPdfKeys()) });
  } catch (error) {
    await fsPromises.unlink(filePath).catch(() => undefined);
    console.error("Manual PDF upload failed:", error);
    return NextResponse.json({ error: "Could not save the uploaded PDF" }, { status: 500 });
  }
}
