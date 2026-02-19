"use-not";
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, BarChart3, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-secondary/20">
            <header className="sticky top-0 z-50 w-full border-b bg-background/60 backdrop-blur-md h-14">
                <div className="container flex h-full items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2 font-bold text-xl text-primary">
                        <BarChart3 className="h-6 w-6" />
                        <span>HandaiGrade</span>
                    </div>
                    <nav className="flex gap-4">
                        <Button variant="ghost" size="sm">
                            機能
                        </Button>
                        <Button variant="ghost" size="sm">
                            運営について
                        </Button>
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
                            className="space-y-2"
                        >
                            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600 leading-tight pb-1">
                                成績管理を、<br className="hidden sm:inline" />
                                もっとスマートに。
                            </h1>
                            <p className="mx-auto max-w-[700px] text-gray-500 md:text-lg dark:text-gray-400 leading-normal">
                                KOANの成績画面をスクショしてアップするだけ。<br className="hidden sm:inline" />
                                GPA推移や単位取得状況を一瞬で可視化します。
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="space-x-4"
                        >
                            <Button asChild size="lg" className="h-10 px-6 text-base rounded-full">
                                <Link href="/dashboard">
                                    今すぐ始める <ArrowRight className="ml-2 h-4 w-4" />
                                </Link>
                            </Button>
                            <Button variant="outline" size="lg" className="h-10 px-6 text-base rounded-full">
                                デモを見る
                            </Button>
                        </motion.div>
                    </div>
                </section>

                <section className="container px-4 py-6 md:px-6 lg:py-12">
                    <div className="grid gap-6 md:grid-cols-3">
                        <div className="flex flex-col items-center space-y-2 text-center p-4 rounded-2xl bg-card shadow-sm border">
                            <div className="p-2 bg-primary/10 rounded-full text-primary">
                                <Upload className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-bold">スクショでアップロード</h3>
                            <p className="text-xs text-muted-foreground">
                                手入力は不要です。KOANの成績画面を撮ってアップするだけ。
                            </p>
                        </div>
                        <div className="flex flex-col items-center space-y-2 text-center p-4 rounded-2xl bg-card shadow-sm border">
                            <div className="p-2 bg-primary/10 rounded-full text-primary">
                                <BarChart3 className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-bold">スマート分析</h3>
                            <p className="text-xs text-muted-foreground">
                                GPAの推移、卒業要件の充足状況をグラフで可視化。
                            </p>
                        </div>
                        <div className="flex flex-col items-center space-y-2 text-center p-4 rounded-2xl bg-card shadow-sm border">
                            <div className="p-2 bg-primary/10 rounded-full text-primary">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <h3 className="text-sm font-bold">プライバシー重視</h3>
                            <p className="text-xs text-muted-foreground">
                                データは匿名化され、あなたの情報を最優先に保護します。
                            </p>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="border-t py-4 md:py-0">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 md:px-6">
                    <p className="text-center text-xs leading-loose text-muted-foreground md:text-left">
                        大阪大学 経済学部2回年 久保 雄哉 開発 | 非公式サービス
                    </p>
                </div>
            </footer>
        </div>
    );
}
