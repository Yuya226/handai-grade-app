"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, TrendingUp, AlertCircle, Loader2 } from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell
} from "recharts";

// Imprt Type from API
import type { AnalysisResult } from "@/app/api/analyze/route";

export default function Dashboard() {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);

        const formData = new FormData();
        formData.append("file", file);

        // Simulate upload progress
        const progressInterval = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 90) return prev;
                return prev + 10;
            });
        }, 300);

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Analysis failed with status ${response.status}`);
            }

            const data: AnalysisResult = await response.json();
            setAnalysisData(data);
            setUploadProgress(100);
        } catch (error) {
            console.error("Error analyzing file:", error);
            alert(`Error: ${error instanceof Error ? error.message : "An unknown error occurred"}`);
        } finally {
            clearInterval(progressInterval);
            setIsUploading(false);
            // Reset progress after a delay if needed, or keep it 100
        }
    };

    // Prepare data for charts based on analysis or default empty/mock for initial view
    const gpaData = analysisData ? Object.entries(analysisData.gpa.semesters).map(([sem, gpa]) => ({
        semester: sem,
        gpa: gpa
    })) : [
        { semester: "1S", gpa: 2.8 },
        { semester: "1A", gpa: 3.1 },
        { semester: "2S", gpa: 3.4 },
    ];

    const gradeCounts = analysisData ? analysisData.grades.reduce((acc, curr) => {
        acc[curr.grade] = (acc[curr.grade] || 0) + 1;
        return acc;
    }, {} as Record<string, number>) : { "S": 0, "A": 0, "B": 0, "C": 0, "F": 0 };

    const gradeDist = [
        { grade: "S", count: gradeCounts["S"] || 0, color: "#22c55e" },
        { grade: "A", count: gradeCounts["A"] || 0, color: "#3b82f6" },
        { grade: "B", count: gradeCounts["B"] || 0, color: "#eab308" },
        { grade: "C", count: gradeCounts["C"] || 0, color: "#f97316" },
        { grade: "F", count: gradeCounts["F"] || 0, color: "#ef4444" },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-muted/20">
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6 shadow-sm">
                <h1 className="text-xl font-bold text-primary">成績ダッシュボード</h1>
                <div className="ml-auto flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    <Button size="sm" onClick={handleUploadClick} disabled={isUploading}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {isUploading ? "解析中..." : "スクショをアップロード"}
                    </Button>
                </div>
            </header>

            <main className="flex-1 p-6 md:p-8">
                {isUploading && (
                    <div className="mb-8 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">成績表を解析しています...</span>
                            <span className="font-medium">{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">通算GPA</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{analysisData ? analysisData.gpa.cumulative : "-.--"}</div>
                            <p className="text-xs text-muted-foreground">
                                {analysisData ? "アップロードされたデータに基づく" : "アップロードしてGPAを確認"}
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">修得単位数</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {analysisData ? `${analysisData.earnedCredits} / ${analysisData.graduationRequirement.total}` : "- / -"}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {analysisData ? `卒業まで ${analysisData.graduationRequirement.percentage}%` : "アップロードして進捗を確認"}
                            </p>
                            <div className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all duration-500"
                                    style={{ width: analysisData ? `${analysisData.graduationRequirement.percentage}%` : '0%' }}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">総履修科目数</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{analysisData ? analysisData.grades.length : "-"}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">次のマイルストーン</CardTitle>
                            <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-medium">準備中</div>
                            <p className="text-xs text-muted-foreground">詳細な分析はここに表示されます</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <CardTitle>GPA推移</CardTitle>
                            <CardDescription>学期ごとの成績推移</CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={gpaData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="semester"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        domain={[0, 4]}
                                    />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="gpa"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        dot={{ r: 4 }}
                                        activeDot={{ r: 8 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="col-span-3">
                        <CardHeader>
                            <CardTitle>評価分布</CardTitle>
                            <CardDescription>S, A, B, C, F の取得数</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={gradeDist}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="grade"
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
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
                </div>

                <div className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>解析済み科目一覧</CardTitle>
                            <CardDescription>アップロードされた成績表から抽出した科目</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {analysisData ? analysisData.grades.map((course, i) => (
                                    <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                        <div>
                                            <p className="font-medium leading-none">{course.subject}</p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                {course.teacher} <span className="mx-1">•</span> {course.year} {course.semester} <span className="mx-1">•</span> {course.credits} 単位
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className={`text-lg font-bold ${course.grade === 'S' || course.grade === 'A' ? 'text-green-600' :
                                                course.grade === 'B' ? 'text-blue-600' : 'text-gray-600'
                                                }`}>
                                                {course.grade}
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        成績表をアップロードして詳細を表示
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
