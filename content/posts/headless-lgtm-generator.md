---
title: "ヘッドレスなLGTM画像ジェネレータを作りました"
date: 2021-07-26T09:33:06+09:00
tags:
  - misc
---

<https://github.com/lambdasawa-sandbox/headless-lgtm-generator> を作りました。

以下のように `curl` でリクエストを投げると GitHub に貼り付けられる Markdown が返ってきます。

```sh
$ curl 'https://headless-lgtm-generator.herokuapp.com/markdown'
![LGTM](https://headless-lgtm-generator.herokuapp.com/?t=1627259720316)
> https://www.pinterest.com.au/Pixabay/
```

実際に使用するときは `alias lgtm="curl 'https://headless-lgtm-generator.herokuapp.com/markdown' | pbcopy"` みたいなエイリアスを貼っておくと、 `lgtm` とタイプするだけで適当な LGTM 画像のリンクがクリップボードに入ってきて便利です。

なお、このエンドポイントはいくつかクエリストリングを受け付けるようになっており、飯テロをしたい場合は以下のようなコマンドが便利です。

```sh
$ curl 'https://headless-lgtm-generator.herokuapp.com/markdown?q=肉&category=food&colors=brown'
![LGTM](https://headless-lgtm-generator.herokuapp.com/?q=%E8%82%89&category=food&colors=brown&t=1627260031691)
> https://www.pinterest.com.au/Pixabay/
```

LGTM画像を選ぶときにいつも迷ってしまい時間を浪費しがちだったので、ランダム性に頼ってそこを解決することを目的としています。

## 設計とか実装とか

Pixabay と Imgix に大きく依存しています。

Pixabay はいわゆるフリー素材の配布サイトです。
Pixabay を採用した理由は2つあります。
1つは[ライセンス](https://pixabay.com/ja/service/license/)で明示的に改変と再配布が許可されていることです。
もう1つは[API](https://pixabay.com/api/docs/)が提供されていることです。

Imgix は画像に特化したCDNです。
今回はCDNとしての用途は重視しておらず、[クエリストリングでテキスト描画などが出来る機能](https://docs.imgix.com/apis/rendering)に着目しました。
LGTMという文字列はこの機能を使って描画しています。

運用を頑張りたくなかったので実行環境には Heroku を採用しています。
素朴なアプリケーションなので頑張ってCloudFormationのテンプレートや`serverless.yml`などを書くのを避けました。

使用した言語は Clojure です。
今年の誕生日に欲しい物リストを貼ったら[プログラミングClojure](https://shop.ohmsha.co.jp/shopdetail/000000001949/)を送ってくださった方がいたので、Clojurianとしての素振りという意味合いが強いです。

その他、あまり採用事例を見たことがないのですが、シークレットの管理には Doppler を使用しました。
個人で使うAPIキーは今まで1Passwordで管理することが多かったのですが、それをプログラムに反映させるのが手間という問題がありました。
より具体的には`direnv`を使う想定で`.envrc`, `.env`にシークレットをコピペするのが面倒という話です。
複数マシンを使っているとそのマシン間でシークレットを同期させるのが面倒という問題もあります。
これらの問題を Doppler で出来そうでした。

以下のように `direnv exec` の代わりに `doppler run` を使用することで `.envrc`, `.env` を書かずにシークレットを環境変数に設定した状態でコマンドを実行することが出来ます。

```sh
$ doppler login    # マシンごとに1回だけやる
$ doppler setup    # doppler.yml があればやらなくて良い
$ doppler run -- bash -c 'echo $PIXABAY_API_KEY'
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

事前にシークレットを Dopper に登録しておく必要はあります。
これはブラウザからも出来ますし、`doppler secrets set HOGE` のようにCLIから行うことも出来ます。
