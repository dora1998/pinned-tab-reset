# pinned-tab-reset

Arc / Dia の固定タブのように、ショートカット一発でタブを「初期URL」に戻す Chrome 拡張です。

## インストール

1. `chrome://extensions` を開き、右上の「デベロッパーモード」を ON にする
2. 「パッケージ化されていない拡張機能を読み込む」でこのディレクトリを選ぶ

## 使い方

1. 戻したいページを開き、右クリック →「このページをタブの初期URLに設定」（ツールバーアイコンに ✓ が出ます）
2. どこかへ移動したあと `Option+Shift+R`（Windows/Linux は `Alt+Shift+R`）で初期URLに戻ります
   - ツールバーアイコンのクリックや、右クリック →「初期URLに戻す」でも戻せます
   - 初期URLが未設定のタブではアイコンに `?` が出て、何も起きません

3. 初期URLを設定したタブを `Cmd+W` などで閉じると、同じ位置・同じ固定状態で初期URLのタブが（バックグラウンドで）復活します
   - 本当に閉じたいときは、右クリック →「初期URLを解除してタブを閉じる」

4. 設定画面（ツールバーアイコンを右クリック →「オプション」、またはページの右クリック →「初期URLの一覧・編集…」）で、次のことができます
   - 初期URLを設定中のタブの一覧表示、初期URLの直接編集・解除
   - 初期URLが未設定の固定タブに、現在のURLを初期URLとして設定
   - 再起動後などで、まだタブに紐付いていない初期URLの編集・削除

ショートカットは `chrome://extensions/shortcuts` で変更できます。
`Cmd+W` などの Chrome 予約キーは割り当てられません。

## 仕様メモ

- 初期URLはタブごとに設定します。固定タブ以外でも使えます
- ウィンドウごと閉じた場合（ブラウザ終了を含む）は復活させず、設定は再起動後のために残します
- 復活したタブは新しいタブとして作り直すため、閉じる前の戻る/進むの履歴は引き継がれません。また `Cmd+Shift+T` で閉じたタブを開き直すと重複します
- タブIDはブラウザを再起動すると変わります。再起動後は開いているタブの URL と完全一致する初期URLを探し、なければ固定タブの中から同じオリジンのものを探して紐付け直します
  - 再起動後に別ドメインへ移動していたタブは紐付けに失敗することがあります

## アイコン

`icons/*.png` は `scripts/gen_icons.py`（Python 標準ライブラリのみ）で生成しています。デザインを変えるときはスクリプトを編集して再生成してください。

```sh
python3 scripts/gen_icons.py
```

## Chrome Web Store への提出

```sh
scripts/gen_promo.sh   # store/promo-small-440x280.png を生成（ImageMagick が必要）
scripts/package.sh     # dist/pinned-tab-reset-<version>.zip を生成
```

- 掲載情報・権限の使用理由などの文面: [store/listing.md](store/listing.md)
- スクリーンショットの置き場所と形式: [store/screenshots/README.md](store/screenshots/README.md)
- プライバシーポリシー: [PRIVACY.md](PRIVACY.md)
- 更新を提出するときは `manifest.json` の `version` を上げる
