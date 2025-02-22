const axios = require("axios");
const nodemailer = require("nodemailer"); //发送邮箱
const crypto = require("crypto"); // 引入 crypto 模块用于 MD5 加密
const yaml = require('js-yaml');
const fs = require('fs');

  const fileContents = fs.readFileSync('./config.yaml', 'utf8');
  const config = yaml.load(fileContents);

  // 解析后的数据
  const dormLocations = config.dormLocations;
  const users = config.users;

// MD5 加密函数
const md5Encrypt = (password) => {
  return crypto.createHash("md5").update(password).digest("hex");
};

const MAX_RETRY_COUNT = 2; // 设置最大重试次数
// 获取Token的函数
const getToken = async (username, password) => {
  try {
    const encryptedPassword = md5Encrypt(password); // 对密码进行 MD5 加密
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

    const data = response.data;
    if (response.status === 200) {
      console.log(`${username} 登录成功`); // 获取到的 Token
      return data.access_token;
    } else {
      console.error(`${username} 登录失败:`, data);
      return null;
    }
  } catch (error) {
    console.error(`${username} 请求失败:`, error);
    return null;
  }
};

// 获取当前时间，格式化为 HH:MM:SS
const getCurrentTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};
// 获取当前日期，格式化为 YYYY-MM-DD
const getCurrentDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // 月份从 0 开始
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// 获取当前星期几
const getCurrentWeekday = () => {
  const days = [
    "星期日",
    "星期一",
    "星期二",
    "星期三",
    "星期四",
    "星期五",
    "星期六",
  ];
  const now = new Date();
  const day = now.getDay(); // 获取星期几（0-6，0为星期日）
  return days[day];
};

// 发送邮件的函数
const sendEmail = async (to, subject, text) => {
  // 新增邮箱校验，若右键填空则不返回
  if (!to) return;

  let transporter = nodemailer.createTransport({
    service: config.email.service,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  let mailOptions = {
    from: config.email.from,
    to: to,
    subject: subject,
    text: text,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`邮件发送成功: ${to}`);
  } catch (error) {
    console.error(`邮件发送失败: ${error.message}`);
  }
};


// 生成动态经纬度的函数，微调最后两位小数
const getDynamicLocation = (lat, lng) => {
  // 生成随机数，微调最后两位小数
  const randomOffset = () => Math.random() * 0.01 - 0.005;
  const newLat = (lat + randomOffset()).toFixed(6);
  const newLng = (lng + randomOffset()).toFixed(6);
  return { lat: newLat, lng: newLng };
};

// 签到函数，动态传入宿舍坐标
const signIn = async (token, user, retryCount = 0) => {
  if (!token) {
    console.error(`${user.username} 的 Token 未获取到，无法进行签到`);
    return;
  }

// 加密函数
  function md5(buffer) {
      return crypto.createHash('md5').update(buffer).digest('hex');
  }

// 获取签名
const log_url = '/api/flySource-yxgl/dormSignRecord/add?sign=';
const token_10 = token.slice(0, 10);
const time = Date.now(); 
const first_md5 =md5(time+token_10);
const second_md5 = md5(log_url + first_md5);
const base64 = btoa(time); 
const signature = `${second_md5}1.${base64}`;

//获取信息
  const currentDate = getCurrentDate(); // 获取当前日期
  const currentTime = getCurrentTime(); // 获取当前时间
  const currentWeekday = getCurrentWeekday(); // 获取当前星期几
  const dormLocation = dormLocations[user.dorm]; // 获取用户宿舍的经纬度坐标
  if (!dormLocation) {
    console.error(`未找到宿舍: ${user.dorm} 的位置信息`);
    return;
  }

  // 生成动态的签到位置
  const dynamicLocation = getDynamicLocation(
    dormLocation.lat,
    dormLocation.lng
  );

  const payload = {
    taskId: "766e47d0401a47016f41278e73b10f82",
    signAddress: "宿舍楼",
    locationAccuracy: 7.8,
    signLat: dynamicLocation.lat,
    signLng: dynamicLocation.lng,
    signType: 0,
    fileId: "",
    imgBase64: "/static/images/dormitory/photo.png",
    signDate: currentDate, // 使用当前日期
    signTime: currentTime, // 使用当前时间
    signWeek: currentWeekday, // 使用当前星期几
    scanCode: "",
    roomId: user.roomId,
  };


  try {
    const response = await axios.post(
      "https://xskq.ahut.edu.cn/api/flySource-yxgl/dormSignRecord/add",
      payload,
      {
        headers: {
          "FlySource-Auth": `bearer ${token}`,
          "Content-Type": "application/json;charset=UTF-8",
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ',
          "FlySource-sign": signature,
        },
      }
    );
    
    const data = response.data;
    if (response.status === 200) {
      console.log(`${user.username} 签到成功`);
      await sendEmail(
        user.email,
        "打卡成功",
        `${user.username} 打卡成功: ${data.msg} 时间：${currentDate} ${currentTime}`
      );
    } else {
      console.error(`${user.username} 签到失败:`, response.data);
      // 如果签到失败，重试机制
      if (retryCount < MAX_RETRY_COUNT) {
        console.log(`${user.username} 正在进行第 ${retryCount + 1} 次重试...`);
        await signIn(token, user, retryCount + 1); // 递归重试
      } else {
        console.error(`${user.username} 签到失败，达到最大重试次数`);
        await sendEmail(
          user.email,
          "打卡失败",
          `${user.username} 打卡失败: ${data.msg}`
        );
      }
    }
  } catch (error) {
    console.error(`${user.username} 请求失败:, error`);
    if (retryCount < MAX_RETRY_COUNT) {
      console.log(`${user.username} 正在进行重试，第 ${retryCount + 1} 次重试`);
      await signIn(token, user, retryCount + 1); // 重新签到
    } else {
      console.log(`${user.username} 达到最大重试次数，签到失败`);
      await sendEmail(
        user.email,
        "请求失败",
        `${user.username} 请求失败: ${error.message}`
      );
    }
  }
};

const signInAllUsers = async () => {
  for (const user of users) {
    const token = await getToken(user.username, user.password); // 获取 Token
    if (token) {
      await signIn(token, user); // 签到
    }
  }
};

// 执行签到
signInAllUsers();