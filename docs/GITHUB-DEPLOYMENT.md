# GitHub 上线进度

本项目包含服务端 API、D1 数据库和 R2 照片存储，不能直接作为 GitHub Pages 静态网站发布。

## 已准备

- 完整界面与 API 源码。
- drizzle/ 下 0000–0004 的数据库迁移。
- 用户指定字体随 public/fonts/happy-home.ttf 打包。
- .github/workflows/build.yml：提交后执行依赖安装、TypeScript 检查和生产构建；它只验证构建，不会部署。
- .gitignore 排除本机数据、依赖、环境变量与构建产物。

## 完整上线还需

1. 用户指定 GitHub 仓库，保留其已有文件与提交历史。
2. 确认运行后端的平台和账号。现有项目基于 Cloudflare Workers、D1、R2，使用 Cloudflare 可保留数据层结构。
3. 为独立托管适配登录：app/chatgpt-auth.ts 当前读取 Sites 注入的身份信息，不能直接在公网信任客户端同名请求头。独立托管必须验证会话或身份提供方签名，不能仅把该头当成登录依据。
4. 创建真实数据库与照片桶，配置绑定，执行数据库迁移，部署应用。
5. 使用两位独立成员验证登录、固定座位、状态同步、照片访问、菜单和审批，再交付公网地址。

不能把本地预览的模拟身份或本机数据库打包上线；新线上数据库需要成员重新登录选座。

参考：
- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://developers.cloudflare.com/workers/ci-cd/builds/
