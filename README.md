# Link Drag

Webページ上のリンクをドラッグする方向によって，リンクの開き方や操作を切り替えるChrome拡張機能です．

## 主な機能

- 右クリックメニューを使わず，ドラッグ方向（上下左右）でリンク操作を切り替え
- 方向ごとに好みの操作を割り当て可能
- 新しいタブ・ウィンドウで開く，URLをコピーするなどの様々な操作に対応

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

リンクをマウスの左ボタンでドラッグすると，上下左右に操作メニューが表示されます．実行したい操作に重ねて離すと実行します．初期設定は，上が背面タブ，下が前面タブ，左がURLコピー，右が新しいウィンドウです．

Chromeの拡張機能メニューから「Link Drag」を選択すると，方向別アクションやメニューの表示距離を設定できます．

操作方法や設定は，[チュートリアル](docs/tutorial.md)を確認してください．更新内容は，[更新履歴](CHANGELOG.md)に記載します．

## ライセンス

MIT License

[chrome-extension-starter-kit](https://github.com/yhotamos/chrome-extension-starter-kit)をベースに開発しています．

## 作者

yhotta240
