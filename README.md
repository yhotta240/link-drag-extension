# Link Drag

リンクをドラッグするだけで，新しいタブで開く操作やURLのコピーが手軽にできるChrome拡張機能です．

## 主な機能

- 右クリックメニューを使わず，ドラッグ方向（上下左右・斜め）でリンク操作を切り替え
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

リンクを左ボタンでドラッグし，表示された操作アイコンに重ねて離すと実行します．通常は割り当てた方向に，画面端では開始位置を中心とした円弧にアイコンが並びます．Escキーや，操作が選択されていない位置で離すとキャンセルできます．

Chromeの拡張機能メニューから「Link Drag」を選択すると，方向別アクションやメニューの表示距離を設定できます．

操作方法や設定は，[チュートリアル](docs/tutorial.md)を確認してください．更新内容は，[更新履歴](CHANGELOG.md)に記載します．

## ライセンス

MIT License

[chrome-extension-starter-kit](https://github.com/yhotamos/chrome-extension-starter-kit)をベースに開発しています．

## 作者

yhotta240
