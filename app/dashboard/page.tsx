"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import GradeAnalysis from "@/components/dashboard/GradeAnalysis";
import type { AggregateStats } from "@/lib/types";

export default function Dashboard() {
    const [sessionId, setSessionId] = useState('');
    const [stats, setStats] = useState<AggregateStats | null>(null);
    const [staleData, setStaleData] = useState(false);

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
            .catch(() => {});

        fetch(`/api/session-info?session_id=${id}`)
            .then(r => r.json())
            .then(({ stale }: { stale: boolean }) => setStaleData(stale))
            .catch(() => {});
    }, []);

    return (
        <div className="flex min-h-screen flex-col bg-muted/20">
            <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-6 shadow-sm justify-between">
                <Link href="/" className="flex items-center gap-1.5 font-bold text-lg text-primary hover:opacity-80 transition-opacity">
                    <TrendingUp className="h-5 w-5" />
                    Syllobus
                </Link>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <Link href="/search">
                        <Search className="h-3.5 w-3.5" />
                        楽単検索
                    </Link>
                </Button>
            </header>

            <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
                <GradeAnalysis
                    stats={stats}
                    sessionId={sessionId}
                    onStatsUpdate={setStats}
                    staleData={staleData}
                />
            </main>
        </div>
    );
}
