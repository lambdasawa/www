---
title: "direnv と sops で設定を管理する"
date: 2020-05-03T12:26:49+09:00
draft: false
---

最近環境依存の値を `direnv` で管理していたのですが、環境ごとに `.env` を管理するのが辛くなってきたので、 `sops` と組み合わせて `.env` を安全にバージョン管理する方法についてまとめます。

[direnv](https://github.com/direnv/direnv) は雑に説明すると `direnv allow .` で許可したディレクトリに `.env` というファイルがあると、そのディレクトリに `cd` したときに `.env` に書いてある値が環境変数に設定されるというものです。`brew` でインストールできます。  

[sops](https://github.com/mozilla/sops) は雑に説明すると任意のファイルを AWS の KMS などで暗号/複合するためのユーティリティです。 `brew` でインストールできます。  
AWS ではなく GCP などでも使えるようですが、自分は使っていないためここでは省略します。  
復号後の値を `.env` のフォーマットで出力できるため、 `direnv` と連携しやすいです。  
[Ruby on Rails の master.key](https://railsguides.jp/5_2_release_notes.html#credential%E7%AE%A1%E7%90%86) の仕組みを知っている方であれば、それと同じようなものと考えていただいて問題ないです。

## アプリケーション

まずサンプルとして以下のような JavaScript のアプリケーションがあるとします。

```javascript
console.log([process.env.KEY_1, process.env.KEY_2].join(" , "));
```

`KEY_1`, `KEY_2` はそれぞれ DB のユーザ名、パスワード、接続先ドメイン、ポートなどであるという想定です。  
例えばローカルと本番環境では接続先ドメインは異なりますし、何かポートの衝突が発生していてチームの他の開発者とは異なるポートを設定したい…というシチュエーションが考えられるものです。  
また、パスワードなどが含まれることもあるため、ローカル環境のデフォルト値などを除いてコミットはしたくないものとします。

## `.env.sample` について

```bash
KEY_1=VALUE_1
KEY_2=VALUE_2
```

アプリケーションで使う値のサンプルを記載します。  
ローカルで使うデフォルトのパスワードなどは含まれますが、本番環境で使うパスワードなどは含めずにコミットします。

## `.envrc` について

```bash
dotenv .env
dotenv .env.local
```

`.env` には `sops` で復号した値を書き込みます。
それを `.env.local` で記載した値で上書きするというような設定になっています。

これによって、例えば DB の接続先ドメインなど開発者ごとに共通するものは `.env` に書かれ、
それを個別の開発者が上書きしたい場合は個々人が `.env.local` を編集する、という仕組みが作れます。

## `encrypted-env.yml` について

```yaml
KEY_1: ENC[AES256_GCM,data:XXXX,tag:XXXX,type:str]
KEY_2: ENC[AES256_GCM,data:XXXX,tag:XXXX,type:str]
sops:
    kms:
    -   arn: arn:aws:kms:ap-northeast-1:XXXX:key/XXXX
        created_at: '2020-05-03T04:12:33Z'
        enc: XXXX
        aws_profile: ""
    gcp_kms: []
    azure_kv: []
    lastmodified: '2020-05-03T04:13:14Z'
    mac: ENC[AES256_GCM,data:XXXX,tag:XXXX,type:str]
    pgp: []
    unencrypted_suffix: _unencrypted
    version: 3.5.0
```

これは `env EDITOR="code --wait" sops encrypted-env.yml` のコマンドで作成、編集をします。
`EDITOR` は `.bashrc` などで指定されていれば明示する必要はありません。
各値は KMS で暗号化されたものになっており、 この KMS にアクセスする AWS の権限がないと復号出来ないようになっています。
そのため、 AWS の権限は別で管理するとして上記のファイルはコミットしてバージョン管理が可能です。

環境が複数ある場合は `encrypted-env-dev.yml`, `encrypted-env-production.yml` などを追加してコミットします。

ファイル名はどれも任意のもので問題ありません。

## `.env` について

```bash
KEY_1=SECRET_VALUE_1
KEY_2=SECRET_VALUE_2
```

これは `sops` で作られた `encrypted-env.yml` を復号した結果です。  
以下のようなコマンドで復号した値を適切なフォーマットで `.env` に保存できます。

```bash
env \
  SOPS_KMS_ARN=arn:aws:kms:ap-northeast-1:XXXX:key/XXXX \
  sops \
    --decrypt \
    --output-type dotenv \
    encrypted-env.yml \
    > .env
```

他の開発者が `encrypted-env.yml` を更新した場合は `git pull` した後に上記コマンドを実行することでローカルの環境更新が行なえます。

## `.env.local` について

```bash
KEY_2=LAMBDASAWA_VALUE_2
```

これは開発者固有の事情で設定を上書きしたい場合に使うファイルです。  
特に上書きしたい項目が無い場合でもファイルの存在自体は必要ですが、中身は空でも問題ありません。

## `.gitignore` について

```dotenv
.env
.env.local
```

`.env` には平文のパスワードなどが、 `.env.local` には開発者固有の値が含まれるため、どちらもコミットしないようにします。

## 実行例

上記のような設定をすると最初に書いたアプリケーションの実行結果は以下のようになります。
(`direnv allow .` は実行済みの想定。)

```bash
$ node app.js
SECRET_VALUE_1 , LAMBDASAWA_VALUE_2
```

## まとめ

これによって以下が達成できました。

- アプリケーションは設定を環境変数から読むだけの単純な作りに出来る
- 一度セットアップしたら `cd` するだけで設定を切り替えられる
- パスワードを含む設定ファイルをバージョン管理できる (AWS のクレデンシャルだけは別途管理する必要がある)
- 共有したい設定と開発者ごとの設定を分けて管理できる
