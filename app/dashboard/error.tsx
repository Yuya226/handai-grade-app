"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <h2 className="text-lg font-bold">ダッシュボードの読み込みに失敗しました</h2>
            <p className="text-sm text-muted-foreground">
                成績データの取得中にエラーが発生しました。
            </p>
            <Button onClick={reset}>再試行</Button>
        </div>
    );
}
