"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Upload, FileText, TrendingUp, Share2, Copy, Check,
    Users, RotateCcw, Lock, Flame,
} from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";

import type { AnalysisResult, AggregateStats, Faculty, Grade } from "@/lib/types";
import { FACULTY_OPTIONS } from "@/lib/types";
import { calculateGPA } from "@/lib/gpa";
import GraduationCheck from "@/components/dashboard/GraduationCheck";
import GradeReview from "@/components/dashboard/GradeReview";

function mergeGrades(allGrades: Grade[][]): Grade[] {
    const map = new Map<string, Grade>();
    for (const grades of allGrades) {
        for (const grade of grades) {
            const key = grade.courseCode
                ? `${grade.courseCode}-${grade.year}`
                : `${grade.subject}-${grade.year}`;
            const existing = map.get(key);
            if (!existing) {
                map.set(key, grade);
            } else if (existing.grade === 'P' && grade.grade !== 'P') {
                // Prefer a non-P grade over P when merging duplicates across images.
                // P is a common OCR misread of B/S; if any image reads a letter grade, use it.
                map.set(key, grade);
            }
        }
    }
    return Array.from(map.values());
}

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

const LAUNCH_DATE = new Date('2026-03-02').getTime();
const FALLBACK_COUNT = 200 + Math.floor((Date.now() - LAUNCH_DATE) / (1000 * 60 * 60 * 24)) * 8;

interface Props {
    stats: AggregateStats | null;
    sessionId: string;
    onStatsUpdate: (s: AggregateStats) => void;
}

export default function GradeAnalysis({ stats, sessionId, onStatsUpdate }: Props) {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [pendingGrades, setPendingGrades] = useState<Grade[] | null>(null);
    const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(() => {
        if (typeof window === "undefined") return null;
        const raw = localStorage.getItem('handai_analysis_data');
        return raw ? JSON.parse(raw) as AnalysisResult : null;
    });
    const [copied, setCopied] = useState(false);
    const [faculty, setFaculty] = useState<Faculty | ''>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    function buildAnalysisResult(grades: Grade[]): AnalysisResult {
        const { cumulative, semesters, earnedCredits } = calculateGPA(grades);
        return {
            grades,
            gpa: { cumulative, semesters },
            earnedCredits,
            graduationRequirement: {
                total: 130,
                current: earnedCredits,
                percentage: Math.round((earnedCredits / 130) * 100),
            },
        };
    }

    const handleConfirm = (confirmedGrades: Grade[]) => {
        const result = buildAnalysisResult(confirmedGrades);
        setAnalysisData(result);
        setPendingGrades(null);
        localStorage.setItem('handai_analysis_data', JSON.stringify(result));

        if (sessionId && faculty) {
            fetch("/api/save-grades", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session_id: sessionId, faculty, grades: confirmedGrades, session_gpa: result.gpa.cumulative }),
            }).catch(err => console.error("save-grades failed:", err));
        }

        fetch(`/api/stats?gpa=${result.gpa.cumulative}`)
            .then(r => r.json())
            .then((s: AggregateStats) => onStatsUpdate(s))
            .catch(err => console.error("stats fetch failed:", err));
    };

    const participantCount = stats?.totalParticipants ?? FALLBACK_COUNT;

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleReset = () => {
        localStorage.removeItem('handai_analysis_data');
        setAnalysisData(null);
        setPendingGrades(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);

        const progressInterval = setInterval(() => {
            setUploadProgress(prev => prev >= 90 ? prev : prev + 10);
        }, 300);

        try {
            const results = await Promise.all(files.map(async (file) => {
                const formData = new FormData();
                formData.append("file", file);
                const response = await fetch("/api/analyze", { method: "POST", body: formData });
                if (!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    throw new Error(err.error || `Analysis failed: ${response.status}`);
                }
                const data: AnalysisResult = await response.json();
                return data.grades;
            }));

            const merged = mergeGrades(results);
            setPendingGrades(merged);
            setUploadProgress(100);

        } catch (error) {
            console.error("Error analyzing file:", error);
            alert(`Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`);
        } finally {
            clearInterval(progressInterval);
            setIsUploading(false);
        }
    };

    // ── Review View ───────────────────────────────────────────────────────────
    if (pendingGrades !== null) {
        return (
            <div className="space-y-4">
                <div className="flex justify-end">
                    <button onClick={handleReset} className="text-xs text-muted-foreground underline underline-offset-2">
                        やり直す
                    </button>
                </div>
                <GradeReview initialGrades={pendingGrades} onConfirm={handleConfirm} />
            </div>
        );
    }

    // ── CTA View ──────────────────────────────────────────────────────────────
    if (analysisData === null) {
        const placeholderFaculties = [['工学部', 2.71], ['理学部', 2.85], ['経済学部', 2.62]] as [string, number][];
        const placeholderCourses = ['線形代数学', '解析学入門', '有機化学'];

        return (
            <div className="space-y-5">
                <div className="text-center space-y-1 pt-2">
                    <h2 className="text-2xl font-black">スクショ1枚で、データを解除</h2>
                    <p className="text-sm text-muted-foreground">出すだけで、みんなの成績の実態が見える。</p>
                </div>

                {/* GPA偏差値 preview */}
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

                {/* Faculty GPA preview */}
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

                {/* エグ単 preview */}
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
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileChange} />

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
                            成績をアップロード（複数枚対応）
                        </Button>
                    </div>
                )}

                <p className="text-center text-sm text-muted-foreground">
                    🔥 すでに <span className="font-bold text-orange-500">{participantCount}</span> 人が参加
                </p>
            </div>
        );
    }

    // ── Results View ──────────────────────────────────────────────────────────
    const deviation = stats && stats.stdDev > 0
        ? calcDeviation(analysisData.gpa.cumulative, stats.averageGpa, stats.stdDev)
        : null;

    const gradeCounts = analysisData.grades.reduce((acc, curr) => {
        if (curr.grade) acc[curr.grade] = (acc[curr.grade] || 0) + 1;
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
        <div className="space-y-5">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    もう一度
                </Button>
            </div>

            {/* GPA偏差値 */}
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

            {/* 学科別GPA実態 */}
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

            {/* 個人成績 */}
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

            {/* 評価分布 */}
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

            {/* 卒業要件チェック */}
            <GraduationCheck grades={analysisData.grades} />
        </div>
    );
}
