const axios = require("axios");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
// 读取配置文件
const user = yaml.load(
	fs.readFileSync(path.join(__dirname, "user.yaml"), "utf8")
);
const dorm = yaml.load(
	fs.readFileSync(path.join(__dirname, "dorm.yaml"), "utf8")
);
const mail = yaml.load(
	fs.readFileSync(path.join(__dirname, "mail.yaml"), "utf8")
);

// 解析后的数据
const dormLocations = dorm.dormLocations;
const users = user.users;

const MAX_RETRY_COUNT = 2;

// MD5 加密函数
const md5Encrypt = (password) => {
	return crypto.createHash("md5").update(password).digest("hex");
};

// 获取Token的函数，增加重试逻辑
const getToken = async (username, password, retryCount = 0) => {
	if (retryCount >= 3) {
		console.error(`${username} 登录失败: 已达到最大重试次数`);
		return null;
	}

	try {
		const encryptedPassword = md5Encrypt(password);
		const response = await axios.post(
			"https://xskq.ahut.edu.cn/api/flySource-auth/oauth/token",
			new URLSearchParams({
				tenantId: "000000",
				username: username,
				password: encryptedPassword,
				type: "account",
				grant_type: "password",
				scope: "all",
			}),
			{
				headers: {
					Authorization:
						"Basic Zmx5c291cmNlX3dpc2VfYXBwOkRBNzg4YXNkVURqbmFzZF9mbHlzb3VyY2VfZHNkYWREQUlVaXV3cWU=",
					"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
				},
			}
		);
		return response.data.access_token;
	} catch (error) {
		console.error(`${username} 登录失败: ${error.message}`);
		return getToken(username, password, retryCount + 1);
	}
};

// 工具函数：获取当前时间和日期
const getCurrentTime = () =>
	new Date().toLocaleTimeString("en-US", { hour12: false });
const getCurrentDate = () => new Date().toISOString().split("T")[0];
const getCurrentWeekday = () =>
	["日", "一", "二", "三", "四", "五", "六"][new Date().getDay()];

// 邮件发送器
const transporter = nodemailer.createTransport({
	service: mail.email.service,
	auth: { user: mail.email.user, pass: mail.email.pass },
});

// 生成动态位置
const getDynamicLocation = (lat, lng) => ({
	lat: (parseFloat(lat) + (Math.random() * 0.01 - 0.005)).toFixed(6),
	lng: (parseFloat(lng) + (Math.random() * 0.01 - 0.005)).toFixed(6),
});

// 签到函数（带重试逻辑）
const signIn = async (token, user) => {
	const result = { username: user.username, success: false, attempts: [] };

	for (let retry = 0; retry <= MAX_RETRY_COUNT; retry++) {
		try {
			const signature = generateSignature(token);
			const dormLocation = dormLocations[user.dorm];
			if (!dormLocation) {
				result.attempts.push(`未找到宿舍位置: ${user.dorm}`);
				break;
			}

			const { lat, lng } = getDynamicLocation(
				dormLocation.lat,
				dormLocation.lng
			);
			const payload = createPayload(user, lat, lng);

			try {
				let sign = "2910bccaf179bd40dfa446dc2dec3e721.MTc0NzEyODU3MDI1Ng==";
				let url =
					"https://xskq.ahut.edu.cn/api/flySource-base/wechat/getWechatMpConfig?configUrl=https%253A%252F%252Fxskq.ahut.edu.cn%252Fwise%252Fpages%252Fssgl%252Fdormsign%253FtaskId%253D766e47d0401a47016f41278e73b10f82%2526autoSign%253D1%2526scanSign%253D0%2526userId%253D" +
					user.username;

				let headers2 = {
					"User-Agent":
						"Mozilla/5.0 (Linux; Android 14; 22011211C Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/134.0.6998.136 Mobile Safari/537.36 XWEB/1340075 MMWEBSDK/20250201 MMWEBID/3995 MicroMessenger/8.0.58.2841(0x28003A3A) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64",
					"flysource-sign": sign,
					authorization:
						"Basic Zmx5c291cmNlX3dpc2VfYXBwOkRBNzg4YXNkVURqbmFzZF9mbHlzb3VyY2VfZHNkYWREQUlVaXV3cWU=",
					"flysource-auth": "bearer " + token,
					referer: `https://xskq.ahut.edu.cn/wise/pages/ssgl/dormsign?taskId=766e47d0401a47016f41278e73b10f82&autoSign=1&scanSign=0&userId=${user.username}`,
				};

				let response = await axios.get(url, { headers: headers2 });
				if (response.data.code === 200) {
					console.log(`${user.username}:鉴权成功`);
				}
			} catch (error) {
				// 处理错误
				console.error("请求出错: ", error);
			}

			const response = await axios.post(
				"https://xskq.ahut.edu.cn/api/flySource-yxgl/dormSignRecord/add",
				payload,
				{ headers: createHeaders(token, signature) }
			);

			if (response.status === 200) {
				result.success = true;
				console.log(`${user.username}:签到成功`);
				result.attempts.push(`${response.data.msg}`);
				return result;
			}

			result.attempts.push(`${response.data.msg}`);
		} catch (error) {
			result.attempts.push(`${error.message}`);
		}
	}

	return result;
};

// 签名生成函数
const generateSignature = (token) => {
	const md5 = (str) => crypto.createHash("md5").update(str).digest("hex");
	const timestamp = Date.now();
	return `${md5(
		`/api/flySource-yxgl/dormSignRecord/add?sign=${md5(
			timestamp + token.slice(0, 10)
		)}`
	)}1.${btoa(timestamp)}`;
};

// 创建请求头
const createHeaders = (token, signature) => ({
	"FlySource-Auth": `bearer ${token}`,
	"Content-Type": "application/json;charset=UTF-8",
	"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
	"FlySource-sign": signature,
});

// 创建负载数据
const createPayload = (user, lat, lng) => ({
	taskId: "766e47d0401a47016f41278e73b10f82",
	signAddress: "宿舍楼",
	locationAccuracy: 7.8,
	signLat: lat,
	signLng: lng,
	signType: 0,
	fileId: "",
	imgBase64: "/static/images/dormitory/photo.png",
	signDate: getCurrentDate(),
	signTime: getCurrentTime(),
	signWeek: "星期" + getCurrentWeekday(),
	scanCode: "",
	roomId: user.roomId,
});

// 主执行函数
const main = async () => {
	const results = [];

	for (const user of users) {
		const startTime = Date.now();
		let token;

		try {
			token = await getToken(user.username, user.password);
			if (!token) {
				results.push({
					user,
					success: false,
					message: "获取Token失败",
					duration: Date.now() - startTime,
				});
				continue;
			}

			const signResult = await signIn(token, user);
			results.push({
				user,
				success: signResult.success,
				message: signResult.attempts.join("\n"),
				duration: Date.now() - startTime,
			});
		} catch (error) {
			results.push({
				user,
				success: false,
				message: error.message,
				duration: Date.now() - startTime,
			});
		}
	}

	await sendSummaryEmail(results);
};

// 发送汇总邮件
const sendSummaryEmail = async (results) => {
	const successCount = results.filter((r) => r.success).length;
	const failureCount = results.length - successCount;
	const reportTime = new Date().toLocaleString("zh-CN", { hour12: false });
	const mailContent = `
  <meta charset="UTF-8">
    <style>
      .summary {
        background: #f8f9fa;
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 30px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .user-card {
        padding: 15px;
        margin: 10px 0;
        border-left: 4px solid;
        border-radius: 4px;
        background: white;
        transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .user-card:hover {
        transform: translateX(5px);
      }
      .success { border-color: #28a745; }
      .error { border-color: #dc3545; }
      pre {
        white-space: pre-wrap;
        background: #f8f9fa;
        padding: 10px;
        border-radius: 4px;
        margin-top: 10px;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      }
      details {
        margin-top: 10px;
      }
      summary {
        cursor: pointer;
        color: #007bff;
        font-weight: 500;
      }
      h3 {
        margin: 0 0 8px 0;
        color: #343a40;
      }
    </style>

    <div class="summary">
      <h2 style="margin-top: 0; color: #2c3e50;">📝 宿舍签到汇总报告</h2>
      <p>👥 总人数: ${results.length}</p>
      <p style="color: #28a745;">✅ 成功: ${successCount}</p>
      <p style="color: ${
				failureCount > 0 ? "#dc3545" : "#28a745"
			};">❌ 失败: ${failureCount}</p>
      <p>📅 报告生成时间: ${reportTime}</p>
    </div>

    ${results
			.map(
				(r) => `
      <div class="user-card ${r.success ? "success" : "error"}">
        <h3>${r.user.username} ${r.success ? "✅" : "❌"}</h3>
        <p>⏱ 耗时: ${r.duration}ms</p>
        <details>
          <summary>${r.success ? "查看详情" : "查看错误日志"}</summary>
          <pre>${r.message.replace(/\n/g, "<br>")}</pre>
        </details>
      </div>
    `
			)
			.join("")}
  `;
	const tempHtmlPath = path.join(__dirname, "index.html");
	fs.writeFileSync(tempHtmlPath, mailContent);
	await transporter.sendMail({
		from: mail.email.from,
		to: mail.email.admin,
		subject: `${
			failureCount > 0 ? "⚠️" : "✅"
		} 签到结果: 成功${successCount}人，失败${failureCount}人`,
		html: mailContent,
	});
};

// 执行主程序
main().catch((error) => console.error("全局错误:", error));
