# Open Prompts

**Open Prompts** は、**AI 画像プロンプトテンプレート**の発見・共有・再利用のためのオープンソースプラットフォームです。キュレーションされたギャラリーでテンプレートを閲覧し、生成スタジオで開いて、プラガブルなプロバイダーで画像を作成できます。ひとつのワークフローのまま完結します。

リポジトリ：[github.com/rudy2steiner/open-prompts](https://github.com/rudy2steiner/open-prompts)

[Apache License, Version 2.0](LICENSE) の下で提供されています。

**言語：** [English](./README.md) · [简体中文](./README.zh-CN.md) · 日本語

---

## はじめに

多くのチームはプロンプトをドキュメント、スレッド、スプレッドシートに散在させています。**Open Prompts** は、プレビュー画像・タグ・モデル・公開範囲（公開 / 非公開 / 下書き）を備えた **テンプレート** に整理します。ユーザーは次のことができます。

- **ギャラリー** でコミュニティおよびカタログのプロンプトを探索
- テンプレートからワンクリックで **生成**
- 公開プロンプトを **提出** して審査に回す、またはアカウントから **非公開** テンプレートを作成
- **GitHub**、**Google**、または **メール** でサインイン（運用者は管理者資格情報）

アプリは **Next.js**、**next-intl**（英語・中国語・日本語）、**NextAuth**、**Postgres**（例：Supabase）で構築されています。画像生成はサーバー API 経由で、現時点では **Atlas Cloud** に対応（**Replicate** は予定で未対応）、および有料 API 不要の **テストモード** があります。

---

## 主な機能

| 領域 | 内容 |
|------|------|
| **ギャラリー** | モデル・タグで検索・フィルタ。詳細表示から Create へ遷移（プロンプトは事前入力）。 |
| **Create スタジオ** | テンプレートカルーセル、プロンプトエディタ、アスペクト比 / 品質 / バッチ制御、プロバイダー選択、セッション履歴（ブラウザ `localStorage`）。 |
| **Submit フロー** | 単一ページウィザード。ギャラリー公開（公開 → 審査キュー）または `?visibility=private` で **非公開** テンプレートを保存。 |
| **アカウント** | マイテンプレート、管理者 **審査キュー**（承認 / 却下）、クレジット・サブスクリプションのプレースホルダー UI。 |
| **認証** | GitHub / Google OAuth。設定済み管理者向けメール・パスワード。公開の自己登録 UI はなし。 |
| **管理者モデレーション** | 全テンプレートを対象とした審査キュー。ステータスと公開範囲はギャラリー規則に整合。 |
| **X インポート** | Submit で公開ツイート URL を貼り付け、タイトル・説明・プロンプト・画像を事前入力。 |
| **i18n** | ロケールルート：`/`（英語）、`/zh`、`/ja`。共通ヘッダー・フッター。 |
| **セルフホスト** | Apache 2.0。環境変数でプロバイダーと DB を設定。Vercel または任意の Node ホストにデプロイ可能。 |

---

## クイックスタート

### 前提条件

- **Node.js** 18+（20 LTS 推奨）
- **npm**（または pnpm / yarn）
- **Postgres** データベース（[Supabase](https://supabase.com) が適しています）
- 任意：**Atlas Cloud** の API キー（実際の生成用）

### 1. クローンとインストール

```bash
git clone https://github.com/rudy2steiner/open-prompts.git
cd open-prompts
npm install
```

### 2. 環境変数

```bash
cp .env.example .env.local
```

最低限、次を設定します。

| 変数 | 用途 |
|------|------|
| `DATABASE_URL` | Postgres 接続文字列（マイグレーションと管理者クエリには Supabase **Session pooler** ポート **5432** を推奨） |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` で生成 |
| `NEXT_PUBLIC_SITE_URL` | ローカルでは `NEXTAUTH_URL` と同じ（SEO 用） |

サインインと管理者：

| 変数 | 用途 |
|------|------|
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth アプリ |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth クライアント |
| `ADMIN_EMAIL` | 管理者メール（複数はカンマ区切り。ログインメールと完全一致すること） |
| `ADMIN_PASSWORD` | 8 文字以上。起動時 / 管理者ログイン時に DB と同期 |

画像生成（既存の OpenAI 互換 Provider、任意の Atlas Cloud / Replicate Provider、またはテストモード）：

| 変数 | 用途 |
|------|------|
| `DEFAULT_IMAGE_PROVIDER` | デフォルトは `openai-compatible`。`atlascloud` と `replicate` は任意の代替 Provider |
| `OPENAI_IMAGE_BASE_URL` / `OPENAI_IMAGE_API_KEY` | サーバー側の OpenAI 互換画像 API 設定 |
| `OPENAI_IMAGE_MODEL` | 画像モデル名。例：`gpt-image-2` |
| `ATLASCLOUD_BASE_URL` / `ATLASCLOUD_API_KEY` | 任意の [Atlas Cloud](https://www.atlascloud.ai) Provider 設定 |
| `USE_TEST_MODE` | `true` で実 API をスキップ |
| `TEST_IMAGE_URL` | テストモードで返す画像 URL |

クレジット上限と完全な Provider 設定は [`.env.example`](.env.example) を参照してください。

### 3. データベース

Supabase SQL エディタまたは `psql` でマイグレーションを適用し、必要に応じてシードします。

```bash
# 任意：Drizzle で schema を push
npm run db:push

# 同梱データセットからギャラリーテンプレートを投入
npm run seed:prompts

# 管理者パスワードを DB に反映（ログイン失敗時）
npm run seed:admin
```

マイグレーション SQL は `supabase/migrations/` と `scripts/apply-owner-visibility-migration.sql` にあります。

### 4. 開発サーバーを起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます（デフォルトポート **3000**）。

### 5. Vercel にデプロイ

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Frudy2steiner%2Fopen-prompts&env=NEXTAUTH_SECRET,ADMIN_EMAIL,ADMIN_PASSWORD&envDescription=Required%20secrets%20(minimum)&project-name=open-prompts)

1. [Vercel](https://vercel.com) でリポジトリをインポート（Next.js プリセット、ビルド `npm run build`）。
2. 手順 2 と同じ環境変数を設定。`NEXTAUTH_URL` と `NEXT_PUBLIC_SITE_URL` は `https://your-app.vercel.app` にする。
3. Supabase で `supabase/migrations/` を実行し、ローカルでその `DATABASE_URL` に対して `npm run seed:prompts` と `npm run seed:admin` を実行。
4. OAuth コールバックを登録：`…/api/auth/callback/github` と `…/api/auth/callback/google`（Vercel のドメインに置き換え）。

環境変数変更後は再デプロイ。管理者ログインに失敗したら、本番の `DATABASE_URL` で `npm run seed:admin` を実行。

---

## プロバイダー

| プロバイダー | 状態 | 設定 |
|--------------|------|------|
| **OpenAI-compatible** | 対応済み・デフォルト | `OPENAI_IMAGE_BASE_URL`、`OPENAI_IMAGE_API_KEY`、`OPENAI_IMAGE_MODEL` |
| **Atlas Cloud** | 任意 | `ATLASCLOUD_API_KEY`、`ATLASCLOUD_BASE_URL` |
| **Replicate** | 任意 | `REPLICATE_API_TOKEN`、`REPLICATE_MODEL` または `REPLICATE_VERSION` |
| **テストモード** | 開発 / デモ | `USE_TEST_MODE=true`、`TEST_IMAGE_URL` |

A+ Studio は既存の OpenAI 互換 Provider と参照画像編集を再利用します。Atlas Cloud は必須ではありません。Create ページでは BYOK 対応 Provider の API キーをブラウザ（`localStorage`）で上書きできますが、本番ではサーバー側の環境変数を推奨します。

---

## 技術スタック

- [Next.js 14](https://nextjs.org/)（App Router）
- [next-intl](https://next-intl-docs.vercel.app/) · [NextAuth.js](https://next-auth.js.org/)
- [Drizzle ORM](https://orm.drizzle.team/) + Postgres
- [Tailwind CSS](https://tailwindcss.com/) · [daisyUI](https://daisyui.com/)

---

## コントリビューション

Issue と Pull Request を歓迎します。大きな変更は、まず Issue で方向性を相談してください。

---

## まとめ

**Open Prompts** は **再利用可能な画像プロンプト** の実用的なハブを目指しています。ギャラリーで効果的なプロンプトを見つけ、選んだモデルで生成し、テンプレートをコミュニティに還元する——非公開の下書きと、公開掲載のためのモデレーションを両立します。Fork して Supabase と組み合わせて Vercel にデプロイし、好みの画像 API を接続し、Apache 2.0 の下でチーム向けにワークフローを調整できます。

このプロジェクトが役に立ったら、リポジトリに Star を付け、[GitHub Issues](https://github.com/rudy2steiner/open-prompts/issues) でフィードバックを共有してください。
