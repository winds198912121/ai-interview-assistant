# 别的电脑上复现（AI Interview & Meeting Assistant）

需要：Node.js 20+、macOS（打包 .dmg 用；开发模式其他系统也可）

```bash
git clone https://github.com/winds198912121/ai-interview-assistant.git
cd ai-interview-assistant
npm install
npm run dev        # 开发模式
npm run package    # 打包 macOS .dmg（输出到 dist/）
```

AI 服务的 API Key 在应用的设置界面里填写，没有写进仓库。
设计书见 README.md 里附的《AI_Interview_Assistant_設計書》。
