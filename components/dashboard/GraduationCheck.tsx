"use client";

import { useState } from "react";
import {
    CheckCircle2, AlertCircle, HelpCircle, GraduationCap, ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Grade } from "@/lib/types";
import { calcEconProgress, gradeKey, ECON_2025, type CategoryProgress } from "@/lib/requirements";

// ── グレードバッジの色 ────────────────────────────────────────────────────────
const GRADE_COLOR: Record<string, string> = {
    S: 'bg-emerald-100 text-emerald-700',
    A: 'bg-blue-100 text-blue-700',
    B: 'bg-yellow-100 text-yellow-700',
    C: 'bg-orange-100 text-orange-700',
    F: 'bg-red-100 text-red-700',
    P: 'bg-gray-100 text-gray-600',
};

// ── 科目リスト（展開時に表示）────────────────────────────────────────────────
function CourseList({ courses, emptyNote }: { courses: Grade[]; emptyNote?: string }) {
    if (courses.length === 0) {
        return (
            <p className="text-xs text-muted-foreground italic py-1">
                {emptyNote ?? '該当する科目がありません'}
            </p>
        );
    }
    return (
        <ul className="space-y-1 py-1">
            {courses.map((g, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${GRADE_COLOR[g.grade ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                        {g.grade ?? '?'}
                    </span>
                    <span className="flex-1 truncate">{g.subject}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                        {g.credits}単位
                    </span>
                </li>
            ))}
        </ul>
    );
}

// ── ステータスアイコン ─────────────────────────────────────────────────────────
function StatusIcon({ cp }: { cp: CategoryProgress }) {
    if (cp.category.manualCheck) return <HelpCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
    if (cp.fulfilled)            return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    return                              <AlertCircle  className="h-3.5 w-3.5 text-rose-500  shrink-0" />;
}

// ── カテゴリ行（展開可能）────────────────────────────────────────────────────
function CategoryRow({
    cp, isOpen, onToggle,
}: {
    cp: CategoryProgress;
    isOpen: boolean;
    onToggle: () => void;
}) {
    const pct = cp.category.minCredits > 0
        ? Math.min((cp.earned / cp.category.minCredits) * 100, 100)
        : 100;

    const creditColor = cp.category.manualCheck ? 'text-amber-600'
        : cp.fulfilled ? 'text-green-600' : 'text-rose-600';
    const barColor = cp.category.manualCheck ? 'bg-amber-400'
        : cp.fulfilled ? 'bg-green-500' : 'bg-rose-400';

    return (
        <div>
            <button
                onClick={onToggle}
                className="w-full text-left py-1.5 hover:bg-muted/40 rounded-md px-1 -mx-1 transition-colors"
            >
                <div className="flex items-center gap-2 mb-1">
                    <StatusIcon cp={cp} />
                    <span className="text-sm flex-1">{cp.category.label}</span>
                    <span className={`text-xs font-medium tabular-nums ${creditColor}`}>
                        {cp.earned}
                        {!cp.category.manualCheck && `/${cp.category.minCredits}`}
                        単位
                    </span>
                    <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                    />
                </div>
                {cp.category.minCredits > 0 && (
                    <div className="ml-5 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="ml-5 pl-3 border-l-2 border-dashed border-muted-foreground/20 mb-1">
                    {cp.category.note && (
                        <p className="text-[10px] text-muted-foreground mt-1 mb-0.5 leading-tight">
                            {cp.category.note}
                        </p>
                    )}
                    <CourseList
                        courses={cp.courses}
                        emptyNote={cp.category.id === 'jiyu_elec'
                            ? '各カテゴリの超過単位から自動算出されます（個別の科目は各カテゴリを参照）'
                            : undefined}
                    />
                </div>
            )}
        </div>
    );
}

// ── 未分類科目セクション ──────────────────────────────────────────────────────
function UnclassifiedSection({
    courses,
    overrides,
    onOverride,
}: {
    courses: Grade[];
    overrides: Record<string, string>;
    onOverride: (key: string, catId: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(true);
    if (courses.length === 0) return null;

    return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <button
                onClick={() => setIsOpen(v => !v)}
                className="w-full flex items-center gap-2 text-xs font-semibold text-rose-700"
            >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 text-left">
                    未分類の科目（{courses.length}件）— どの要件に該当するか選んでください
                </span>
                <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {isOpen && (
                <ul className="mt-2 space-y-2">
                    {courses.map(g => {
                        const key = gradeKey(g);
                        return (
                            <li key={key} className="flex items-center gap-2 text-xs">
                                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${GRADE_COLOR[g.grade ?? ''] ?? 'bg-gray-100 text-gray-600'}`}>
                                    {g.grade ?? '?'}
                                </span>
                                <span className="flex-1 truncate text-rose-900">{g.subject}</span>
                                <span className="shrink-0 tabular-nums text-rose-600">
                                    {g.credits}単位
                                </span>
                                <select
                                    value={overrides[key] ?? ''}
                                    onChange={e => onOverride(key, e.target.value)}
                                    className="shrink-0 rounded border border-rose-300 bg-white text-[11px] px-1 py-0.5 text-rose-900 focus:outline-none focus:ring-1 focus:ring-rose-400"
                                >
                                    <option value="">選択...</option>
                                    {ECON_2025.filter(c => !c.manualCheck).map(c => (
                                        <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                </select>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

// ── グループヘッダー ──────────────────────────────────────────────────────────
const GROUP_DEFS = [
    { id: 'A', label: '教養教育系', minCredits: 18 },
    { id: 'B', label: '国際性涵養系', minCredits: 18 },
    { id: 'C', label: '専門教育系', minCredits: 72 },
    { id: 'D', label: '自由選択', minCredits: 22 },
] as const;

// ── メインコンポーネント ──────────────────────────────────────────────────────
export default function GraduationCheck({ grades }: { grades: Grade[] }) {
    const [overrides, setOverrides] = useState<Record<string, string>>({});
    const progress = calcEconProgress(grades, overrides);

    const overallPct = Math.min((progress.totalEarned / 130) * 100, 100);
    const remaining = Math.max(0, 130 - progress.totalEarned);

    const allAutoFulfilled =
        progress.byCategory.filter(c => !c.category.manualCheck).every(c => c.fulfilled)
        && progress.unclassified.length === 0
        && remaining === 0;

    const [openCats, setOpenCats] = useState<Set<string>>(new Set());
    const toggle = (id: string) =>
        setOpenCats(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const handleOverride = (key: string, catId: string) => {
        setOverrides(prev => {
            if (!catId) {
                const { [key]: _, ...rest } = prev;
                return rest;
            }
            return { ...prev, [key]: catId };
        });
    };

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    卒業要件チェック
                </CardTitle>
                <CardDescription>経済学部 2025年度以降入学者（総 130 単位）</CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                {/* ── 総修得単位 ── */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                    <div className="flex items-baseline justify-between">
                        <span className="text-sm font-medium">総修得単位数</span>
                        <div>
                            <span className="text-2xl font-bold">{progress.totalEarned}</span>
                            <span className="text-sm text-muted-foreground"> / 130 単位</span>
                        </div>
                    </div>
                    <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${overallPct}%` }}
                        />
                    </div>
                    {allAutoFulfilled ? (
                        <p className="text-xs font-medium text-green-600">✓ 自動判定できる全要件を充足しています</p>
                    ) : (
                        <p className="text-xs text-muted-foreground">
                            あと <span className="font-bold text-foreground">{remaining}</span> 単位必要
                        </p>
                    )}
                </div>

                {/* ── 未分類科目 ── */}
                <UnclassifiedSection
                    courses={progress.unclassified}
                    overrides={overrides}
                    onOverride={handleOverride}
                />

                {/* ── カテゴリ別内訳 ── */}
                {GROUP_DEFS.map(({ id, label, minCredits }) => {
                    const cats = progress.byCategory.filter(c => c.category.group === id);
                    const groupEarned = cats.reduce((sum, c) => sum + c.earned, 0);
                    const groupOk = groupEarned >= minCredits;

                    return (
                        <div key={id}>
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-[10px] font-bold bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                                    {id}
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                                <Badge
                                    variant="secondary"
                                    className={`ml-auto text-[10px] tabular-nums ${groupOk ? 'bg-green-100 text-green-700' : ''}`}
                                >
                                    {groupEarned} / {minCredits} 単位
                                </Badge>
                            </div>
                            <div className="space-y-0 pl-3 border-l-2 border-muted">
                                {cats.map(cp => (
                                    <CategoryRow
                                        key={cp.category.id}
                                        cp={cp}
                                        isOpen={openCats.has(cp.category.id)}
                                        onToggle={() => toggle(cp.category.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* ── 注意事項 ── */}
                <div className="space-y-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <p className="font-semibold mb-0.5">
                            <HelpCircle className="inline h-3 w-3 mr-0.5 align-middle" />
                            手動確認が必要な科目
                        </p>
                        <p className="leading-relaxed">
                            <span className="font-medium">高度教養（2単位）</span>は2年次秋以降に他学部科目等から取得。
                            <span className="font-medium">高度国際性涵養（2単位）</span>は2年次秋以降の選択必修Ⅱ等（○印）を履修することで充足できます。
                            学部の
                            <a href="https://www.econ.osaka-u.ac.jp/undergraduate/u-curriculum/" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                                卒業単位確認表
                            </a>
                            でご確認ください。
                        </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                        ※ 2025年度以降入学者の要件です。2019〜2024年度入学者は別途ご確認ください。
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
