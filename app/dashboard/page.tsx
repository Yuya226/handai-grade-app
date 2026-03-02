"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Upload, FileText, TrendingUp, Share2, Copy, Check,
    Users, RotateCcw, Lock, Flame, Bell, ChevronRight
} from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

import type { AnalysisResult, AggregateStats, Faculty } from "@/lib/types";
import { FACULTY_OPTIONS } from "@/lib/types";

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
const LAUNCH_DATE = new Date('2026-03-02').getTime();
const FALLBACK_COUNT = 200 + Math.floor((Date.now() - LAUNCH_DATE) / (1000 * 60 * 60 * 24)) * 8;

export default function Dashboard() {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [faculty, setFaculty] = useState<Faculty | ''>('');
    const [sessionId, setSessionId] = useState('');
    const [stats, setStats] = useState<AggregateStats | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let id = localStorage.getItem('handai_session_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('handai_session_id', id);
        }
        setSessionId(id);

        const rawAnalysis = localStorage.getItem('handai_analysis_data');
        if (rawAnalysis) {
            const data = JSON.parse(rawAnalysis) as AnalysisResult;
            setAnalysisData(data);
            fetch(`/api/stats?gpa=${data.gpa.cumulative}`)
                .then(r => r.json())
                .then((s: AggregateStats) => setStats(s))
                .catch(() => {});
        }
    }, []);

    useEffect(() => {
        fetch('/api/stats')
            .then(r => r.json())
            .then((s: AggregateStats) => setStats(s))
            .catch(() => {});
    }, []);

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleReset = () => {
        localStorage.removeItem('handai_analysis_data');
        setAnalysisData(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetch('/api/stats').then(r => r.json()).then((s: AggregateStats) => setStats(s)).catch(() => {});
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append("file", file);

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
            localStorage.setItem('handai_analysis_data', JSON.stringify(data));
            setUploadProgress(100);

            if (sessionId && faculty) {
                fetch("/api/save-grades", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ session_id: sessionId, faculty, grades: data.grades, session_gpa: data.gpa.cumulative }),
                }).catch(err => console.error("save-grades failed:", err));
            }

            fetch(`/api/stats?gpa=${data.gpa.cumulative}`)
                .then(r => r.json())
                .then((s: AggregateStats) => setStats(s))
                .catch(err => console.error("stats fetch failed:", err));

        } catch (error) {
            console.error("Error analyzing file:", error);
            alert(`Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`);
        } finally {
            clearInterval(progressInterval);
            setIsUploading(false);
        }
    };

    const participantCount = stats?.totalParticipants ?? FALLBACK_COUNT;

    // ── CTA View ──────────────────────────────────────────────────────────────
    if (analysisData === null) {
        // Locked placeholder rows — never reveal real data before upload
        const placeholderFaculties = [['工学部', 2.71], ['理学部', 2.85], ['経済学部', 2.62]] as [string, number][];
        const placeholderCourses = ['線形代数学', '解析学入門', '有機化学'];

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
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />

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
                                    onChange={(e) => setFaculty(e.target.value as Faculty | '')}
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
        const percentileText = stats?.userPercentile ? `上位${stats.userPercentile}%` : '';
        const text = `阪大内GPA${devText}！\nGPA ${analysisData.gpa.cumulative}${percentileText ? ` / ${percentileText}` : ''}\n\n#阪大成績偏差値 #HandaiGrade\nhttps://handaigrade.vercel.app`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleCopy = async () => {
        const devText = deviation != null ? `偏差値 ${deviation}` : `GPA ${analysisData.gpa.cumulative}`;
        const percentileText = stats?.userPercentile ? `上位${stats.userPercentile}%` : '';
        await navigator.clipboard.writeText(`阪大内GPA${devText}！\nGPA ${analysisData.gpa.cumulative}${percentileText ? ` / ${percentileText}` : ''}\n#阪大成績偏差値 #HandaiGrade`);
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
                    <div className={`bg-gradient-to-br ${deviation != null ? deviationColor(deviation) : 'from-primary to-blue-600'} p-6 text-white`}>
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
                                <Tooltip cursor={{ fill: 'transparent' }} />
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
