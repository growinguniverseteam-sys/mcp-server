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
  .on('data', row => {
    if (row['피드내용']) existingFeeds.push(row['피드내용']);
  })
  .on('end', () => console.log(`Loaded ${existingFeeds.length} existing feeds`));

// POST 요청 처리
app.post('/generateFeed', async (req, res) => {
  try {
    console.log('Received request body:', JSON.stringify(req.body, null, 2));

    const { centerName, videoMeta, recentFeeds } = req.body;

    if (!centerName || !videoMeta || !recentFeeds) {
      console.warn('Missing parameters:', { centerName, videoMeta, recentFeeds });
      return res.status(400).send('Missing parameters');
    }

    const recentText = recentFeeds.length ? recentFeeds.join('\n') : '없음';

    // Messages API 구조
    const messages = [
      {
        role: 'system',
        content: `너는 헬스장 전문 인스타그램 피드 카피라이터야.
규칙:
- 한국어로 작성
- 센터 입장에서 부드럽고 친근하게
- 2~3문장
- 최근 예시와 겹치지 않게 작성
- 마지막 문장 끝에 이모지 하나
- 영상에 없는 정보 임의로 추가 금지`
      },
      {
        role: 'user',
        content: `영상 메타데이터:
${JSON.stringify(videoMeta)}

최근 피드 예시:
${recentText}`
      }
    ];

    const payload = {
      model: 'claude-haiku-4-5-20251001', // 사용 가능한 모델
      messages: messages,
      max_tokens_to_sample: 300,
      temperature: 0.7
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Claude API response:', JSON.stringify(data, null, 2));

    let feedText = '';
    // Messages API 응답 확인
    if (data?.completion?.length && data.completion[0].content) {
      feedText = data.completion[0].content.trim();
    } else if (data?.message?.content) {
      // 혹시 메시지 형태로 오는 경우
      feedText = data.message.content.trim();
    } else {
      console.warn('⚠️ Claude API returned empty feedText or error, returning fallback');
      feedText = '[피드 생성 실패]';
    }

    res.json({ feedText });
  } catch (err) {
    console.error('Error generating feed:', err);
    res.status(500).json({ feedText: '[피드 생성 실패]', error: err.message || err });
  }
});

app.listen(PORT, () => console.log(`MCP server running on port ${PORT}`));
