// mcp-server/index.js
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import { parse } from 'csv-parse';
import fetch from 'node-fetch';   // <= 이거 추가하는 걸 추천!

const app = express();
app.use(express.json());

const PORT = 8080;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const FEED_CSV_PATH = './feed_content.csv';

// CSV 읽어서 기존 피드 로딩
let existingFeeds = [];

fs.createReadStream(FEED_CSV_PATH)
  .pipe(parse({ columns: true }))
  .on('data', (row) => {
    if (row['피드내용']) existingFeeds.push(row['피드내용']);
  })
  .on('end', () => {
    console.log(`Loaded ${existingFeeds.length} existing feeds`);
  });

// GAS에서 POST 요청 보내면 처리
app.post('/generateFeed', async (req, res) => {
  try {
    console.log('Received request body:', req.body);  // ← 추가

    const { centerName, videoMeta, recentFeeds } = req.body;

    // 필수값 체크
    if (!centerName || !videoMeta || !recentFeeds) {
      console.log('Missing parameters:', { centerName, videoMeta, recentFeeds }); // ← 추가
      return res.status(400).send('Missing parameters');
    }

    // Claude 프롬프트 구성
    const prompt = `
너는 헬스장 전문 인스타그램 피드 카피라이터야.
규칙:
- 한국어로 작성
- 센터 입장에서 부드럽고 친근하게
- 2~3문장
- 최근 예시와 표현이 겹치지 않게 작성
- 마지막 문장 끝에 이모지 하나
- 영상에 없는 정보 임의로 추가 금지

메타데이터:
${JSON.stringify(videoMeta)}

최근 피드 예시 (중복 피드 방지):
${recentFeeds.join('\n')}
`;

    const payload = {
      model: 'claude-2',
      messages: [
        { role: 'system', content: '헬스장 인스타 피드 작성 전문가' },
        { role: 'user', content: prompt }
      ],
      max_tokens_to_sample: 300,
      temperature: 0.7
    };

    const response = await fetch('https://api.anthropic.com/v1/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const feedText = data?.completion?.trim() || '';
    res.json({ feedText });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating feed');
  }
});

app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});
