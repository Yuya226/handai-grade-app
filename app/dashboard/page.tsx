"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Upload, FileText, TrendingUp, Share2, Copy, Check,
    Users, RotateCcw, Lock, Flame, Bell, ChevronRight, AlertTriangle,
    EyeOff, ShieldCheck, Undo2,
} from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

import type { AnalysisResult, AggregateStats, Faculty } from "@/lib/types";
import { FACULTY_OPTIONS } from "@/lib/types";

// ── Types & pure helpers ───────────────────────────────────────────────────

type Rect = { x: number; y: number; w: number; h: number };
type UploadStep = "idle" | "masking" | "analyzing";

/** Translate a client-space pointer position into canvas-internal coordinates. */
function toCanvasCoords(
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
): { x: number; y: number } {
    const r = canvas.getBoundingClientRect();
    return {
        x: (clientX - r.left) * (canvas.width / r.width),
        y: (clientY - r.top) * (canvas.height / r.height),
    };
}

// 偏差値 = 50 + 10 * (x - μ) / σ
function calcDeviation(userGpa: number, mean: number, stdDev: number): number | null {
    if (stdDev < 0.01) return null;
    return Math.round((50 + 10 * (userGpa - mean) / stdDev) * 10) / 10;
}

function deviationComment(val: number): string {
    if (val >= 75) return "阪大内でも最上位クラス。就活でも自信を持ってGPAを出せます。";
    if (val >= 65) return "平均を大きく上回る優秀な成績。しっかり努力が実っています。";
    if (val >= 55) return "平均よりやや上。安定した成績をキープしています。";
    if (val >= 45) return "全体の中間付近。履修戦略を見直すと一気に伸びるかも。";
    if (val >= 35) return "やや平均を下回る結果。エグ単を避けた戦略的な履修が効果的です。";
    return "まだまだ巻き返せます。エグ単情報を活用して次の学期を攻略しよう。";
}

function deviationColor(val: number): string {
    if (val >= 65) return "from-emerald-500 to-teal-600";
    if (val >= 55) return "from-blue-500 to-indigo-600";
    if (val >= 45) return "from-amber-500 to-orange-500";
    return "from-rose-500 to-red-600";
}

// Fallback participant count while stats load
const LAUNCH_DATE = new Date("2026-03-02").getTime();
const FALLBACK_COUNT = 200 + Math.floor((Date.now() - LAUNCH_DATE) / (1000 * 60 * 60 * 24)) * 8;

// ── Component ──────────────────────────────────────────────────────────────

export default function Dashboard() {
    // ── existing state ──
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [faculty, setFaculty] = useState<Faculty | "">("");
    const [sessionId, setSessionId] = useState("");
    const [stats, setStats] = useState<AggregateStats | null>(null);
    /** True once the initial auth + data restoration attempt has completed. */
    const [authReady, setAuthReady] = useState(false);

    // ── masking state ──
    const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    /** Incremented whenever a mask rect is added/removed — keeps undo button in sync. */
    const [maskCount, setMaskCount] = useState(0);

    // ── refs ──
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgElRef = useRef<HTMLImageElement | null>(null);
    const masksRef = useRef<Rect[]>([]);
    const dragStartRef = useRef<{ x: number; y: number } | null>(null);

    // ── effects ──────────────────────────────────────────────────────────────

    /**
     * On mount: establish an anonymous Supabase session (or reuse an existing one),
     * then try to restore analysis data from the DB. Falls back to localStorage
     * if auth is unavailable or the user has no saved snapshot.
     */
    useEffect(() => {
        let cancelled = false;

        (async () => {
            // ── 1. Establish auth ─────────────────────────────────────────────
            let session = null;
            try {
                const sb = getSupabaseBrowser();
                const existing = await sb.auth.getSession();
                session = existing.data.session;
                if (!session) {
                    const { data } = await sb.auth.signInAnonymously();
                    session = data.session;
                }
            } catch (err) {
                // Supabase auth unavailable (missing anon key, network, etc.)
                console.warn('Supabase auth unavailable — falling back to localStorage:', err);
            }

            if (cancelled) return;

            if (session) {
                setSessionId(session.user.id);
                localStorage.setItem('handai_session_id', session.user.id);

                // ── 2. Restore from DB (primary source) ───────────────────────
                try {
                    const res = await fetch('/api/user-snapshot', {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (!cancelled && res.ok) {
                        const snap: { analysis_data: AnalysisResult; faculty: string } | null =
                            await res.json();
                        if (snap?.analysis_data) {
                            setAnalysisData(snap.analysis_data);
                            if (snap.faculty) setFaculty(snap.faculty as Faculty);
                            // Keep localStorage in sync as offline cache
                            localStorage.setItem(
                                'handai_analysis_data',
                                JSON.stringify(snap.analysis_data)
                            );
                            fetch(`/api/stats?gpa=${snap.analysis_data.gpa.cumulative}`)
                                .then(r => r.json())
                                .then((s: AggregateStats) => { if (!cancelled) setStats(s); })
                                .catch(() => {});
                            if (!cancelled) setAuthReady(true);
                            return; // Skip localStorage fallback
                        }
                    }
                } catch {
                    // DB unreachable — fall through to localStorage
                }
            } else {
                // Auth failed: derive session_id from localStorage as before
                const id =
                    localStorage.getItem('handai_session_id') ?? crypto.randomUUID();
                localStorage.setItem('handai_session_id', id);
                if (!cancelled) setSessionId(id);
            }

            // ── 3. localStorage fallback ──────────────────────────────────────
            const raw = localStorage.getItem('handai_analysis_data');
            if (!cancelled && raw) {
                try {
                    const data = JSON.parse(raw) as AnalysisResult;
                    setAnalysisData(data);
                    fetch(`/api/stats?gpa=${data.gpa.cumulative}`)
                        .then(r => r.json())
                        .then((s: AggregateStats) => { if (!cancelled) setStats(s); })
                        .catch(() => {});
                } catch {
                    // Corrupt localStorage entry — ignore
                }
            }

            if (!cancelled) setAuthReady(true);
        })();

        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        fetch("/api/stats")
            .then(r => r.json())
            .then((s: AggregateStats) => setStats(s))
            .catch(() => {});
    }, []);

    /** Load the selected image onto the canvas when the masking step begins. */
    useEffect(() => {
        if (uploadStep !== "masking" || !pendingFile) return;

        const url = URL.createObjectURL(pendingFile);
        const img = new Image();

        img.onload = () => {
            imgElRef.current = img;
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d")!.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
        };
        img.src = url;

        return () => {
            img.onload = null;
            URL.revokeObjectURL(url);
        };
    }, [uploadStep, pendingFile]);

    /**
     * Register touch event listeners with { passive: false } so we can call
     * preventDefault() and suppress native scroll/zoom during masking.
     */
    useEffect(() => {
        if (uploadStep !== "masking") return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const onTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            const t = e.touches[0];
            dragStartRef.current = toCanvasCoords(canvas, t.clientX, t.clientY);
        };

        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            if (!dragStartRef.current) return;
            const t = e.touches[0];
            const cur = toCanvasCoords(canvas, t.clientX, t.clientY);
            const s = dragStartRef.current;
            redrawCanvas({
                x: Math.min(s.x, cur.x),
                y: Math.min(s.y, cur.y),
                w: Math.abs(cur.x - s.x),
                h: Math.abs(cur.y - s.y),
            });
        };

        const onTouchEnd = (e: TouchEvent) => {
            e.preventDefault();
            if (!dragStartRef.current) return;
            const t = e.changedTouches[0];
            const cur = toCanvasCoords(canvas, t.clientX, t.clientY);
            commitMask(cur);
        };

        canvas.addEventListener("touchstart", onTouchStart, { passive: false });
        canvas.addEventListener("touchmove", onTouchMove, { passive: false });
        canvas.addEventListener("touchend", onTouchEnd, { passive: false });

        return () => {
            canvas.removeEventListener("touchstart", onTouchStart);
            canvas.removeEventListener("touchmove", onTouchMove);
            canvas.removeEventListener("touchend", onTouchEnd);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uploadStep]);

    // ── canvas drawing ────────────────────────────────────────────────────────

    /** Repaint the canvas: base image → committed masks → optional live-drag rect. */
    const redrawCanvas = useCallback((liveRect?: Rect) => {
        const canvas = canvasRef.current;
        const img = imgElRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        ctx.fillStyle = "#000";
        for (const m of masksRef.current) ctx.fillRect(m.x, m.y, m.w, m.h);
        if (liveRect) {
            ctx.fillStyle = "rgba(0,0,0,0.55)";
            ctx.fillRect(liveRect.x, liveRect.y, liveRect.w, liveRect.h);
        }
    }, []);

    /** Finalise the current drag into a committed mask rect. */
    const commitMask = useCallback((cursorPos: { x: number; y: number }) => {
        const s = dragStartRef.current;
        if (!s) return;
        const rect: Rect = {
            x: Math.min(s.x, cursorPos.x),
            y: Math.min(s.y, cursorPos.y),
            w: Math.abs(cursorPos.x - s.x),
            h: Math.abs(cursorPos.y - s.y),
        };
        dragStartRef.current = null;
        if (rect.w > 4 && rect.h > 4) {
            masksRef.current.push(rect);
            setMaskCount(c => c + 1);
        }
        redrawCanvas();
    }, [redrawCanvas]);

    // ── mouse event handlers (desktop) ───────────────────────────────────────

    const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        dragStartRef.current = toCanvasCoords(canvasRef.current!, e.clientX, e.clientY);
    };

    const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!dragStartRef.current) return;
        const cur = toCanvasCoords(canvasRef.current!, e.clientX, e.clientY);
        const s = dragStartRef.current;
        redrawCanvas({
            x: Math.min(s.x, cur.x),
            y: Math.min(s.y, cur.y),
            w: Math.abs(cur.x - s.x),
            h: Math.abs(cur.y - s.y),
        });
    };

    const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
        commitMask(toCanvasCoords(canvasRef.current!, e.clientX, e.clientY));
    };

    const handleCanvasMouseLeave = () => {
        if (!dragStartRef.current) return;
        dragStartRef.current = null;
        redrawCanvas();
    };

    // ── upload step handlers ──────────────────────────────────────────────────

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleReset = () => {
        localStorage.removeItem("handai_analysis_data");
        setAnalysisData(null);
        setUploadStep("idle");
        setPendingFile(null);
        masksRef.current = [];
        setMaskCount(0);
        imgElRef.current = null;
        if (fileInputRef.current) fileInputRef.current.value = "";

        // Delete DB snapshot so it isn't restored on next page load
        getSupabaseBrowser().auth.getSession()
            .then(({ data: { session } }) => {
                if (!session) return;
                fetch("/api/user-snapshot", {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${session.access_token}` },
                }).catch(() => {});
            })
            .catch(() => {});

        fetch("/api/stats")
            .then(r => r.json())
            .then((s: AggregateStats) => setStats(s))
            .catch(() => {});
    };

    /** Step 1: file selected → enter masking view. */
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        masksRef.current = [];
        setMaskCount(0);
        imgElRef.current = null;
        setPendingFile(file);
        setUploadStep("masking");
    };

    const handleCancelMasking = () => {
        setUploadStep("idle");
        setPendingFile(null);
        masksRef.current = [];
        setMaskCount(0);
        imgElRef.current = null;
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUndo = () => {
        if (masksRef.current.length === 0) return;
        masksRef.current.pop();
        setMaskCount(c => c - 1);
        redrawCanvas();
    };

    /** Step 2: masking done → export canvas as Blob and send to /api/analyze. */
    const handleMaskingComplete = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setUploadStep("analyzing");
        setIsUploading(true);
        setUploadProgress(0);

        canvas.toBlob(async (blob) => {
            if (!blob) {
                setIsUploading(false);
                setUploadStep("idle");
                return;
            }

            const maskedFile = new File([blob], pendingFile?.name ?? "masked.jpg", { type: blob.type });
            const formData = new FormData();
            formData.append("file", maskedFile);

            const progressInterval = setInterval(() => {
                setUploadProgress(prev => prev >= 90 ? prev : prev + 10);
            }, 300);

            try {
                const response = await fetch("/api/analyze", { method: "POST", body: formData });
                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || `Analysis failed: ${response.status}`);
                }

                const data: AnalysisResult = await response.json();
                setAnalysisData(data);
                localStorage.setItem("handai_analysis_data", JSON.stringify(data));
                setUploadProgress(100);

                // Persist snapshot to Supabase for cross-session restoration
                const { data: { session: cs } } = await getSupabaseBrowser().auth.getSession();
                if (cs) {
                    fetch("/api/user-snapshot", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${cs.access_token}`,
                        },
                        body: JSON.stringify({ analysis_data: data, faculty }),
                    }).catch(err => console.error("snapshot save failed:", err));
                }

                if (sessionId && faculty) {
                    fetch("/api/save-grades", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            session_id: sessionId,
                            faculty,
                            grades: data.grades,
                            session_gpa: data.gpa.cumulative,
                        }),
                    }).catch(err => console.error("save-grades failed:", err));
                }

                fetch(`/api/stats?gpa=${data.gpa.cumulative}`)
                    .then(r => r.json())
                    .then((s: AggregateStats) => setStats(s))
                    .catch(err => console.error("stats fetch failed:", err));

            } catch (error) {
                console.error("Error analyzing file:", error);
                alert(`Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`);
                setUploadStep("idle");
            } finally {
                clearInterval(progressInterval);
                setIsUploading(false);
            }
        }, "image/jpeg", 0.95);
    };

    const participantCount = stats?.totalParticipants ?? FALLBACK_COUNT;

    // ── Loading screen (while anonymous auth + DB restoration is in-flight) ──
    if (!authReady && analysisData === null) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/20">
                <p className="text-lg font-bold text-primary">HandaiGrade</p>
                <p className="text-sm text-muted-foreground animate-pulse">読み込み中...</p>
            </div>
        );
    }

    // ── Masking View ───────────────────────────────────────────────────────────

    if (uploadStep === "masking") {
        return (
            <div className="flex min-h-screen flex-col bg-muted/20">
                <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background px-4 shadow-sm">
                    <EyeOff className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold leading-tight">個人情報をマスク</p>
                        <p className="text-xs text-muted-foreground truncate">隠したい箇所をドラッグして黒塗り →「送信」</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCancelMasking}
                        className="shrink-0 text-muted-foreground"
                    >
                        キャンセル
                    </Button>
                </header>

                <main className="flex-1 flex flex-col p-3 gap-3 max-w-2xl mx-auto w-full">

                    {/* Privacy notice */}
                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                        <CardContent className="py-3 px-4 flex items-start gap-3">
                            <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                                    氏名・学籍番号など、隠したい箇所をドラッグしてください
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    送信されるのはマスク済み画像のみです。成績データ（科目名・評価・単位数）以外は解析に使用しません。
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Canvas */}
                    <div className="rounded-xl border overflow-hidden bg-black shadow-sm">
                        <canvas
                            ref={canvasRef}
                            style={{
                                width: "100%",
                                display: "block",
                                cursor: "crosshair",
                                touchAction: "none",
                                userSelect: "none",
                            }}
                            onMouseDown={handleCanvasMouseDown}
                            onMouseMove={handleCanvasMouseMove}
                            onMouseUp={handleCanvasMouseUp}
                            onMouseLeave={handleCanvasMouseLeave}
                        />
                    </div>

                    {/* Mask count hint */}
                    {maskCount > 0 && (
                        <p className="text-xs text-center text-muted-foreground">
                            {maskCount} 箇所をマスク済み
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pb-safe">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUndo}
                            disabled={maskCount === 0}
                            className="gap-1.5 shrink-0"
                        >
                            <Undo2 className="h-3.5 w-3.5" />
                            元に戻す
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleMaskingComplete}
                            className="flex-1 font-bold gap-1.5"
                        >
                            <ShieldCheck className="h-4 w-4" />
                            マスキング完了・送信
                        </Button>
                    </div>

                </main>
            </div>
        );
    }

    // ── CTA View ──────────────────────────────────────────────────────────────
    if (analysisData === null) {
        // Locked placeholder rows — never reveal real data before upload
        const placeholderFaculties = [["工学部", 2.71], ["理学部", 2.85], ["経済学部", 2.62]] as [string, number][];
        const placeholderCourses = ["線形代数学", "解析学入門", "有機化学"];

        return (
            <div className="flex min-h-screen flex-col bg-muted/20">
                <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-6 shadow-sm">
                    <h1 className="text-lg font-bold text-primary">HandaiGrade</h1>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center p-6">
                    <div className="w-full max-w-md space-y-5">

                        <div className="text-center space-y-1">
                            <h2 className="text-2xl font-black">スクショ1枚で、データを解除</h2>
                            <p className="text-sm text-muted-foreground">出すだけで、みんなの成績の実態が見える。</p>
                        </div>

                        {/* GPA偏差値 preview — always locked */}
                        <div className="relative rounded-xl border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold">GPA偏差値</span>
                                <Badge variant="secondary" className="ml-auto text-xs">{participantCount}人の母数</Badge>
                            </div>
                            <div className="px-4 py-6 flex flex-col items-center gap-1 select-none">
                                <p className="text-xs text-muted-foreground">あなたの偏差値</p>
                                <p className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600 blur-sm">
                                    62.4
                                </p>
                                <p className="text-xs text-muted-foreground blur-sm">平均よりやや上。安定した成績をキープ...</p>
                            </div>
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                                <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                                    <Lock className="h-4 w-4" />
                                    アップすると解除
                                </div>
                            </div>
                        </div>

                        {/* Faculty GPA preview — always locked */}
                        <div className="relative rounded-xl border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-500" />
                                <span className="text-sm font-semibold">学科別GPA実態</span>
                                <Badge variant="secondary" className="ml-auto text-xs">集計中</Badge>
                            </div>
                            <div className="px-4 py-3 space-y-2 select-none">
                                {placeholderFaculties.map(([fac, gpa]) => (
                                    <div key={fac} className="flex items-center gap-3 opacity-40">
                                        <span className="text-xs text-muted-foreground w-20 truncate">{fac}</span>
                                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min((gpa / 4) * 100, 100)}%` }} />
                                        </div>
                                        <span className="text-xs font-bold text-blue-600 w-8 text-right blur-sm">{gpa.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                                <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                                    <Lock className="h-4 w-4" />
                                    アップすると解除
                                </div>
                            </div>
                        </div>

                        {/* エグ単 preview — always locked */}
                        <div className="relative rounded-xl border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b flex items-center gap-2">
                                <Flame className="h-4 w-4 text-orange-500" />
                                <span className="text-sm font-semibold">エグ単速報</span>
                                <Badge variant="outline" className="ml-auto text-xs border-orange-200 text-orange-600">不可率TOP</Badge>
                            </div>
                            <div className="px-4 py-3 space-y-1.5 select-none">
                                {placeholderCourses.map((s, i) => (
                                    <div key={s} className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                                        <span className="text-xs flex-1 blur-sm">{s}</span>
                                        <Badge variant="destructive" className="text-xs px-1.5 py-0 opacity-30">不可XX%</Badge>
                                    </div>
                                ))}
                            </div>
                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                                <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                                    <Lock className="h-4 w-4" />
                                    アップすると解除
                                </div>
                            </div>
                        </div>

                        {/* Upload CTA */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />

                        {isUploading ? (
                            <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">成績表を解析中...</span>
                                    <span className="font-medium">{uploadProgress}%</span>
                                </div>
                                <Progress value={uploadProgress} className="h-2" />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <select
                                    value={faculty}
                                    onChange={(e) => setFaculty(e.target.value as Faculty | "")}
                                    className="w-full h-11 rounded-md border border-input bg-background px-3 text-base shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                                >
                                    <option value="">学部を選択（任意）▼</option>
                                    {FACULTY_OPTIONS.map((f) => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>

                                <Button size="lg" className="w-full h-12 text-base font-bold" onClick={handleUploadClick}>
                                    <Upload className="mr-2 h-5 w-5" />
                                    成績をアップロード
                                </Button>
                            </div>
                        )}

                        <p className="text-center text-sm text-muted-foreground">
                            🔥 すでに <span className="font-bold text-orange-500">{participantCount}</span> 人が参加
                        </p>
                    </div>
                </main>
            </div>
        );
    }

    // ── Results View ──────────────────────────────────────────────────────────
    const deviation = stats && stats.stdDev > 0
        ? calcDeviation(analysisData.gpa.cumulative, stats.averageGpa, stats.stdDev)
        : null;

    const gradeCounts = analysisData.grades.reduce((acc, curr) => {
        acc[curr.grade] = (acc[curr.grade] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const gradeDist = [
        { grade: "S", count: gradeCounts["S"] || 0, color: "#22c55e" },
        { grade: "A", count: gradeCounts["A"] || 0, color: "#3b82f6" },
        { grade: "B", count: gradeCounts["B"] || 0, color: "#eab308" },
        { grade: "C", count: gradeCounts["C"] || 0, color: "#f97316" },
        { grade: "F", count: gradeCounts["F"] || 0, color: "#ef4444" },
    ];

    const facultyGpas = stats?.facultyGpaBreakdown
        ? Object.entries(stats.facultyGpaBreakdown).sort((a, b) => b[1] - a[1])
        : [];
    const hardCourses = stats?.hardCourses ?? [];

    const handleShare = () => {
        const devText = deviation != null ? `偏差値 ${deviation}` : `GPA ${analysisData.gpa.cumulative}`;
        const percentileText = stats?.userPercentile ? `上位${stats.userPercentile}%` : "";
        const text = `阪大内GPA${devText}！\nGPA ${analysisData.gpa.cumulative}${percentileText ? ` / ${percentileText}` : ""}\n\n#阪大成績偏差値 #HandaiGrade\nhttps://handaigrade.vercel.app`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleCopy = async () => {
        const devText = deviation != null ? `偏差値 ${deviation}` : `GPA ${analysisData.gpa.cumulative}`;
        const percentileText = stats?.userPercentile ? `上位${stats.userPercentile}%` : "";
        await navigator.clipboard.writeText(`阪大内GPA${devText}！\nGPA ${analysisData.gpa.cumulative}${percentileText ? ` / ${percentileText}` : ""}\n#阪大成績偏差値 #HandaiGrade`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex min-h-screen flex-col bg-muted/20">
            <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-6 shadow-sm">
                <h1 className="text-lg font-bold text-primary">HandaiGrade</h1>
                <div className="ml-auto">
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                        <RotateCcw className="h-4 w-4" />
                        もう一度
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full space-y-5">

                {/* ── GPA偏差値（基幹機能） ── */}
                <Card className="overflow-hidden border-0 shadow-lg">
                    <div className={`bg-gradient-to-br ${deviation != null ? deviationColor(deviation) : "from-primary to-blue-600"} p-6 text-white`}>
                        <p className="text-sm font-medium opacity-80 mb-1">
                            阪大内GPA偏差値｜{stats?.totalParticipants ?? participantCount}人の母数
                        </p>
                        {deviation != null ? (
                            <>
                                <p className="text-8xl font-black tracking-tight leading-none mb-3">
                                    {deviation}
                                </p>
                                <p className="text-sm opacity-90 leading-relaxed">
                                    {deviationComment(deviation)}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm opacity-80">
                                    <span>全体平均 {stats!.averageGpa.toFixed(2)}</span>
                                    <span>あなた {analysisData.gpa.cumulative}</span>
                                    {stats?.userPercentile != null && (
                                        <span className="font-bold text-white">上位{stats.userPercentile}%</span>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="py-4">
                                <p className="text-5xl font-black opacity-40">--</p>
                                <p className="text-sm opacity-70 mt-2">データ収集中。参加者が増えると偏差値が表示されます。</p>
                            </div>
                        )}
                    </div>
                    <CardContent className="pt-4 pb-4 flex gap-2">
                        <Button onClick={handleShare} size="sm" className="rounded-full gap-1.5 flex-1">
                            <Share2 className="h-3.5 w-3.5" />
                            X でシェア
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCopy} className="rounded-full gap-1.5 flex-1">
                            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? "コピーした！" : "コピー"}
                        </Button>
                    </CardContent>
                </Card>

                {/* ── 学科別GPA実態 ── */}
                {facultyGpas.length > 0 && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-500" />
                                学科別GPA実態
                            </CardTitle>
                            <CardDescription>全体平均 <span className="font-bold text-foreground">{stats!.averageGpa.toFixed(2)}</span></CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {facultyGpas.map(([fac, gpa]) => (
                                <div key={fac} className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground w-24 truncate shrink-0">{fac}</span>
                                    <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${Math.min((gpa / 4) * 100, 100)}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-blue-600 w-8 text-right shrink-0">{gpa}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* ── エグ単速報 ── */}
                {hardCourses.length > 0 && (
                    <Card className="border-orange-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Flame className="h-4 w-4 text-orange-500" />
                                エグ単速報
                            </CardTitle>
                            <CardDescription>不可率が高い科目TOP{hardCourses.length}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {hardCourses.map((c, i) => (
                                <div key={c.subject_name} className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                                    <span className="text-xs flex-1 truncate">{c.subject_name}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">{c.totalCount}件</span>
                                    <Badge variant="destructive" className="text-xs px-2 py-0 shrink-0">不可{Math.round(c.failRate * 100)}%</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* ── 個人成績 ── */}
                <div className="grid gap-4 grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">通算GPA</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{analysisData.gpa.cumulative}</div>
                            <p className="text-xs text-muted-foreground">解析データより</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">修得単位数</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {analysisData.earnedCredits} / {analysisData.graduationRequirement.total}
                            </div>
                            <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${analysisData.graduationRequirement.percentage}%` }} />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── 解析科目一覧 ── */}
                <Link href="/courses">
                    <Card className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all">
                        <CardContent className="flex items-center gap-4 py-4">
                            <div className="p-2.5 rounded-full bg-amber-50 text-amber-500 shrink-0">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold">解析された科目一覧を確認・修正</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {analysisData.grades.length}科目を検出 ／ OCRの読み取りミスはここで直せます
                                </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </CardContent>
                    </Card>
                </Link>

                {/* ── 評価分布 ── */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">評価分布</CardTitle>
                        <CardDescription>S / A / B / C / F の取得数</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={gradeDist}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="grade" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: "transparent" }} />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {gradeDist.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* ── Coming Soon: 卒業要件チェック ── */}
                <div className="rounded-xl border border-dashed bg-card p-5 text-center space-y-2 opacity-80">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <Bell className="h-4 w-4" />
                        <span className="text-sm font-semibold">卒業要件チェック</span>
                        <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        あなたの学科の卒業要件ロジックをAIが現在学習中。<br />
                        データが集まり次第、先行して通知します。
                    </p>
                    <Button variant="outline" size="sm" className="rounded-full gap-1.5 mt-1" disabled>
                        <Bell className="h-3.5 w-3.5" />
                        先行通知を受け取る
                        <ChevronRight className="h-3 w-3 opacity-50" />
                    </Button>
                </div>

            </main>
        </div>
    );
}
