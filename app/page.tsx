"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lock, TrendingUp, Bell } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-secondary/20">
            <header className="sticky top-0 z-50 w-full border-b bg-background/60 backdrop-blur-md h-14">
                <div className="container flex h-full items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2 font-bold text-xl text-primary">
                        <TrendingUp className="h-6 w-6" />
                        <span>HandaiGrade</span>
                    </div>
                    <nav className="flex gap-4">
                        <Button variant="ghost" size="sm">運営について</Button>
                    </nav>
                </div>
            </header>
            <main className="flex-1 flex flex-col justify-center">
                <section className="container px-4 py-10 md:px-6 md:py-16">
                    <div className="flex flex-col items-center space-y-6 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="space-y-3"
                        >
                            <p className="text-sm font-semibold text-primary tracking-widest uppercase">
                                阪大生の成績、集合知で丸裸に。
                            </p>
                            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600 leading-tight pb-1">
                                スクショ1枚で、<br className="hidden sm:inline" />
                                情報格差をゼロに。
                            </h1>
                            <p className="mx-auto max-w-[620px] text-gray-500 md:text-lg dark:text-gray-400 leading-relaxed">
                                KOANの成績スクショをアップするだけ。<br className="hidden sm:inline" />
                                <span className="font-semibold text-foreground">学科別GPA実態・科目の成績分布</span>への
                                アクセス権をその場で取得。
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="flex flex-col sm:flex-row items-center gap-3"
                        >
                            <Button asChild size="lg" className="h-11 px-8 text-base rounded-full">
                                <Link href="/dashboard">
                                    成績をアップロード <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button asChild size="lg" variant="outline" className="h-11 px-8 text-base rounded-full">
                                <Link href="/dashboard">
                                    楽単・エグ単を探す
                                </Link>
                            </Button>
                        </motion.div>
                    </div>
                </section>

                <section className="container px-4 py-6 md:px-6 lg:py-12">
                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="flex flex-col items-center space-y-2 text-center p-5 rounded-2xl bg-card shadow-sm border">
                            <div className="p-2 bg-primary/10 rounded-full text-primary">
                                <Lock className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-bold">アップ = アクセス解除</h3>
                            <p className="text-xs text-muted-foreground">
                                スクショを提供した人だけが、全体の集計データを閲覧できます。出す人が得をする仕組み。
                            </p>
                        </div>
                        <div className="flex flex-col items-center space-y-2 text-center p-5 rounded-2xl bg-card shadow-sm border border-orange-200 bg-orange-50/30">
                            <div className="p-2 bg-orange-100 rounded-full text-orange-500">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-bold">成績分布で科目選び</h3>
                            <p className="text-xs text-muted-foreground">
                                S/A/B/C/Fの分布をリアルタイム集計。楽単探しも単位死守も、データで判断。
                            </p>
                        </div>
                        <div className="flex flex-col items-center space-y-2 text-center p-5 rounded-2xl bg-card shadow-sm border border-dashed opacity-70">
                            <div className="p-2 bg-secondary rounded-full text-muted-foreground">
                                <Bell className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-bold">卒業要件チェック <span className="text-xs font-normal text-muted-foreground ml-1">Coming Soon</span></h3>
                            <p className="text-xs text-muted-foreground">
                                学科ごとの卒業要件ロジックをAIが学習中。データが集まり次第、先行公開します。
                            </p>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="border-t py-4 md:py-0">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 md:px-6">
                    <p className="text-center text-xs leading-loose text-muted-foreground md:text-left">
                        大阪大学生による非公式サービス
                    </p>
                </div>
            </footer>
        </div>
    );
}
