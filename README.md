## 简介

因[原项目](https://github.com/maybefw/AHUT- )已好久没更新，功能异常，故自己fork修改，并加入了一些自己的功能

本版本有以下特色

1. 管理员邮箱，自动发送此次签到情况到管理员邮箱
2. 生成简约的网页界面，方便阅览
3. 获取token和签到都加入了多次重试，提高了签到成功率
4. 支持多用户，独立配置，方便维护修改



## 配置

连接上服务器之后，执行以下命令：

```
sudo apt update //在安装 Node.js 之前，先更新服务器的软件包列表
sudo apt install curl //安装curl工具
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - //安装nodejs环境
sudo apt install -y nodejs //安装nodejs
node -v
npm -v //检查node和npm版本
```

在服务器上安装axios，nodemailer和js-mail

```
npm install axios
npm install nodemailer
npm install js-yaml
```

实现在服务器上定时执行打卡脚本：

```
crontab -e //设置 cron 定时任务
20 21 * * * /usr/bin/node /root/qiandao.js >> /root/qiandao.log 2>&1
```

crontab 文件中添加，20 21 * * *: 这表示每天的 21:20 执行任务

```
cd /root
node fuwuqiqiandao.js //测试脚本
```
