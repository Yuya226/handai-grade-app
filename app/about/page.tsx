import Link from "next/link";
import { TrendingUp, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AboutPage() {
    return (
        <div className="flex min-h-screen flex-col bg-muted/20">
            <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-background px-6 shadow-sm gap-4">
                <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                </Link>
                <div className="flex items-center gap-2 font-bold text-lg text-primary">
                    <TrendingUp className="h-5 w-5" />
                    Syllobus
                </div>
            </header>

            <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6">
                <h1 className="text-2xl font-black">運営について</h1>

                {/* サービス説明 */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">サービスの目的</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                        <p>
                            Syllobus は、阪大生の成績に関する情報格差を解消することを目的とした、
                            学生有志による非公式サービスです。
                        </p>
                        <p>
                            KOANの成績スクリーンショットまたはCSVをアップロードすることで、
                            学部別GPA実態・科目の成績分布などの集計データにアクセスできます。
                            自分のデータを提供することで、みんなのデータが見える仕組みです。
                        </p>
                    </CardContent>
                </Card>

                {/* 免責事項 */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">免責事項</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
                        <p>
                            本サービスは大阪大学の公式サービスではなく、大学とは一切関係ありません。
                        </p>
                        <p>
                            掲載している統計データはユーザーの投稿に基づくものであり、
                            その正確性・完全性を保証するものではありません。
                            履修選択の最終判断はご自身の責任でお願いします。
                        </p>
                        <p>
                            サービスの内容は予告なく変更・停止・終了する場合があります。
                        </p>
                    </CardContent>
                </Card>

                {/* プライバシーポリシー */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">プライバシーポリシー</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground space-y-3 leading-relaxed">
                        <div>
                            <p className="font-medium text-foreground mb-1">収集する情報</p>
                            <p>
                                成績データ（科目名・評語・単位数・年度）およびGPAを収集します。
                                氏名・学籍番号などの個人を特定できる情報は収集しません。
                                各ユーザーはランダム生成されたセッションIDで匿名管理されます。
                            </p>
                        </div>
                        <div>
                            <p className="font-medium text-foreground mb-1">利用目的</p>
                            <p>
                                収集したデータは、学部別GPA・科目成績分布などの統計情報の算出にのみ使用します。
                                第三者への販売・提供は行いません。
                            </p>
                        </div>
                        <div>
                            <p className="font-medium text-foreground mb-1">外部サービスの利用</p>
                            <p>
                                スクリーンショットのOCR処理にGoogle Cloud Vision APIを使用しています。
                                アップロードされた画像は処理後に保持されません。
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* お問い合わせ */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">お問い合わせ</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground leading-relaxed">
                        <p>
                            ご意見・ご要望・不具合報告は X (Twitter) のDMにてお気軽にどうぞ。
                        </p>
                        <a
                            href="https://twitter.com/shirobasu"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block mt-2 font-medium text-primary hover:underline"
                        >
                            @shirobasu
                        </a>
                    </CardContent>
                </Card>
            </main>

            <footer className="border-t py-4">
                <p className="text-center text-xs text-muted-foreground">
                    阪大生による非公式サービス
                </p>
            </footer>
        </div>
    );
}
