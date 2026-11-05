# Link Drag

Webページ上のリンクをドラッグする方向によって，リンクの開き方や操作を切り替えるChrome拡張機能です．

初期バージョンは `0.0.1` です．現在は名称・メタデータの初期設定段階で，ドラッグ操作は未実装です．

## 主な機能（実装予定）

- 上下左右のドラッグ方向に応じたリンク操作
- 新しいタブ（前面・背面）・新しいウィンドウ・現在のタブでリンクを開く
- リンク先URLのコピー
- ドラッグ中にアクション名を表示
- ポップアップで方向別アクションや最小ドラッグ距離を設定
- 設定の自動保存と初期化

## インストール

### 手動インストール

1. このリポジトリをクローン

   ```bash
   git clone https://github.com/yhotta240/link-drag-extension.git
   cd link-drag-extension
   ```

2. 依存関係をインストール

   ```bash
   npm install
   ```

3. ビルド

   ```bash
   npm run build
   ```

4. Chromeで `chrome://extensions/` を開きます．「デベロッパーモード」をオンにして，「パッケージ化されていない拡張機能を読み込む」から `dist/` ディレクトリを選択してください．

## 使い方

Chromeの拡張機能メニューから「Link Drag」を選択すると，ポップアップを開けます．現在はドキュメント・バージョン・情報タブを確認できます．

導入後の操作や実装予定の設定は，[チュートリアル](docs/tutorial.md)を確認してください．更新内容は，[更新履歴](CHANGELOG.md)に記載します．

## ライセンス

MIT License

[chrome-extension-starter-kit](https://github.com/yhotamos/chrome-extension-starter-kit)をベースに開発しています．

## 作者

yhotta240
