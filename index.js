// mcp-server/index.js
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import { parse } from 'csv-parse';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
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

// 안전하게 feed 생성
app.post('/generateFeed', async (req, res) => {
  try {
    console.log('Received request body:', req.body);

    const { centerName, videoMeta, recentFeeds } = req.body;

    if (!centerName || !videoMeta || !recentFeeds) {
      console.log('Missing parameters:', { centerName, videoMeta, recentFeeds });
      return res.status(400).send('Missing parameters');
    }

    // recentFeeds가 비어있으면 '없음' 처리
    const recentText = recentFeeds.length ? recentFeeds.join('\n') : '없음';

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
${recentText}
`;

    // 요청 payload 확인용 로그
    console.log('Prompt to Claude API:', prompt);

    const payload = {
      model: 'claude-2',
      prompt: prompt,
      max_tokens_to_sample: 300,
      temperature: 0.7
    };

    const response = await fetch('https://api.anthropic.com/v1/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Claude API response:', JSON.stringify(data));

    let feedText = '';
    if (data?.completion) feedText = data.completion.trim();
    else {
      console.warn('⚠️ Claude API returned empty feedText or error');
      feedText = '[피드 생성 실패]';
    }

    res.json({ feedText });

  } catch (err) {
    console.error('Error in /generateFeed:', err);
    res.status(500).send('Error generating feed');
  }
});

app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});
