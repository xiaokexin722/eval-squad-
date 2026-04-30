export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error:'只接受POST'});
  const { event, roles } = req.body;
  if (!event || !roles?.length) return res.status(400).json({error:'缺少参数'});
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return res.status(500).json({error:'服务未配置Key'});

  const system = '你是多角色评价系统。对事件按角色评价，返回JSON数组：{emoji, role, score(1-5), comment}，并额外给出综合结论字段verdict。';
  try {
    const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
      body:JSON.stringify({model:'deepseek-chat',messages:[
        {role:'system',content:system},
        {role:'user',content:`事件：${event}\n角色：${roles.map(r=>`${r.emoji} ${r.name}: ${r.prompt}`).join('\n')}`}
      ],temperature:0.9})
    });
    const data = await resp.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content.match(/\[[\s\S]*\]/)?.[0] || content);
    return res.status(200).json(parsed);
  } catch(e) {
    return res.status(500).json({error:'AI调用失败'});
  }
}
