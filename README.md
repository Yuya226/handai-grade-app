# Syllobus

大阪大学（KOAN）の成績データを分析・可視化するWebアプリです。

## 機能

- **成績アップロード**: KOANの成績照会画面のスクリーンショット（OCR）またはCSV（Shift-JIS）を解析
- **GPA偏差値**: 参加者全体との比較・学部別GPA実態
- **評価分布**: S / A / B / C / F の取得数をグラフ表示
- **科目検索**: 過去の成績分布・不可率を科目名で検索
- **卒業要件チェック**: 学部ごとの単位充足状況を確認（現在：経済学部）

## 使い方（ユーザー）

1. KOANの「成績照会」画面をスクリーンショット撮影、またはCSVをエクスポート
2. [Syllobus](https://handaigrade.vercel.app) にアクセスしてアップロード
3. ダッシュボードでGPA・偏差値・成績分布を確認

## 開発セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local` を作成して以下を記入してください。

```env
# Supabase（成績集計・科目データベース）
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Google Cloud Vision API（スクリーンショットOCR）
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=your-project-id

# オプション
WRITE_TOKEN_SECRET=任意のシークレット文字列   # save-grades APIの認証トークン（省略時: dev-secret-change-me）
PARSER_VERSION=1                              # 古いキャッシュ検出用バージョン番号
```

#### 各サービスの取得方法

| 変数 | 取得場所 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase プロジェクト設定 → API |
| `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` / `GOOGLE_PROJECT_ID` | Google Cloud Console → サービスアカウント → キーを作成（JSON）|

> `GOOGLE_PRIVATE_KEY` は JSON キーファイルの `private_key` フィールドをそのままコピーし、ダブルクォートで囲んでください。

### 3. Supabase のセットアップ

```bash
# マイグレーションを Supabase SQL Editor で実行
supabase/migrations/001_get_aggregate_stats.sql
```

### 4. 開発サーバー起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアクセス。

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Next.js 15 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS / shadcn/ui |
| データベース | Supabase (PostgreSQL) |
| OCR | Google Cloud Vision API |
| ホスティング | Vercel |

## 注意事項

- 本アプリは非公式です。大阪大学・KOANとは無関係です。
- アップロードされたスクリーンショット・CSVはサーバーに保存されません。
- 集計に使用するのはGPA値・学部・科目名のみです（匿名化済み）。
