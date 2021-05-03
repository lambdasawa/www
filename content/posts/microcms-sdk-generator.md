---
title: "microCMS の API クライアントを生成するツールを作った"
date: 2021-05-03T20:00:00+09:00
tags:
  - misc
---

## 前提

そもそも [microCMS](https://microcms.io/) が何かというと Headless CMS と呼ばれるものの一種です。
[Contentful](https://www.contentful.com/) や [strapi](https://strapi.io/) を知っている方はそれと同じようなものと考えていただいて差し支えありません。
これらを知らない方向けに簡単に説明すると、あるサービス上で GUI を使ってデータのスキーマを定義するとそれに対応した管理画面と REST API が生成されるものです。

例えば `microCMS` 上で以下のようなスキーマを定義したとします。

![schema](/images/posts/microcms-sdk-generator/schema.png)

その後、以下のようにデータを入稿したとします。

![testdata](/images/posts/microcms-sdk-generator/testdata.png)

こうするとエンジニアがサーバを管理せずとも以下のように REST API にアクセスすることができます。

```typescript
fetch('https://example.microcms.io/api/v1/users', {
  headers: {
    'x-api-key': 'xxxx'
  },
})
  .then(res => res.json())
  .then(res => console.log(res));
```

通信が完了すると以下のような値がログに出力されます。

```json
{
  "contents": [
    {
      "id": "kr8sq-sxwg",
      "name": "lambdasawa",
      "createdAt": "2021-05-03T07:53:47.448Z",
      "updatedAt": "2021-05-03T08:27:43.735Z",
      "publishedAt": "2021-05-03T07:53:47.448Z",
      "revisedAt": "2021-05-03T08:27:43.735Z"
    }
  ],
  "limit": 10,
  "offset": 0,
  "totalCount": 1
}
```

同様に参照だけではなく CRUD 全ての操作が行えるようになります。
例えば以下のようなコードを実行することで新規作成を行うことが出来ます。

```typescript
const data = {
  name: 'your name',
};

fetch('https://example.microcms.io/api/v1/users', {
  method: 'POST',
  headers: {
    'x-write-api-key': 'xxxx',
    'content-type': 'application/json',
  },
  body: JSON.stringify(data)
})
  .then(res => res.json())
  .then(res => console.log(res));
```

とても便利ですね。
しかしこのようなコードを静的型付け言語で扱うとしたら、以下のようにリクエスト/レスポンスの型を定義したいですよね。

```typescript
type UserCreateRequest = {
  name: string;
}

type UserCreateResponse = {
  contents: User[],
  limit: number,
  offset: number,
  totalCount: number,
}

type User = {
  id: string,
  name: string,
  createdAt: Date,
  updatedAt: Date,
  publishedAt: Date,
  revisedAt: Date,
}

const data: UserCreateRequest = {
  name: 'your name',
};

fetch('https://example.microcms.io/api/v1/users', {
  method: 'POST',
  headers: {
    'x-write-api-key': 'xxxx',
    'content-type': 'application/json',
  },
  body: JSON.stringify(data)
})
  .then(res => res.json())
  .then(res => {
    return {
      contents: res.contents.map(user => {
        return {
          id: user.id,
          name: user.name,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(user.updatedAt),
          publishedAt: new Date(user.publishedAt),
          revisedAt: new Date(user.revisedAt),
        };
      }),
      limit: res.limit,
      offset: res.offset,
      totalCount: res.totalCount,
    } as UserCreateResponse;
  })
  .then(res => console.log(res));
```

途端に退屈なコードが沢山必要になりました。
しかし、これを行わないとこのデータを `any` などの型で扱う必要性があり、それを参照したときにエラーが発生する可能性が大きくなります。
このようなコードを書くのは退屈ですし、 typo などによってこれまた面白くないエラーに遭遇することになります。

静的型付けによるメリットは享受したいですが、このような作業は行いたくないです。

この問題を解決するために [`microcms-sdk-generator`](https://github.com/lambdasawa/microcms-sdk-generator) というこのようなボイラープレートのコードを生成するツールを実装しました。

## 仕組み

`microCMS` には GUI で定義したスキーマを JSON ファイルとして[エクスポート](https://blog.microcms.io/api-fields-export-and-import)する機能があります。

また、 [OpenAPI Generator](https://openapi-generator.tech/) というツールを使うと OpenAPI 形式の YAML ([公式の例](https://github.com/OAI/OpenAPI-Specification/blob/main/examples/v2.0/yaml/petstore.yaml))
 から API クライアントを生成することができます。

今回はこの2つのグルーコードを用意することによってこの問題を解決しました。

つまり、 `microCMS` からエクスポートされた JSON 形式のスキーマを OpenAPI の仕様に則った YAML 形式のファイルに変換した後、 OpenAPI Generator を実行することで API クライアントを生成します。

実際はもう少しだけ複雑です。

`microCMS` からエクスポートされたスキーマにはあるフィールドが他のスキーマに依存していることは定義されているものの具体的にどのスキーマに依存しているか分からなかったり、 その API の設定 (リスト形式かオブジェクト形式か) の情報が含まれていなかったり、この実装を行うには情報が不十分です。
そのため事前にプログラマが `metadata.yml` という設定ファイルを生成するときに作成し、実行時に `microcms-sdk-generator` がこれらの情報を読み取ることでこのギャップを補っています。

このような仕組みにすることで多少のクライアントコードの使い勝手を犠牲にすることによって、少ないメンテコストで様々な言語/ライブラリのクライアントを生成することができます。
様々というのは具体的にいうと OpenAPI Generator が対応しているジェネレータの数と等しいため、 50 以上の言語/ライブラリに対応していることになります。

今回実装に使った言語は Go であり、OpenAPI Generator は Java で実装されているため、利用者がその両方の実行環境を用意しなくて済むように Docker Hub でイメージを公開してあります。

利用方法に関しては [README](https://github.com/lambdasawa/microcms-sdk-generator/blob/main/README.ja.md) を参照してください。
要はスキーマをエクスポートして、設定ファイルを書いて、 `docker run` を実行するだけです。
将来的に `microCMS` からエクスポートされたスキーマに情報が追加されれば設定ファイルを書く必要は無くなるかもしれません。

## どんなものが生成されるか

生成されるものを紹介する前に、その入力となるものを紹介します。

まず今回扱う例はブログサービスを想定します。
ブログ記事を表す `articles` オブジェクト、 その記事を書く人を表す `users` オブジェクト、 その他の雑多な設定値などを表す `setting` オブジェクトが `microCMS` 上で定義されているとします。
これらをエクスポートした結果が https://github.com/lambdasawa/microcms-sdk-generator/tree/main/examples/typescript-fetch/microcms/schemas となります。

これらに対する設定ファイルが https://github.com/lambdasawa/microcms-sdk-generator/blob/main/examples/typescript-fetch/microcms/metadata.yml となります。

これらのファイルがローカルにある状態で以下のようなコマンドを実行すると `${PWD}/microcms` ディレクトリ以下に OpenAPI の YAML と TypeScript + `fetch` で書かれたソースコードが生成されます。
`fetch` ではなく `Axios` を使いたい場合はそのようなジェネレータもあるため、 `generator-name` オプションを変更してください。

```sh
docker run \
  --rm \
  --pull always \
  --volume ${PWD}/microcms/:/app/microcms/ \
  --env METADATA_PATH=/app/microcms/metadata.yml \
  --env OPENAPI_PATH=/app/microcms/openapi.yml \
  --env OUTPUT_PATH=/app/microcms/ \
  lambdasawa/microcms-sdk-generator:latest \
  --generator-name typescript-fetch \
  --additional-properties=typescriptThreePlus=true,allowUnicodeIdentifiers=true
```

このコマンドで生成されたソースコードを利用する側のコードは以下のようになります。

```typescript
const api = new UsersApi({
  apiKey: 'xxxx',
});

api
  .searchUsers({ q: 'lambdasawa' })
  .then(res => console.log(res));
```

データ新規作成時は以下のようになります。

```typescript
const api = new UsersApi({
  apiKey: (name) => name === 'X-Write-API-Key' ? 'xxxx-write-key-xxxx' : 'xxxx-read-key-xxxx'
});

api
  .createUsers({
    usersCreateRequest: {
      name: 'hoge',
    },
  })
  .then(res => console.log(res));
```

`searchUsers`, `createUsers` メソッドの引数は静的に型付けされています。
フィールド名の typo があった場合はコンパイル時に検出されますし、 IDE の補完機能を頼ってコードを書くことが出来ます。

これはフィールド名に限らず、例えば `microCMS` 上でセレクトフィールドとして定義されたフィールドは各プログラミング言語上で enum として出力されるため、セレクトフィールドに存在しないフィールドを送信してしまうようなミスも防ぐことが出来ます。

## 今後

スキーマやフィールドが少ないうちはこういうサードパーティの仕組みを使うより、公式のリファレンスに書いてある素朴な方法に従うほうがお得だと思います。
しかしデータが複雑になればなるほどこのようなツールを利用してつまらないミスを減らすことによって生産性を上げることができると思います。
まだプロダクションコードでは利用していないので、機会があればいずれ導入してみたいと思っています。

まだフリープランで使える範囲の機能しか実装していないため、自分が困るか donation 的なものがあれば有償の機能に対するサポートも追加していこうかなと思っています。

将来的には `microCMS` のオフィシャルでこのような機能が実装され、このツールの必要性が無くなることを願っています。
