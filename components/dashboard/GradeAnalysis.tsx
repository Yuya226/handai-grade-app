"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { AnalysisResult, AggregateStats, Faculty, Grade } from "@/lib/types";
import { calculateGPA } from "@/lib/gpa";
import { TOTAL_REQUIRED_CREDITS } from "@/lib/requirements";
import GradeReview from "@/components/dashboard/GradeReview";
import UploadPanel from "@/components/dashboard/UploadPanel";
import GpaDeviationCard from "@/components/dashboard/GpaDeviationCard";
import StatsPanel from "@/components/dashboard/StatsPanel";

function calcDeviation(userGpa: number, mean: number, stdDev: number): number | null {
    if (stdDev < 0.01) return null;
    return Math.round((50 + 10 * (userGpa - mean) / stdDev) * 10) / 10;
}

const LAUNCH_DATE = new Date('2026-03-02').getTime();
const FALLBACK_COUNT = 200 + Math.floor((Date.now() - LAUNCH_DATE) / (1000 * 60 * 60 * 24)) * 8;

interface Props {
    stats: AggregateStats | null;
    sessionId: string;
    onStatsUpdate: (s: AggregateStats) => void;
    staleData?: boolean;
}

export default function GradeAnalysis({ stats, sessionId, onStatsUpdate, staleData = false }: Props) {
    const [pendingGrades, setPendingGrades] = useState<Grade[] | null>(null);
    const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(() => {
        if (typeof window === "undefined") return null;
        const raw = localStorage.getItem('handai_analysis_data');
        return raw ? JSON.parse(raw) as AnalysisResult : null;
    });
    const [faculty, setFaculty] = useState<Faculty | ''>(() => {
        if (typeof window === "undefined") return '';
        return (localStorage.getItem('handai_faculty') as Faculty | null) ?? '';
    });

    const participantCount = stats?.totalParticipants ?? FALLBACK_COUNT;

    const handleConfirm = (confirmedGrades: Grade[]) => {
        const { cumulative, semesters, earnedCredits } = calculateGPA(confirmedGrades);
        const result: AnalysisResult = {
            grades: confirmedGrades,
            gpa: { cumulative, semesters },
            earnedCredits,
            graduationRequirement: {
                total: TOTAL_REQUIRED_CREDITS,
                current: earnedCredits,
                percentage: Math.round((earnedCredits / TOTAL_REQUIRED_CREDITS) * 100),
            },
        };
        setAnalysisData(result);
        setPendingGrades(null);
        localStorage.setItem('handai_analysis_data', JSON.stringify(result));
        if (faculty) localStorage.setItem('handai_faculty', faculty);

        if (sessionId) {
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

    const handleReset = () => {
        localStorage.removeItem('handai_analysis_data');
        localStorage.removeItem('handai_faculty');
        setAnalysisData(null);
        setPendingGrades(null);
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
        return (
            <UploadPanel
                stats={stats}
                participantCount={participantCount}
                faculty={faculty}
                onFacultyChange={setFaculty}
                onGradesParsed={setPendingGrades}
            />
        );
    }

    // ── Results View ──────────────────────────────────────────────────────────
    const deviation = stats && stats.stdDev > 0
        ? calcDeviation(analysisData.gpa.cumulative, stats.averageGpa, stats.stdDev)
        : null;

    return (
        <div className="space-y-5">
            {staleData && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
                    <p className="text-amber-800 dark:text-amber-300">
                        解析精度が向上しました。再アップロードするとより正確なデータになります。
                    </p>
                    <Button variant="outline" size="sm" onClick={handleReset} className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100">
                        再アップロード
                    </Button>
                </div>
            )}
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    もう一度
                </Button>
            </div>

            <GpaDeviationCard
                analysisData={analysisData}
                stats={stats}
                deviation={deviation}
                participantCount={participantCount}
            />

            <StatsPanel
                analysisData={analysisData}
                stats={stats}
                faculty={faculty}
            />
        </div>
    );
}
