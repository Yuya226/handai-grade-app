"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
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
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
            <h2 className="text-xl font-bold">予期しないエラーが発生しました</h2>
            <p className="text-sm text-muted-foreground">
                ページの読み込み中に問題が起きました。再試行してください。
            </p>
            <Button onClick={reset}>再試行</Button>
        </div>
    );
}
