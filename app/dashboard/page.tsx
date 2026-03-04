"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, BarChart2, TrendingUp } from "lucide-react";
import CourseSearch from "@/components/dashboard/CourseSearch";
import GradeAnalysis from "@/components/dashboard/GradeAnalysis";
import type { AggregateStats } from "@/lib/types";

export default function Dashboard() {
    const [sessionId, setSessionId] = useState('');
    const [stats, setStats] = useState<AggregateStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    useEffect(() => {
        let id = localStorage.getItem('handai_session_id');
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem('handai_session_id', id);
        }
        setSessionId(id);

        const rawAnalysis = localStorage.getItem('handai_analysis_data');
        const gpaParam = rawAnalysis
            ? `?gpa=${(JSON.parse(rawAnalysis) as { gpa: { cumulative: number } }).gpa.cumulative}`
            : '';

        fetch(`/api/stats${gpaParam}`)
            .then(r => r.json())
            .then((s: AggregateStats) => setStats(s))
            .catch(() => {})
            .finally(() => setStatsLoading(false));
    }, []);

    return (
        <div className="flex min-h-screen flex-col bg-muted/20">
            <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-6 shadow-sm">
                <Link href="/" className="flex items-center gap-1.5 font-bold text-lg text-primary hover:opacity-80 transition-opacity">
                    <TrendingUp className="h-5 w-5" />
                    Syllobus
                </Link>
            </header>

            <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full">
                <Tabs defaultValue="search">
                    <TabsList className="w-full mb-1">
                        <TabsTrigger value="search" className="flex-1 gap-1.5">
                            <Search className="h-3.5 w-3.5" />
                            科目を探す
                        </TabsTrigger>
                        <TabsTrigger value="analysis" className="flex-1 gap-1.5">
                            <BarChart2 className="h-3.5 w-3.5" />
                            マイ成績・解析
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="search">
                        <CourseSearch />
                    </TabsContent>

                    <TabsContent value="analysis">
                        <GradeAnalysis
                            stats={stats}
                            sessionId={sessionId}
                            onStatsUpdate={setStats}
                        />
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
