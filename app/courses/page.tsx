"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateGPA } from "@/lib/gpa";
import type { Grade, AnalysisResult } from "@/lib/types";

const GRADE_OPTIONS: Grade["grade"][] = ["S", "A", "B", "C", "F", "P"];

const GRADE_COLORS: Record<string, string> = {
    S: "text-green-600",
    A: "text-blue-600",
    B: "text-yellow-600",
    C: "text-orange-600",
    F: "text-red-600",
    P: "text-gray-600",
};

export default function CoursesPage() {
    const router = useRouter();
    const [grades, setGrades] = useState<Grade[]>([]);
    const [baseData, setBaseData] = useState<AnalysisResult | null>(null);
    const [currentGpa, setCurrentGpa] = useState<number>(0);
    const [currentCredits, setCurrentCredits] = useState<number>(0);

    useEffect(() => {
        const raw = localStorage.getItem("handai_analysis_data");
        if (!raw) {
            router.push("/dashboard");
            return;
        }
        const data = JSON.parse(raw) as AnalysisResult;
        setBaseData(data);
        setGrades(data.grades);
        setCurrentGpa(data.gpa.cumulative);
        setCurrentCredits(data.earnedCredits);
    }, [router]);

    function applyUpdate(updated: Grade[]) {
        setGrades(updated);
        if (!baseData) return;
        const { cumulative, semesters, earnedCredits } = calculateGPA(updated);
        setCurrentGpa(cumulative);
        setCurrentCredits(earnedCredits);
        const total = baseData.graduationRequirement.total;
        const newData: AnalysisResult = {
            ...baseData,
            grades: updated,
            gpa: { cumulative, semesters },
            earnedCredits,
            graduationRequirement: {
                total,
                current: earnedCredits,
                percentage: Math.min(Math.round((earnedCredits / total) * 100), 100),
            },
        };
        setBaseData(newData);
        localStorage.setItem("handai_analysis_data", JSON.stringify(newData));
    }

    function updateGrade(idx: number, field: keyof Grade, value: string | number) {
        const updated = grades.map((g, i) => (i === idx ? { ...g, [field]: value } : g));
        applyUpdate(updated);
    }

    function deleteGrade(idx: number) {
        const updated = grades.filter((_, i) => i !== idx);
        applyUpdate(updated);
    }

    return (
        <div className="flex min-h-screen flex-col bg-muted/20">
            <header className="sticky top-0 z-30 flex h-16 items-center border-b bg-background px-6 shadow-sm gap-4">
                <Link href="/dashboard">
                    <Button variant="ghost" size="sm" className="gap-1">
                        ← ダッシュボードに戻る
                    </Button>
                </Link>
                <h1 className="text-xl font-bold text-primary">HandaiGrade</h1>
            </header>

            <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">
                {/* Summary Row */}
                <div className="flex gap-4 mb-6">
                    <Card className="flex-1">
                        <CardHeader className="pb-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">コース数</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{grades.length}</p>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardHeader className="pb-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">現在のGPA</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold text-primary">{currentGpa}</p>
                        </CardContent>
                    </Card>
                    <Card className="flex-1">
                        <CardHeader className="pb-1">
                            <CardTitle className="text-sm font-medium text-muted-foreground">修得単位数</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-2xl font-bold">{currentCredits}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Table */}
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/50 text-muted-foreground">
                                    <th className="px-4 py-3 text-left font-medium">科目名</th>
                                    <th className="px-4 py-3 text-left font-medium">教員名</th>
                                    <th className="px-4 py-3 text-left font-medium">年度</th>
                                    <th className="px-4 py-3 text-left font-medium">単位</th>
                                    <th className="px-4 py-3 text-left font-medium">成績</th>
                                    <th className="px-4 py-3 text-left font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {grades.map((g, idx) => (
                                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={g.subject}
                                                onChange={(e) => updateGrade(idx, "subject", e.target.value)}
                                                className="min-w-[8rem] w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={g.teacher}
                                                onChange={(e) => updateGrade(idx, "teacher", e.target.value)}
                                                className="min-w-[8rem] w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                min={2020}
                                                max={2030}
                                                value={g.year}
                                                onChange={(e) => updateGrade(idx, "year", parseInt(e.target.value) || g.year)}
                                                className="w-20 bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                min={1}
                                                max={8}
                                                value={g.credits}
                                                onChange={(e) => updateGrade(idx, "credits", parseInt(e.target.value) || g.credits)}
                                                className="w-14 bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={g.grade}
                                                onChange={(e) => updateGrade(idx, "grade", e.target.value as Grade["grade"])}
                                                className={`bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none py-0.5 font-bold ${GRADE_COLORS[g.grade] ?? ""}`}
                                            >
                                                {GRADE_OPTIONS.map((opt) => (
                                                    <option key={opt} value={opt} className={GRADE_COLORS[opt]}>
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <button
                                                onClick={() => deleteGrade(idx)}
                                                className="text-muted-foreground hover:text-red-500 transition-colors text-base leading-none"
                                                aria-label="削除"
                                            >
                                                ×
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {grades.length === 0 && (
                            <p className="text-center text-muted-foreground py-8">授業データがありません</p>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
