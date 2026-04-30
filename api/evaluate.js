export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: '只接受POST请求' });

  const { event, roles } = req.body;
  if (!event || !roles?.length) return res.status(400).json({ error: '请提供事件和至少一个角色' });

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({ error: '服务端未配置API密钥' });

  const system = `你是一个多角色评价系统。用户会给你一个“事件”和多个“角色”（每个角色有人设、语言风格）。你需要：
1. 严格为每个角色给出一个评分（1-5的整数）和一句符合其人设的评语。
2. 最后计算平均分（保留一位小数），并写一段幽默、有洞察力的“综合结论”（50字左右），总结各方观点。
返回格式必须是严格的JSON，结构为：
{
  "evaluations": [
    { "emoji": "💼", "role": "社会精英", "score": 3, "comment": "..." },
    ...
  ],
  "verdict": "综合评分X星。……"
}
不要输出任何JSON以外的内容。`;

  const userMessage = `事件：${event}\n参与评价的角色：${roles.map(r => `${r.emoji} ${r.name} (人设：${r.prompt})`).join('\n')}`;

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-v3',  // 换成了最简单的模型代号
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.9,
        max_tokens: 1500
      })
    });

    // 如果硅基流动直接报错，就把错误原文显示出来
    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `硅基流动报错 (${response.status}): ${errText}` });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

    // 解析AI返回的JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
      else throw new Error('返回格式异常');
    }

    const evaluations = parsed.evaluations || [];
    const verdict = parsed.verdict || '';
    if (evaluations.length > 0) {
      evaluations[0].verdict = verdict;
    }

    return res.status(200).json(evaluations);
  } catch (error) {
    return res.status(500).json({ error: 'AI调用失败：' + error.message });
  }
}