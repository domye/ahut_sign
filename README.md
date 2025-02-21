## 更改自原项目

- 链接：https://github.com/maybefw/AHUT-
- 因原项目已好久没更新，功能异常，故自己修改了一下，使其能正常签到
- 仅自用备份

## 2025.2.21

- 增加请求体roomId，因是固定不变的，所以采取手动抓取填入的方式
- 配置文件加入roomId

## 2025.2.20

- 更改签到逻辑，多用户同时发送签到请求，提升签到速度
- 防止服务器拉黑请求，一批用户完成签到后会延迟两秒后再进行下一次签到

##  2025.2.19

- 用户信息从外部yaml文件配置，将js文件和yaml文件放在同一文件夹即可
- 头文件增加 `User-Agent` 和 `FlySource-sign`，使其能正常签到

- 邮箱增加验证，若为空则不调用



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

在服务器上安装axios和nodemailer库

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
