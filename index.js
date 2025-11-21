// server.js (또는 generateFeed.js)
import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const CLAUDE_VERSION = '20251001';

app.post('/generateFeed', async (req, res) => {
  try {
    const { centerName, videoMeta, recentFeeds } = req.body;
    if (!centerName || !videoMeta) {
      return res.status(400).json({ error: 'centerName과 videoMeta 필수' });
    }

    // GAS에서 전달받은 데이터로 프롬프트 구성
    const prompt = `
센터명: ${centerName}
영상 정보: ${videoMeta.fileName} (${videoMeta.videoDesc})
최근 피드: ${recentFeeds.join(' | ')}

위 정보를 참고해서 인스타그램용 피드 문구를 1개 생성해줘.
`;

    // Claude API 호출
    const claudeRes = await fetch('https://api.anthropic.com/v1/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': CLAUDE_VERSION
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        prompt: prompt,
        max_tokens_to_sample: 300
      })
    });

    if (!claudeRes.ok) {
      const text = await claudeRes.text();
      throw new Error(`Claude 호출 실패: ${claudeRes.status} ${text}`);
    }

    const claudeData = await claudeRes.json();
    const feedText = claudeData.completion || '';

    return res.json({ feedText });
  } catch (err) {
    console.error('generateFeed 오류:', err);
    return res.status(500).json({ error: err.message || '서버 오류' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`MCP 서버 실행 중: http://localhost:${PORT}`);
});
