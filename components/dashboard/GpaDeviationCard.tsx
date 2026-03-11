"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Copy, Check } from "lucide-react";
import type { AnalysisResult, AggregateStats } from "@/lib/types";

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

interface Props {
    analysisData: AnalysisResult;
    stats: AggregateStats | null;
    deviation: number | null;
    participantCount: number;
}

export default function GpaDeviationCard({ analysisData, stats, deviation, participantCount }: Props) {
    const [copied, setCopied] = useState(false);

    const handleShare = () => {
        const devText = deviation != null ? `偏差値 ${deviation}` : `GPA ${analysisData.gpa.cumulative}`;
        const percentileText = stats?.userPercentile ? `上位${stats.userPercentile}%` : '';
        const text = `阪大内GPA${devText}！\nGPA ${analysisData.gpa.cumulative}${percentileText ? ` / ${percentileText}` : ''}\n\n#阪大成績偏差値 #シロバス\nhttps://handaigrade.vercel.app`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleCopy = async () => {
        const devText = deviation != null ? `偏差値 ${deviation}` : `GPA ${analysisData.gpa.cumulative}`;
        const percentileText = stats?.userPercentile ? `上位${stats.userPercentile}%` : '';
        await navigator.clipboard.writeText(`阪大内GPA${devText}！\nGPA ${analysisData.gpa.cumulative}${percentileText ? ` / ${percentileText}` : ''}\n#阪大成績偏差値 #シロバス`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
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
    );
}
