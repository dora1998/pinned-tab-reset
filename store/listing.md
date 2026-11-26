# Chrome Web Store 掲載情報

デベロッパーダッシュボードの各欄にそのまま貼り付けられるようにまとめたものです。

## ストアの掲載情報

### 名前
Pinned Tab Reset

### 概要（manifest の description が使われます。132文字以内）
ショートカット一発でタブを設定済みの初期URLに戻す。閉じても初期URLで復活する固定タブを作れます。

### カテゴリ
仕事効率化（Productivity） > ツール（Tools）

### 説明（日本語）

```
固定タブを「いつもの場所」に戻せる拡張機能です。

メールやカレンダー、チャットなどを固定タブにしていると、リンクをたどるうちに最初のページから離れてしまいがちです。Pinned Tab Reset は、タブごとに「初期URL」を設定しておき、ショートカット一発でそのページに戻せるようにします。

■ 主な機能
・ショートカット（初期設定: Option+Shift+R / Alt+Shift+R）で、現在のタブを初期URLに戻す
・初期URLを設定したタブは、Cmd+W / Ctrl+W で閉じても同じ位置に初期URLで復活
・ページの右クリックメニューから、今のページを初期URLに設定
・設定画面で、初期URLの一覧表示・編集・解除
・ブラウザを再起動しても設定は維持されます

■ 使い方
1. 固定タブで戻したいページを開き、右クリック →「このページをタブの初期URLに設定」
2. 別のページに移動したあと、ショートカットを押すと初期URLに戻ります
3. 本当にタブを閉じたいときは、右クリック →「初期URLを解除してタブを閉じる」

ショートカットは chrome://extensions/shortcuts で変更できます。

■ プライバシー
設定した URL はブラウザ内にのみ保存され、外部に送信されることはありません。
```

### 説明（英語）

```
Snap your tabs back to where they belong.

When you keep email, calendar or chat in pinned tabs, following links takes you away from the page you started on. Pinned Tab Reset lets you set a "home URL" for each tab and jump back to it with a single shortcut.

Features
- Reset the current tab to its home URL with a shortcut (default: Option+Shift+R / Alt+Shift+R)
- Tabs with a home URL come back in the same position when closed with Cmd+W / Ctrl+W
- Set the current page as the tab's home URL from the right-click menu
- View, edit and remove home URLs on the options page
- Settings survive browser restarts

How to use
1. Open the page you want to come back to, right-click and choose "Set this page as the tab's home URL"
2. After navigating elsewhere, press the shortcut to return to the home URL
3. To close a tab for good, right-click and choose "Remove home URL and close tab"

You can change the shortcut at chrome://extensions/shortcuts.

Privacy
Home URLs are stored only in your browser and are never sent anywhere.

Note: The extension UI is currently available in Japanese only.
```

## プライバシーへの取り組み

### 単一用途の説明

```
ユーザーがタブごとに設定した「初期URL」へ、ショートカットなどの操作でタブを戻す機能、および初期URLを設定したタブが閉じられたときに初期URLで復元する機能を提供します。
```

### 権限が必要な理由

**tabs**
```
初期URLを設定したタブの位置と固定状態を追跡し、タブが閉じられたときに同じ位置へ初期URLで復元するために使用します。また、ブラウザ再起動後にタブIDが変わるため、開いているタブの URL と保存済みの初期URLを照合して紐付け直すために使用します。取得した URL は外部に送信しません。
```

**storage**
```
ユーザーが設定した初期URLを、ブラウザ再起動後も保持するためにブラウザ内に保存します。
```

**contextMenus**
```
ページの右クリックメニューに「このページをタブの初期URLに設定」「初期URLに戻す」などの操作を追加するために使用します。
```

### リモートコードの使用
「いいえ、リモートコードを使用していません」を選択

### データの使用
- 収集するデータ: **「ウェブ履歴」にチェック**（初期URLとして設定された URL、および照合のために開いているタブの URL を扱うため）
  - URL はブラウザ内でのみ処理・保存され、外部に送信されませんが、扱うデータの種類として申告しておくのが安全です
- 次の3項目すべてに同意（チェック）
  - 承認されている以外の用途で第三者にユーザーデータを販売、転送しない
  - アイテムの唯一の目的と関係のない目的でユーザーデータを使用、転送しない
  - 信用力を判断する目的、または融資目的でユーザーデータを使用、転送しない

### プライバシーポリシーの URL
```
https://github.com/dora1998/pinned-tab-reset/blob/main/PRIVACY.md
```

## 画像

| 項目 | ファイル | 備考 |
|---|---|---|
| ストアアイコン | `icons/icon128.png` | 128×128 |
| プロモーションタイル（小） | `store/promo-small-440x280.png` | `scripts/gen_promo.sh` で再生成できる |
| スクリーンショット | `store/screenshots/*.png` | `store/screenshots/README.md` を参照 |
