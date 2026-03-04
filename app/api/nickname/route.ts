import { NextRequest, NextResponse } from 'next/server';
import type { Grade } from '@/lib/types';

interface NicknameResult {
    nickname: string;
    review: string;
}

function generateNickname(grades: Grade[], gpa: number): NicknameResult {
    const total = grades.length;
    const counts = { S: 0, A: 0, B: 0, C: 0, F: 0 };
    grades.forEach(g => {
        if (g.grade && g.grade in counts) counts[g.grade as keyof typeof counts]++;
    });

    const { S, A, B, C, F } = counts;
    const sRatio = total > 0 ? S / total : 0;
    const cRatio = total > 0 ? C / total : 0;
    const fRatio = total > 0 ? F / total : 0;
    const allGrades = [S, A, B, C]; // excluding F

    // 特殊パターン: 全科目S
    if (S === total && total >= 5) {
        return { nickname: "S神", review: "全科目Sは人類の限界に挑戦している。もはや教官側の人間。" };
    }

    // F多め → 最優先
    if (F >= 6) {
        return { nickname: "再履修の魔術師", review: `F${F}個は伝説級。再履修で培った精神力は本物です。` };
    }
    if (F >= 4) {
        return { nickname: "Fコレクター", review: `F${F}個。失敗を恐れない姿勢、ある意味で尊い。` };
    }
    if (F >= 2) {
        if (gpa >= 2.8) {
            return { nickname: "傷ありの猛者", review: `F${F}個あってもGPA${gpa}台はバケモン。` };
        }
        return { nickname: "再履修ベテラン", review: `F${F}個の経験が今のあなたを作った（多分）。` };
    }
    if (F === 1) {
        if (gpa >= 3.2) {
            return { nickname: "ほぼ無敵の実力者", review: `あのF1個だけが心残り。それ以外は完璧すぎる。` };
        }
        return { nickname: "再履修経験者", review: "Fの痛みを知る者こそ真の阪大生。" };
    }

    // F = 0 以降
    // 超高GPA
    if (gpa >= 3.9) {
        return { nickname: "GPA4.0への刺客", review: "あと少しで完璧。もはや阪大の広報担当です。" };
    }
    if (gpa >= 3.7) {
        if (sRatio >= 0.6) {
            return { nickname: "S取り機", review: "勉強法を今すぐ有料で教えてほしい。本当に。" };
        }
        return { nickname: "GPA神", review: `GPA${gpa}台で阪大に人権あります。余裕で就活無双。` };
    }
    if (gpa >= 3.5) {
        return { nickname: "優等生の鑑", review: `GPA${gpa}台で単位も堅実。この調子で卒業まで頼む。` };
    }

    // S偏重
    if (sRatio >= 0.6 && gpa >= 3.0) {
        return { nickname: "S量産型", review: "履修科目でSを量産するスタイル、尊敬します。" };
    }

    // C偏重（ギリギリ戦略）
    if (cRatio >= 0.6) {
        return { nickname: "60点の哲学者", review: "合格は合格。それ以上でも以下でもない真理に到達済み。" };
    }
    if (cRatio >= 0.4 && fRatio === 0) {
        return { nickname: "最低限主義者", review: "必要最小限で生き抜く。効率化の極みです。" };
    }

    // 中堅GPA帯
    if (gpa >= 3.2) {
        if (allGrades.every(v => v === 0 || v > 0) && S > 0 && A > 0 && B > 0) {
            return { nickname: "バランス型履修者", review: "S・A・B をバランスよく揃える安定感。社会でも使えます。" };
        }
        return { nickname: "堅実な単位師", review: "落とさず着実に積み上げてる。この安定感は才能。" };
    }
    if (gpa >= 3.0) {
        return { nickname: "平均超えの戦士", review: "阪大でGPA3台キープはただ者じゃない。" };
    }
    if (gpa >= 2.7) {
        return { nickname: "単位錬金術師", review: "ギリギリでも単位は単位。錬金術の才能あり。" };
    }
    if (gpa >= 2.3) {
        return { nickname: "崖っぷちのサバイバー", review: "この成績から生き延びる精神力は本物。来期は頼む。" };
    }
    return { nickname: "ギリギリの哲学者", review: "単位の重みを誰よりも深く知っている。それは財産。" };
}

export async function POST(req: NextRequest) {
    try {
        const { grades, gpa }: { grades: Grade[]; gpa: number } = await req.json();
        const result = generateNickname(grades, gpa);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Nickname generation error:', error);
        return NextResponse.json({ error: 'Failed to generate nickname' }, { status: 500 });
    }
}
