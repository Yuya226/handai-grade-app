"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendingUp, FileText, Users } from "lucide-react";
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from "recharts";
import type { AnalysisResult, AggregateStats, Faculty } from "@/lib/types";
import GraduationCheck from "@/components/dashboard/GraduationCheck";

const GRADE_DIST_CONFIG = [
    { grade: "S", color: "#22c55e" },
    { grade: "A", color: "#3b82f6" },
    { grade: "B", color: "#eab308" },
    { grade: "C", color: "#f97316" },
    { grade: "F", color: "#ef4444" },
];

interface Props {
    analysisData: AnalysisResult;
    stats: AggregateStats | null;
    faculty: Faculty | '';
}

export default function StatsPanel({ analysisData, stats, faculty }: Props) {
    const gradeCounts = analysisData.grades.reduce((acc, curr) => {
        if (curr.grade) acc[curr.grade] = (acc[curr.grade] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const gradeDist = GRADE_DIST_CONFIG.map(({ grade, color }) => ({
        grade,
        color,
        count: gradeCounts[grade] || 0,
    }));

    const facultyGpas = stats?.facultyGpaBreakdown
        ? Object.entries(stats.facultyGpaBreakdown).sort((a, b) => b[1] - a[1])
        : [];

    return (
        <div className="space-y-5">
            {/* 上段: 学科別GPA + 個人成績 */}
            <div className="grid md:grid-cols-2 gap-5">
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
            </div>

            {/* 下段左: 評価分布 */}
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

            {/* 下段: 卒業要件（全幅） */}
            {faculty === '経済学部' ? (
                <GraduationCheck grades={analysisData.grades} />
            ) : (
                <div className="rounded-xl border bg-card px-4 py-5 text-center space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground">卒業要件チェック</p>
                    <p className="text-xs text-muted-foreground">
                        {faculty ? `${faculty}は未対応です。` : '学部未選択のため表示できません。'}
                        現在、経済学部のみ対応しています。
                    </p>
                </div>
            )}
        </div>
    );
}
