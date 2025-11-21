// App.tsx
import { useState, useRef, useEffect } from "react";
import type React from "react";
import "./App.css";
import {
  FileText,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader,
  Database,
  ClipboardList,
  Zap,
  ShieldCheck,
  History as HistoryIcon,
  Clock,
  Trash2,
  Edit3,
  Search,
  AlertTriangle,
  Upload,
  RotateCcw,
  XCircle as XCircleIcon,
} from "lucide-react";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Polyfill (RFC4122 version 4)
  // @ts-ignore
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (c: any) =>
    (c ^ (typeof crypto !== "undefined" && crypto.getRandomValues
      ? crypto.getRandomValues(new Uint8Array(1))[0]
      : Math.random() * 16) >> (c / 4)).toString(16)
  );
}

// Function to get the backend URL dynamically from environment variable or window location
const getBackendUrl = (): string => {
  // Try to read from environment variable that would be injected during build (CRA/.env handling)
  // Also fallback to localhost for local development
  let envUrl = (typeof process !== "undefined"
    ? process.env.REACT_APP_BACKEND_URL
    : undefined) as string | undefined;
  // For frontend deployed statically: also allow reading from window.ENV or window.REACT_APP_BACKEND_URL if present
  if (
    !envUrl &&
    typeof window !== "undefined" &&
    (window as any).REACT_APP_BACKEND_URL
  ) {
    envUrl = (window as any).REACT_APP_BACKEND_URL;
  }
  // Fallback: for static deployments where a global ENV is injected (e.g., from nginx or an index.html inline script)
  if (
    !envUrl &&
    typeof window !== "undefined" &&
    (window as any).ENV &&
    (window as any).ENV.REACT_APP_BACKEND_URL
  ) {
    envUrl = (window as any).ENV.REACT_APP_BACKEND_URL;
  }

  // If not found, fallback to localhost
  if (!envUrl) {
    // Try to smartly guess backend URL based on frontend origin and add port 8080 and path "/v1"
    if (typeof window !== "undefined" && window.location) {
      const { protocol, hostname } = window.location;
      return `${protocol}//${hostname}:8080/v1`;
    }
    // Last fallback
    return "http://localhost:8080/v1";
  }

  // Ensure "/v1" is at the end if not already present
  const baseUrl = envUrl.endsWith("/v1")
    ? envUrl
    : envUrl.replace(/\/+$/, "") + "/v1";
  return baseUrl;
};

const API_BASE = getBackendUrl();

type Status = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | null;
interface ExtractionResult {
  fileId: string;
  runId: string;
  documentType: string;
  pages: Page[];
  warnings: string[];
  processingTimeMs: number;
}
interface Page {
  page: number;
  fields: Field[];
  tables: Table[];
}
interface Field {
  name: string;
  value: string | object;
  confidence?: number;
  bbox?: number[];
}
interface Table {
  name: string;
  rows: Record<string, any>[];
  confidence?: number;
}
interface HistoryItem {
  id: string;
  fileName: string;
  runId: string;
  status: Status;
  createdAt: string;
  docType?: string;
  processingTimeMs?: number;
}
interface UploadResponse {
  runId: string;
}
interface RunStatusResponse {
  status?: Status;
  error?: string;
  result?: ExtractionResult;
}
interface ExportRequest {
  runId: string;
  format: 'json' | 'csv';
}
interface ExtractionSummary {
  runId: string;
  documentType: string;
  avgConfidence: number;
  createdAt: string;
}

// ---------- main component ----------
const App = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractionResult | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [showJSON, setShowJSON] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1); // 1: Upload, 2: Process, 3: Review
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<Status | 'ALL'>('ALL');
  const [isPolling, setIsPolling] = useState<boolean>(false);
  // New state variables for CRUD operations
  const [extractionList, setExtractionList] = useState<ExtractionSummary[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [editJson, setEditJson] = useState<string>("");
  const [showExtractionList, setShowExtractionList] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Log current backend url for debugging
    console.log("Using API Base URL:", API_BASE);
  }, []);

  // ---------- drag & drop ----------
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };
  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (!validTypes.includes(selectedFile.type)) {
      setError("Please upload a valid image (JPG, PNG) or PDF file");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return;
    }
    setError(null);
    setFile(selectedFile);
    setExtractedData(null);
    setStatus(null);
    setRunId(null);
    setCurrentStep(2); // Move to processing step
    uploadToBackend(selectedFile);
  };

  // ---------- backend wiring ----------
  const uploadToBackend = (selectedFile: File) => {
    setUploadProgress(0);
    setIsProcessing(true);
    setStatus('QUEUED');
    const formData = new FormData();
    formData.append("file", selectedFile);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", API_BASE + "/uploads", true);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const resp: UploadResponse = JSON.parse(xhr.responseText);
            setRunId(resp.runId);
            setStatus("QUEUED");
            const newItem: HistoryItem = {
              id: generateUUID(), 
              fileName: selectedFile.name,
              runId: resp.runId,
              status: "QUEUED",
              createdAt: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            };
            setHistory((prev) => [newItem, ...prev].slice(0, 10)); // Keep max 10 items
            startPolling(resp.runId);
          } catch (e) {
            console.error(e);
            setError("Invalid response from server");
            setIsProcessing(false);
            setStatus(null);
          }
        } else {
          console.error(xhr.responseText);
          setError("Upload failed. Please try again.");
          setIsProcessing(false);
          setStatus(null);
        }
      }
    };
    xhr.onerror = () => {
      setError("Network error during upload");
      setIsProcessing(false);
      setStatus(null);
    };
    xhr.send(formData);
  };

  const startPolling = (id: string) => {
    setIsPolling(true);
    const poll = async () => {
      try {
        const res = await fetch(API_BASE + "/runs/" + id);
        if (!res.ok) throw new Error("Failed to fetch run status");
        const data: RunStatusResponse = await res.json();
        const newStatus = data.status || null;
        setStatus(newStatus);
        if (data.error) setError(data.error);
        if (data.result) {
          setExtractedData(data.result);
          setCurrentStep(3); // Move to review step
        }
        setHistory((prev) =>
          prev.map((item) =>
            item.runId === id
              ? {
                  ...item,
                  status: newStatus,
                  docType: data.result?.documentType ?? item.docType,
                  processingTimeMs: data.result?.processingTimeMs ?? item.processingTimeMs,
                }
              : item
          )
        );

        if (newStatus === "COMPLETED" || newStatus === "FAILED") {
          setIsProcessing(false);
          setUploadProgress(100);
          setIsPolling(false);
          return;
        }
        setTimeout(poll, 2000);
      } catch (err) {
        console.error(err);
        const msg =
          err instanceof Error ? err.message : "Error while polling run status";
        setError(msg);
        setIsPolling(false);
      }
    };
    poll();
  };

  const handleReset = () => {
    setFile(null);
    setExtractedData(null);
    setError(null);
    setUploadProgress(0);
    setIsProcessing(false);
    setRunId(null);
    setStatus(null);
    setShowJSON(false);
    setCurrentStep(1); // Back to upload step
  };

  // ---------- actions on extracted data ----------
  const copyToClipboard = () => {
    if (!extractedData) return;
    const text = JSON.stringify(extractedData, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = () => {
    if (!extractedData) return;
    const dataStr = JSON.stringify(extractedData, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);
    const exportFileDefaultName = "extracted-form-data.json";
    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  const downloadCSV = () => {
    if (!runId) return;
    const data: ExportRequest = {
      runId,
      format: 'csv'
    };
    fetch(API_BASE + "/exports", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    .then(response => response.blob())
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'extraction.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      console.error('Error downloading CSV:', err);
      setError('Failed to download CSV');
    });
  };

  // ---------- CRUD Operations for Extractions ----------
  const fetchAllExtractions = async () => {
    try {
      const response = await fetch(`${API_BASE}/extractions`);
      if (response.ok) {
        const data: ExtractionSummary[] = await response.json();
        setExtractionList(data);
      }
    } catch (error) {
      console.error("Error fetching extractions:", error);
      setError("Failed to fetch extractions");
    }
  };

  const handleEdit = (runId: string) => {
    const extraction = extractionList.find(e => e.runId === runId);
    if (extraction) {
      setEditingRunId(runId);
      setIsEditing(true);
      // Fetch the full extraction data to edit
      fetch(`${API_BASE}/extractions/${runId}`)
        .then(res => res.json())
        .then(data => {
          setEditJson(JSON.stringify(data, null, 2));
        })
        .catch(err => {
          console.error("Error fetching extraction for edit:", err);
          setError("Failed to load extraction for editing");
        });
    }
  };

  const handleSaveEdit = () => {
    if (!editingRunId || !editJson) return;
    try {
      const parsedJson = JSON.parse(editJson);
      fetch(`${API_BASE}/extractions/${editingRunId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedJson),
      })
      .then(response => {
        if (response.ok) {
          setIsEditing(false);
          setEditingRunId(null);
          // Refresh the extraction list
          fetchAllExtractions();
          // If this was the currently viewed extraction, update it
          if (extractedData && extractedData.runId === editingRunId) {
            setExtractedData(parsedJson);
          }
        } else {
          setError("Failed to save changes");
        }
      });
    } catch (error) {
      //setError("Invalid JSON format");
    }
  };

  const handleDelete = (runId: string) => {
    if (window.confirm("Are you sure you want to delete this extraction?")) {
      fetch(`${API_BASE}/extractions/${runId}`, {
        method: 'DELETE',
      })
      .then(response => {
        if (response.ok) {
          // Remove from local list
          setExtractionList(prev => prev.filter(e => e.runId !== runId));
          // If this was the currently viewed extraction, clear it
          if (extractedData && extractedData.runId === runId) {
            setExtractedData(null);
            setRunId(null);
            setCurrentStep(1);
          }
          // Also remove from history if present
          setHistory(prev => prev.filter(item => item.runId !== runId));
        } else {
          setError("Failed to delete extraction");
        }
      });
    }
  };

  const handleView = (runId: string) => {
    fetch(`${API_BASE}/extractions/${runId}`)
      .then(response => response.json())
      .then(data => {
        setExtractedData(data);
        setRunId(runId);
        setCurrentStep(3);
        setShowExtractionList(false);
      })
      .catch(error => {
        console.error("Error fetching extraction:", error);
        setError("Failed to load extraction");
      });
  };

  // ---------- history operations ----------
  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  const retryProcessing = (runId: string) => {
    const historyItem = history.find(item => item.runId === runId);
    if (!historyItem) return;
    setStatus('QUEUED');
    setRunId(runId);
    setCurrentStep(2);
    startPolling(runId);
  };

  const viewDetails = (runId: string) => {
    const historyItem = history.find(item => item.runId === runId);
    if (!historyItem) return;
    setExpandedRunId(expandedRunId === runId ? null : runId);
  };

  // Filter history based on search and filter
  const filteredHistory = history.filter(item => {
    const matchesSearch = item.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.runId.includes(searchTerm);
    const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // ---------- UI sections ----------
  const renderUploadSection = () => (
    <div className="space-y-8">
      {/* top text */}
      <div className="text-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1 text-xs font-medium text-blue-700 mb-4">
          <Upload className="h-3 w-3" />
          <span>Step 1 · Upload handwritten form</span>
        </p>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Upload Handwritten Form
        </h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Drag and drop your handwritten form image or PDF, or click to browse
          files. AI will read the handwriting and structure the content for you.
        </p>
      </div>

      {/* drop zone */}
      <div
        className={
          "relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 bg-white/80 backdrop-blur " +
          (isDragging
            ? "border-purple-500 bg-purple-50"
            : "border-gray-300 hover:border-purple-400") +
          " " +
          (error ? "border-red-500 bg-red-50" : "")
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileInput}
          accept="image/*,application/pdf"
          className="hidden"
        />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-md shadow-blue-300/40">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {file?.name ?? "Drag & Drop Your Form Here"}
            </h3>
            <p className="text-gray-600">
              {file
                ? "Click to replace file"
                : "Supports JPG, PNG, PDF (max 10MB)"}
            </p>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200">
            Browse Files
          </button>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center">
            <XCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}
      </div>

      {/* progress */}
      {(file || isProcessing || uploadProgress > 0 || status) && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {status === "COMPLETED"
                ? "Upload Complete"
                : "Upload & Processing Status"}
            </h3>
            <span className="text-sm text-gray-500">
              {isProcessing ? `${uploadProgress}%` : status ?? "Idle"}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <div className="mt-4 flex items-center text-gray-600 gap-2 text-sm">
            {isProcessing ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>
                  {status === "QUEUED"
                    ? "Queued… preparing extraction with AI Agent."
                    : status === "PROCESSING"
                    ? "Processing with AI Agent…"
                    : "Processing…"}
                </span>
              </>
            ) : status === "COMPLETED" ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-500" />
                <span>Processing completed successfully.</span>
              </>
            ) : status === "FAILED" ? (
              <>
                <XCircle className="w-5 h-5 text-red-500" />
                <span>Processing failed. Check error above.</span>
              </>
            ) : (
              <span>Waiting to start upload…</span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderExtractedData = () => {
    if (!extractedData) return null;
    const docType = extractedData.documentType;
    const processingTime = extractedData.processingTimeMs;
    const pages: Page[] = extractedData.pages ?? [];
    const warnings: string[] = extractedData.warnings ?? [];

    return (
      <div className="space-y-6 mt-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-medium text-emerald-700 mb-3">
              <CheckCircle className="h-3 w-3" />
              <span>Step 3 · Review extracted data</span>
            </p>
            <h2 className="text-3xl font-bold text-gray-900 mb-1">
              Extracted Data
            </h2>
            <p className="text-gray-600 text-sm sm:text-base">
              Document type:{" "}
              <span className="font-semibold text-gray-900">{docType}</span>
              {processingTime != null && (
                <>
                  {" "}
                  · Processed in{" "}
                  <span className="font-mono">
                    {Math.round(processingTime)} ms
                  </span>
                </>
              )}
              {runId && (
                <>
                  {" "}
                  · Run ID:{" "}
                  <span className="font-mono text-xs align-middle">
                    {runId}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowJSON(!showJSON)}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              {showJSON ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {showJSON ? "Hide JSON" : "View JSON"}
            </button>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg flex items-center gap-2 text-sm"
            >
              <ClipboardList className="w-4 h-4" />
              {copied ? "Copied!" : "Copy JSON"}
            </button>
            <button
              onClick={downloadJSON}
              className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:shadow-lg flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Download JSON
            </button>
            <button
              onClick={downloadCSV}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg hover:shadow-lg flex items-center gap-2 text-sm"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>
        </div>

        {showJSON ? (
          <div className="bg-gray-900 rounded-xl p-6 overflow-x-auto">
            <pre className="text-green-400 text-sm font-mono">
              {JSON.stringify(extractedData, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {pages.map((page) => (
              <div
                key={page.page}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Page {page.page ?? "?"}
                  </h3>
                  {page.fields && page.fields.length > 0 && (
                    <span className="text-xs text-sky-100">
                      {page.fields.length} fields
                    </span>
                  )}
                </div>
                <div className="p-6 overflow-x-auto">
                  {page.fields && page.fields.length > 0 ? (
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500">
                          <th className="text-left py-2 pr-4">Field</th>
                          <th className="text-left py-2 pr-4">Value</th>
                          <th className="text-left py-2 pr-2">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {page.fields.map((f, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-gray-100 last:border-0"
                          >
                            <td className="py-2 pr-4 font-medium text-gray-800">
                              {f.name}
                            </td>
                            <td className="py-2 pr-4 text-gray-700 break-all">
                              {typeof f.value === "object"
                                ? JSON.stringify(f.value)
                                : String(f.value ?? "")}
                            </td>
                            <td className="py-2 pr-2 text-gray-600">
                              {f.confidence != null
                                ? f.confidence.toFixed(2)
                                : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-500">
                      No structured fields detected on this page.
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* warnings/meta */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Extraction Warnings & Metadata
                </h3>
              </div>
              <div className="p-6 space-y-4 text-sm">
                {warnings.length > 0 ? (
                  <ul className="list-disc list-inside text-amber-700">
                    {warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600">
                    No warnings reported by the AI agent.
                  </p>
                )}
                <div className="mt-4 text-xs text-gray-500">
                  Data returned directly from your Spring Boot + OCR + OpenAI
                  backend.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* db info */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Data Stored in Backend
              </h3>
              <p className="text-gray-600 text-sm">
                This extraction result is already persisted in your database via
                <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">
                  ExtractionEntity
                </code>
                . You can safely close the page and fetch it later via the API.
              </p>
            </div>
            <button
              disabled
              className="ml-auto px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg opacity-60 cursor-not-allowed flex items-center gap-2 text-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              Already Saved
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderHistorySidebar = () => (
    <div className="space-y-6">
      {/* CRUD Operations Section */}
      <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Data Management
            </h3>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setShowExtractionList(!showExtractionList);
              if (!showExtractionList) {
                fetchAllExtractions();
              }
            }}
            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm flex items-center gap-2"
          >
            <Database className="w-4 h-4" />
            {showExtractionList ? "Hide List" : "Show All Extractions"}
          </button>
        </div>
        {/* Extraction List */}
        {showExtractionList && (
          <div className="mt-4 max-h-60 overflow-y-auto border-t border-gray-200 pt-3">
            <div className="text-xs font-medium text-gray-500 mb-2">All Extractions</div>
            <ul className="space-y-2">
              {extractionList.map((extraction) => (
                <li
                  key={extraction.runId}
                  className="flex items-center justify-between bg-gray-50 p-2 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs truncate font-medium">
                      {extraction.documentType || "Unknown"}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {extraction.runId.slice(0, 8)}...
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleView(extraction.runId)}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                      title="View"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleEdit(extraction.runId)}
                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                      title="Edit"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(extraction.runId)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* history */}
      <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HistoryIcon className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">
              Recent Extractions
            </h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setHistory([])}
              className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>
        </div>

        {/* Search and filter */}
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search files..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="text-xs border border-gray-200 rounded-lg px-2 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={String(filterStatus ?? 'ALL')}
            onChange={(e) => setFilterStatus(e.target.value as Status | 'ALL')}
          >
            <option value="ALL">All</option>
            <option value="QUEUED">Queued</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        {filteredHistory.length === 0 ? (
          <p className="text-xs text-gray-500">
            No extractions yet. Upload your first handwritten form to see it
            here.
          </p>
        ) : (
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-1 text-xs">
            {filteredHistory.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-gray-200/70 bg-gray-50/80 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="line-clamp-1 font-medium text-gray-900 cursor-pointer hover:underline"
                    onClick={() => viewDetails(item.runId)}
                  >
                    {item.fileName}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      item.status === "COMPLETED"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "FAILED"
                        ? "bg-red-100 text-red-700"
                        : item.status === "PROCESSING"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {item.status ?? "UNKNOWN"}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>
                    {item.docType ? `${item.docType} · ` : ""}
                    {item.createdAt}
                  </span>
                  <span className="truncate max-w-[120px]">
                    Run: {item.runId}
                  </span>
                </div>
                {/* Expanded details */}
                {expandedRunId === item.runId && (
                  <div className="mt-3 pt-3 border-t border-gray-200 text-[10px] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Processing Time:</span>
                      <span className="font-medium">
                        {item.processingTimeMs ? `${item.processingTimeMs}ms` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`font-medium ${
                        item.status === 'COMPLETED' ? 'text-emerald-600' :
                        item.status === 'FAILED' ? 'text-red-600' :
                        item.status === 'PROCESSING' ? 'text-yellow-600' : 'text-blue-600'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => retryProcessing(item.runId)}
                        className="flex-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs flex items-center justify-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Retry
                      </button>
                      <button
                        onClick={() => deleteHistoryItem(item.id)}
                        className="flex-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* how it works */}
      <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">
          How FormAI works
        </h3>
        <ol className="space-y-4 text-xs text-gray-600">
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
              1
            </span>
            <div>
              <p className="font-medium text-gray-900">
                Upload handwritten form
              </p>
              <p>
                Drag &amp; drop or browse from your device. JPG, PNG, and PDF
                are supported.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
              2
            </span>
            <div>
              <p className="font-medium text-gray-900">
                OCR + AI Agent extraction
              </p>
              <p>
                The backend OCR reads handwriting and the AI Agent structures it
                into fields and tables.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
              3
            </span>
            <div>
              <p className="font-medium text-gray-900">
                Review &amp; export to JSON / DB
              </p>
              <p>
                Inspect extracted data, download JSON, or consume it from your
                database and APIs.
              </p>
            </div>
          </li>
        </ol>
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
          <Clock className="h-4 w-4" />
          <span>Typical processing: ~3s per page.</span>
        </div>
      </div>
    </div>
  );

  // Edit Modal Component
  const renderEditModal = () => {
    if (!isEditing || !editingRunId) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Edit Extraction Data (Run ID: {editingRunId})</h3>
            <button
              onClick={() => setIsEditing(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <textarea
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
              className="w-full h-96 font-mono text-sm p-3 border border-gray-300 rounded-lg"
              placeholder="JSON data..."
            />
          </div>
          <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="px-4 py-2 bg-green-600 text-white rounded-lg"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ---------- layout ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* header */}
      <header className="bg-white/80 backdrop-blur shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-300/40">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  FormAI Extractor
                </h1>
                <p className="text-sm text-gray-600">
                  AI-powered handwritten form processing
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>Secure &amp; Encrypted</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span>AI-Powered</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* hero card */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur shadow-xl">
          {/* soft gradient blobs */}
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-blue-100 blur-3xl" />
            <div className="absolute bottom-0 -left-16 h-48 w-48 rounded-full bg-purple-100 blur-3xl" />
          </div>
          <div className="relative p-6 sm:p-8 lg:p-10">
            {/* top row inside card */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  AI document pipeline
                </p>
                <h2 className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">
                  Turn handwritten forms into clean JSON in seconds
                </h2>
                <p className="mt-1 text-sm text-slate-600 max-w-xl">
                  Upload any scanned or photographed form. FormAI runs OCR +
                  LLM extraction and stores structured data directly in your
                  backend.
                </p>
              </div>
              <button
                onClick={handleReset}
                className="self-start sm:self-auto px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white/70 border border-gray-200 rounded-lg flex items-center gap-2 shadow-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Reset session
              </button>
            </div>

            {/* two-column layout */}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] items-start">
              <section>
                {!file && !extractedData ? (
                  renderUploadSection()
                ) : (
                  <>
                    {renderUploadSection()}
                    {extractedData && renderExtractedData()}
                  </>
                )}
              </section>
              <aside className="mt-4 lg:mt-0">{renderHistorySidebar()}</aside>
            </div>
          </div>
        </div>
      </main>

      {/* footer */}
      <footer className="bg-white/90 backdrop-blur-md border-t border-gray-300 mt-16 shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center space-y-2">
            <p className="text-gray-800 font-semibold text-lg">
              © 2025 FormAI Extractor
            </p>
            <p className="text-gray-600 text-sm">
              Advanced AI-powered handwritten document understanding system.
            </p>
            <p className="text-xs text-gray-500">
              Powered by OCR · CV · Generative AI · NLP Models
            </p>
            <div className="pt-3">
              <span className="inline-block px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-medium shadow-md">
                Developed by <span className="font-semibold">Kiran Kumar S</span>
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Edit Modal */}
      {renderEditModal()}
    </div>
  );
};

export default App;
