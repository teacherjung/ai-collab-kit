'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { unwrapScanOutput, LaunchError } = require('../tools/review-launch.js');

test('Grok NDJSON 嚴格解析回歸（純函式題）', async (t) => {
  const sid = 's1';
  const validAssistant = {
    type: 'assistant',
    session_id: sid,
    parent_tool_use_id: null,
    message: {
      role: 'assistant',
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'FINAL' }]
    }
  };
  const validResult = {
    type: 'result',
    session_id: sid,
    subtype: 'success',
    is_error: false,
    stop_reason: 'end_turn',
    result: 'FINAL'
  };
  const validFrames = [
    JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
    JSON.stringify(validAssistant),
    JSON.stringify(validResult)
  ];

  await t.test('正常樣本：解出 FINAL', () => {
    assert.equal(unwrapScanOutput(validFrames.join('\n')), 'FINAL');
  });

  await t.test('1: 空格 JSON 且 cancelled', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }).replaceAll(':', ': '),
      JSON.stringify(validAssistant).replaceAll(':', ': '),
      JSON.stringify({ ...validResult, stop_reason: 'cancelled' }).replaceAll(':', ': ')
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應偵測出空格 JSON 並按嚴格模式拒絕 cancelled');
  });

  await t.test('2: end_turn 後多出 tool_use assistant', () => {
    const lateTool = {
      type: 'assistant',
      session_id: sid,
      parent_tool_use_id: null,
      message: {
        role: 'assistant',
        stop_reason: 'tool_use',
        content: [{ type: 'text', text: 'some tool' }]
      }
    };
    const raw = [
      validFrames[0],
      validFrames[1],
      JSON.stringify(lateTool),
      validFrames[2]
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應拒絕 end_turn 後出現的任何 assistant 幀');
  });

  await t.test('3: init 後插 user 錯 session', () => {
    const wrongUser = {
      type: 'user',
      session_id: 'wrong',
      message: { content: [{ type: 'text', text: 'hi' }] }
    };
    const raw = [
      validFrames[0],
      JSON.stringify(wrongUser),
      validFrames[1],
      validFrames[2]
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應核對所有幀的 session_id');
  });

  await t.test('4: 空正文 (empty)', () => {
    const emptyAssistant = { ...validAssistant, message: { ...validAssistant.message, content: [{ type: 'text', text: '' }] } };
    const emptyResult = { ...validResult, result: '' };
    const raw = [
      validFrames[0],
      JSON.stringify(emptyAssistant),
      JSON.stringify(emptyResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應拒絕空結果');
  });

  await t.test('5: 缺 is_error', () => {
    const { is_error, ...missingIsErrorResult } = validResult;
    const raw = [
      validFrames[0],
      validFrames[1],
      JSON.stringify(missingIsErrorResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應校驗 result 必須含 is_error 且為 false');
  });

  await t.test('6: 重複 init', () => {
    const raw = [
      validFrames[0],
      validFrames[0],
      validFrames[1],
      validFrames[2]
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應拒絕多個 system.init');
  });

  await t.test('7: null frame', () => {
    const raw = [
      validFrames[0],
      'null',
      validFrames[1],
      validFrames[2]
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應拒絕 null 事件或毀損 JSON');
  });

  await t.test('8: Claude 單 JSON result', () => {
    const claudeResult = { result: 'CLAUDE-RESULT', subtype: 'success' };
    assert.equal(unwrapScanOutput(JSON.stringify(claudeResult)), 'CLAUDE-RESULT');
  });

  await t.test('9: Claude NDJSON 相容', () => {
    const claudeNDJSON = [
      JSON.stringify({ type: 'message_start' }),
      JSON.stringify({ type: 'content_block_delta', delta: { text: 'Part' } }),
      JSON.stringify({ type: 'result', subtype: 'success', result: 'CLAUDE-NDJSON' })
    ].join('\n');
    assert.equal(unwrapScanOutput(claudeNDJSON), 'CLAUDE-NDJSON');
  });

  await t.test('10: Grok 來源帶 forceGrok 強制核驗（缺 stop_reason 應拒絕）', () => {
    const head = '1234567890abcdef1234567890abcdef12345678';
    const scanBody = '🔍 Beta｜來源：Grok CLI｜掃 `1234567`\n- 零發現\n';
    const validStream = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 's10' }),
      JSON.stringify({ type: 'assistant', session_id: 's10', parent_tool_use_id: null, message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: scanBody }] } }),
      JSON.stringify({ type: 'result', session_id: 's10', subtype: 'success', is_error: false, stop_reason: 'end_turn', result: scanBody })
    ].join('\n');

    const { prepareScan } = require('../tools/review-launch.js');
    const opts = { scanner: 'Beta', source: 'Grok CLI', head: head, usable: ['Beta'], forceGrok: true };

    // 先驗證完整版成功
    const ok = prepareScan(validStream, opts);
    assert.equal(ok.header.role, 'Beta');

    // 移除 result.stop_reason 後應拒絕
    const missingStopReason = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: 's10' }),
      JSON.stringify({ type: 'assistant', session_id: 's10', parent_tool_use_id: null, message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: scanBody }] } }),
      JSON.stringify({ type: 'result', session_id: 's10', subtype: 'success', is_error: false, result: scanBody })
    ].join('\n');
    assert.throws(() => prepareScan(missingStopReason, opts), LaunchError, 'Grok 來源缺 stop_reason 應拒絕');
  });

  await t.test('11: Claude 帶 system.init 與 model 成功', () => {
    const claudeNDJSON = [
      JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-3-5-sonnet' }),
      JSON.stringify({ type: 'result', subtype: 'success', result: 'CLAUDE-INIT' })
    ].join('\n');
    assert.equal(unwrapScanOutput(claudeNDJSON), 'CLAUDE-INIT');
  });

  await t.test('12: result.is_error 為 null 應拒絕', () => {
    const nullIsError = [
      validFrames[0],
      validFrames[1],
      JSON.stringify({ ...validResult, is_error: null })
    ].join('\n');
    assert.throws(() => unwrapScanOutput(nullIsError), LaunchError, 'is_error 必須為 false');
  });

  await t.test('13: result.result 為空白應拒絕', () => {
    const blankResult = [
      validFrames[0],
      validFrames[1],
      JSON.stringify({ ...validResult, result: '  ' })
    ].join('\n');
    assert.throws(() => unwrapScanOutput(blankResult), LaunchError, '最終正文不可為空白');
  });

  await t.test('14: content block text 非 string 應拒絕', () => {
    const badContent = {
      ...validAssistant,
      message: {
        ...validAssistant.message,
        content: [
          { type: 'text', text: 'FINAL' },
          { type: 'text', text: 123 }
        ]
      }
    };
    const raw = [
      validFrames[0],
      JSON.stringify(badContent),
      validFrames[2]
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '正文內容塊中若有非字串 text 應拒絕');
  });

  await t.test('15: assistant text 與 result.result 不一致', () => {
    const diffResult = { ...validResult, result: 'DIFFERENT' };
    const raw = [
      validFrames[0],
      validFrames[1],
      JSON.stringify(diffResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'assistant 累積正文必須與 result.result 完全一致');
  });

  await t.test('16: 重複 result 幀', () => {
    const raw = [...validFrames, validFrames[2]].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '不可出現重複的 result 幀');
  });

  await t.test('17: result 後尾隨 user 幀', () => {
    const trailingUser = {
      type: 'user',
      session_id: sid,
      message: { content: [{ type: 'text', text: 'next' }] }
    };
    const raw = [...validFrames, JSON.stringify(trailingUser)].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'result 幀後不可有任何追加內容');
  });

  await t.test('18: 缺最後 result 幀', () => {
    const raw = validFrames.slice(0, 2).join('\n');
    assert.throws(() => unwrapScanOutput(raw, false, true), LaunchError, 'NDJSON 流必須以成功的 result 幀結尾');
  });

  await t.test('19: 未知 event type 應拒絕', () => {
    const unknownFrame = { type: 'unknown_event', session_id: sid };
    const raw = [validFrames[0], JSON.stringify(unknownFrame), validFrames[1], validFrames[2]].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應拒絕未知的事件類型');
  });

  await t.test('20: prepareScan 應允許 raw 中含有 🤖 (如 tool_result) 但最終正文乾淨', () => {
    const { prepareScan } = require('../tools/review-launch.js');
    const sid = 's20';
    const head = '1234567890abcdef1234567890abcdef12345678';
    const scanBody = '🔍 Beta｜來源：Grok CLI｜掃 `1234567`\n- 零發現\n';
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({ type: 'assistant', session_id: sid, message: { role: 'assistant', stop_reason: 'tool_use', content: [{ type: 'text', text: 'Thinking...' }, { type: 'tool_use', id: 'call_1', name: 'grep', input: { pattern: '🤖' } }] } }),
      JSON.stringify({ type: 'user', session_id: sid, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_1', content: 'found 🤖 in source' }] } }),
      JSON.stringify({ type: 'assistant', session_id: sid, parent_tool_use_id: null, message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: scanBody }] } }),
      JSON.stringify({ type: 'result', session_id: sid, subtype: 'success', is_error: false, stop_reason: 'end_turn', result: scanBody })
    ].join('\n');

    const opts = { scanner: 'Beta', source: 'Grok CLI', head: head, usable: ['Beta'], forceGrok: true };
    const ok = prepareScan(raw, opts);
    assert.equal(ok.header.role, 'Beta');
    assert.ok(!ok.body.includes('🤖'), '最終 body 不應包含 🤖');
  });

  await t.test('21: prepareScan 最終正文含 🤖 應拒絕', () => {
    const { prepareScan } = require('../tools/review-launch.js');
    const sid = 's21';
    const head = '1234567890abcdef1234567890abcdef12345678';
    const badBody = '🔍 Beta｜來源：Grok CLI｜掃 `1234567`\n- 發現 🤖 標記\n';
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({ type: 'assistant', session_id: sid, parent_tool_use_id: null, message: { role: 'assistant', stop_reason: 'end_turn', content: [{ type: 'text', text: badBody }] } }),
      JSON.stringify({ type: 'result', session_id: sid, subtype: 'success', is_error: false, stop_reason: 'end_turn', result: badBody })
    ].join('\n');

    const opts = { scanner: 'Beta', source: 'Grok CLI', head: head, usable: ['Beta'], forceGrok: true };
    assert.throws(() => prepareScan(raw, opts), (err) => {
      return err instanceof LaunchError && err.message.includes('複審結論記號');
    }, '正文含 🤖 應拋出含“複審結論記號”的 LaunchError');
  });

  await t.test('22: Grok system.compact_boundary 正常成功', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'auto', pre_tokens: 100 }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.equal(unwrapScanOutput(raw), 'FINAL');
  });

  await t.test('23: compact_boundary 錯 session_id 應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: 'wrong',
        uuid: 'u1',
        compact_metadata: { trigger: 'auto', pre_tokens: 100 }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'compact_boundary session_id 必須匹配');
  });

  await t.test('24: compact_boundary 缺 compact_metadata 應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1'
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'compact_boundary 必須含 compact_metadata');
  });

  await t.test('25: compact_boundary trigger 非 auto 應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'manual', pre_tokens: 100 }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'compact_metadata.trigger 必須為 auto');
  });

  await t.test('26: compact_boundary pre_tokens 非數字應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'auto', pre_tokens: '100' }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'compact_metadata.pre_tokens 必須為數字 (u64)');
  });

  await t.test('26a: compact_boundary pre_tokens 為負數應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'auto', pre_tokens: -1 }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'pre_tokens 不可為負數');
  });

  await t.test('26b: compact_boundary pre_tokens 為小數應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'auto', pre_tokens: 1.5 }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'pre_tokens 必須為整數');
  });

  await t.test('26c: compact_boundary 缺 pre_tokens 應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'auto' }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'compact_metadata 必須含 pre_tokens');
  });

  await t.test('27: compact_boundary 在 end_turn 後出現應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify(validAssistant),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'auto', pre_tokens: 100 }
      }),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'end_turn 後不可出現 compact_boundary');
  });

  await t.test('28: compact_boundary 在 result 後出現應拒絕', () => {
    const raw = [
      validFrames[0],
      validFrames[1],
      validFrames[2],
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'auto', pre_tokens: 100 }
      })
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'result 後不可追加任何 system 幀');
  });

  await t.test('29: 未知 system subtype 應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({ type: 'system', subtype: 'unknown_future_feature', session_id: sid }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '應拒絕未知的 system subtype');
  });

  await t.test('30: compact_boundary 缺 uuid 應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        compact_metadata: { trigger: 'auto', pre_tokens: 100 }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'compact_boundary 必須含 uuid');
  });

  await t.test('30a: compact_boundary uuid 為空字串應拒絕', () => {
    const raw = [
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sid }),
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: '',
        compact_metadata: { trigger: 'auto', pre_tokens: 100 }
      }),
      JSON.stringify(validAssistant),
      JSON.stringify(validResult)
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, 'compact_boundary uuid 不可為空');
  });

  await t.test('31: init 前出現 compact_boundary 應拒絕', () => {
    const raw = [
      JSON.stringify({
        type: 'system',
        subtype: 'compact_boundary',
        session_id: sid,
        uuid: 'u1',
        compact_metadata: { trigger: 'auto', pre_tokens: 100 }
      }),
      validFrames[0],
      validFrames[1],
      validFrames[2]
    ].join('\n');
    assert.throws(() => unwrapScanOutput(raw), LaunchError, '尚未初始化');
  });
});
