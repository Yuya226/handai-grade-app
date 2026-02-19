"use-not";
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Upload, BarChart3, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-secondary/20">
            <header className="sticky top-0 z-50 w-full border-b bg-background/60 backdrop-blur-md">
                <div className="container flex h-16 items-center justify-between px-4 md:px-6">
                    <div className="flex items-center gap-2 font-bold text-xl text-primary">
                        <BarChart3 className="h-6 w-6" />
                        <span>HandaiGrade</span>
                    </div>
                    <nav className="flex gap-4">
                        <Button variant="ghost" size="sm">
                            Features
                        </Button>
                        <Button variant="ghost" size="sm">
                            About
                        </Button>
                    </nav>
                </div>
            </header>
            <main className="flex-1">
                <section className="container px-4 py-24 md:px-6 md:py-32 lg:py-40">
                    <div className="flex flex-col items-center space-y-8 text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                            className="space-y-4"
                        >
                            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600">
                                Analyze Grades <br className="hidden sm:inline" />
                                in Seconds
                            </h1>
                            <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                                Just upload a screenshot of your Osaka University grade report.
                                We handle the rest. Privacy-focused, instant insights.
                            </p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="space-x-4"
                        >
                            <Button asChild size="lg" className="h-12 px-8 text-lg rounded-full">
                                <Link href="/dashboard">
                                    Gets Started <ArrowRight className="ml-2 h-5 w-5" />
                                </Link>
                            </Button>
                            <Button variant="outline" size="lg" className="h-12 px-8 text-lg rounded-full">
                                View Demo
                            </Button>
                        </motion.div>
                    </div>
                </section>

                <section className="container px-4 py-12 md:px-6 lg:py-24">
                    <div className="grid gap-8 md:grid-cols-3">
                        <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-2xl bg-card shadow-sm border">
                            <div className="p-3 bg-primary/10 rounded-full text-primary">
                                <Upload className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold">Screenshot Upload</h3>
                            <p className="text-muted-foreground">
                                No manual entry required. Simply take a screenshot of your grade portal content.
                            </p>
                        </div>
                        <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-2xl bg-card shadow-sm border">
                            <div className="p-3 bg-primary/10 rounded-full text-primary">
                                <BarChart3 className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold">Smart Analysis</h3>
                            <p className="text-muted-foreground">
                                Visualize GPA trends, graduation requirement fulfillment, and credit distribution.
                            </p>
                        </div>
                        <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-2xl bg-card shadow-sm border">
                            <div className="p-3 bg-primary/10 rounded-full text-primary">
                                <ShieldCheck className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold">Privacy First</h3>
                            <p className="text-muted-foreground">
                                Your data is anonymized. We prioritize your privacy and data security.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
            <footer className="border-t py-6 md:py-0">
                <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4 md:px-6">
                    <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                        Built for Osaka University Students. Not affiliated with the university.
                    </p>
                </div>
            </footer>
        </div>
    );
}
