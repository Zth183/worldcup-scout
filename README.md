# 世界杯球探报告部署指南 (Zeabur)

## 项目结构
```
scout_website/
├── main.py              # FastAPI 后端
├── requirements.txt     # Python 依赖
├── zeabur.json          # Zeabur 配置文件
├── database.sql         # 数据库备份
└── static/
    ├── index.html       # 前端页面
    ├── style.css        # 样式
    └── app.js           # 交互逻辑
```

## 部署步骤

### 第一步：上传到 GitHub
```bash
git init
git add .
git commit -m "init scout website"
# 在 GitHub 新建仓库，然后：
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

### 第二步：在 Zeabur 部署
1. 打开 https://zeabur.com 并登录
2. 点击「New Project」→「Deploy from GitHub」
3. 选择刚上传的仓库
4. Zeabur 自动检测为 Python 项目，无需额外配置
5. 等待部署完成

### 第三步：配置数据库
1. 在 Zeabur 项目页面中，点击「Add Service」→「Database」→「MySQL」
2. 等待 MySQL 启动
3. 在 MySQL 服务的「Connect」页中，记录以下信息：
   - Host
   - Port
   - Username
   - Password
   - Database Name

### 第四步：导入数据
方法一（推荐 - 通过 Zeabur Web 终端）：
1. 在 MySQL 服务页面，点击「Web Terminal」
2. 执行：`mysql -u 用户名 -p 密码 数据库名 < database.sql`

方法二（通过本地命令行）：
```bash
# 安装 mysql 客户端
# 替换为你的 Zeabur MySQL 连接信息
mysql -h HOST -u USER -p PASSWORD DB_NAME < database.sql
```

### 第五步：设置环境变量
1. 回到 Web Service 页面
2. 点击「Environment Variables」
3. 添加以下变量：

| 变量名 | 值 |
|--------|-----|
| `DB_HOST` | 你的 MySQL Host |
| `DB_USER` | 你的 MySQL 用户名 |
| `DB_PASSWORD` | 你的 MySQL 密码 |
| `DB_PORT` | 你的 MySQL Port |
| `DB_NAME` | 你的 MySQL 数据库名 |

### 第六步：重新部署
1. 在 Zeabur 项目页面，点击「Redeploy」
2. 等待部署完成，Zeabur 会提供一个 `*.zeabur.app` 域名

## 本地开发
```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
