---
draft: false
date: 2021-06-21T04:37:45+09:00
title: "Google Authenticator的なやつをGoで実装した"
description: ""
slug: ""
authors: []
tags: []
categories: []
externalLink: ""
series: []
---

ふとMFAの仕組みがどうなっているのか気になったので暇な時間に調べてみたところ、割とシンプルな仕組みだったので標準ライブラリだけで実装してみた。  
ひと口にMFAといってもさまざまな方式があるが、6桁の数字が30秒ごとに切り替わるアレのことを扱う。

コードは[Gist](https://gist.github.com/lambdasawa/5ecf05b00b55abc26d65e5b836184ee5)にアップロードした。  
この実装はCLIのアプリケーションとして実際に使用可能で、これを使ってたとえばTwitterにログインできる。

この記事ではその仕組みについて簡単にまとめる。

## 仕組みの概要

- 事前に鍵を共有する
  - よくあるのはQRコードの読み取り
  - [あるいはBase32エンコードされた文字列として取り扱う](https://gist.github.com/lambdasawa/5ecf05b00b55abc26d65e5b836184ee5#file-main-go-L17)
    - これはサイトによるが、2段階認証のセットアップ時にQRコードが表示される画面で「QRコードが読み取れない場合はこちら」みたいなリンクを踏むと表示される
- [定期的に切り替わる値として、 `unix timestamp % 30` を扱う](https://gist.github.com/lambdasawa/5ecf05b00b55abc26d65e5b836184ee5#file-main-go-L46)
- [前述の鍵と定期的に切り替わる値を入力としてHMAC-SHA1を使用し160bitのバイト列を取得する](https://gist.github.com/lambdasawa/5ecf05b00b55abc26d65e5b836184ee5#file-main-go-L64)
- このバイト列からいい感じに6桁の10進数を取得する
  - [まず末尾4bitを10進数として読み取る](https://gist.github.com/lambdasawa/5ecf05b00b55abc26d65e5b836184ee5#file-main-go-L66) (0~15)
  - [160bitのバイト列からいい感じに32bit読み取って数値として解釈する](https://gist.github.com/lambdasawa/5ecf05b00b55abc26d65e5b836184ee5#file-main-go-L68)
    - 開始位置は前述の末尾4bitの10進数を読み取った値（0~15バイトから読み取り）
    - 終了位置は開始位置+32bit（4~19バイトまで読み取る）
    - 上位1bitは無視する
    - この32bitをビッグエンディアンの符号無し整数として解釈する
  - [この数値の下6桁を読む](https://gist.github.com/lambdasawa/5ecf05b00b55abc26d65e5b836184ee5#file-main-go-L70)

これで30秒ごとに切り替わる6桁の数値が取れる。  
クライアントはこれを表示し、サーバはクライアントから受け取った値と自分で計算した値を比較して認証を行う。

## 仕様

- [TOTP: Time-Based One-Time Password Algorithm](https://datatracker.ietf.org/doc/html/rfc6238)
- [HOTP: An HMAC-Based One-Time Password Algorithm](https://datatracker.ietf.org/doc/html/rfc4226)

スペックではないが、 QRコードで表されるカスタムURLスキームのフォーマットに関しては[Google AuthenticatorのGitHub Wiki](https://github.com/google/google-authenticator/wiki/Key-Uri-Format) がデファクトスタンダードとして参照されているようである。
