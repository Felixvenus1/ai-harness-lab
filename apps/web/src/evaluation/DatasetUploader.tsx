// Purpose: Dataset upload component with drag-and-drop, schema mapper, and preview table.

import type { JSX } from "react";
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { uploadDataset, type DatasetMeta } from "../services/evaluationClient";

interface DatasetUploaderProps {
  onDatasetReady: (dataset: DatasetMeta) => void;
}

export function DatasetUploader({ onDatasetReady }: DatasetUploaderProps): JSX.Element {
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DatasetMeta | null>(null);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setStatus("uploading");
      setError(null);
      try {
        const meta = await uploadDataset(file);
        setResult(meta);
        setStatus("done");
        onDatasetReady(meta);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setStatus("error");
      }
    },
    [onDatasetReady],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/json": [".json"] },
    maxFiles: 1,
    disabled: status === "uploading",
  });

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-teal-400 bg-teal-950/30"
            : "border-zinc-700 hover:border-zinc-500"
        } ${status === "uploading" ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 text-zinc-400" size={32} />
        {isDragActive ? (
          <p className="text-teal-400 text-sm">Drop it here…</p>
        ) : (
          <>
            <p className="text-zinc-300 text-sm">Drag &amp; drop a CSV or JSON file here</p>
            <p className="text-zinc-500 text-xs mt-1">or click to browse · max 10MB</p>
          </>
        )}
      </div>

      {/* Status */}
      {status === "uploading" && (
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          Uploading and parsing…
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 rounded p-3">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {status === "done" && result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 size={16} />
            <span>
              <strong>{result.name}</strong> — {result.row_count} rows loaded
            </span>
          </div>

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-400 text-xs bg-amber-950/30 rounded p-2">
                  <AlertCircle size={12} className="mt-0.5 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Schema fields detected */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <FieldPill label="Input field" value={result.input_field} />
            <FieldPill label="Reference field" value={result.reference_field || "—"} />
            {result.label_field && <FieldPill label="Label field" value={result.label_field} />}
            {result.group_field && <FieldPill label="Group field" value={result.group_field} />}
          </div>

          {/* Preview table */}
          {result.preview && result.preview.length > 0 && (
            <div className="overflow-x-auto">
              <p className="text-zinc-500 text-xs mb-1">First {result.preview.length} rows</p>
              <table className="min-w-full text-xs border border-zinc-800 rounded">
                <thead>
                  <tr className="bg-zinc-800">
                    {Object.keys(result.preview[0]).map((k) => (
                      <th key={k} className="px-2 py-1 text-left text-zinc-400 font-medium whitespace-nowrap">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((row, i) => (
                    <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-2 py-1 text-zinc-300 max-w-48 truncate">
                          {String(v ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-1">
      <FileText size={10} className="text-zinc-500" />
      <span className="text-zinc-500">{label}:</span>
      <span className="text-zinc-200 font-mono">{value}</span>
    </div>
  );
}
