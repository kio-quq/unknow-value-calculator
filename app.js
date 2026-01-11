// 多功能計算機與出題系統
const exprEl = document.getElementById('expr');
const resultEl = document.getElementById('result');
const historyListEl = document.getElementById('historyList');

function loadHistory(){
  const raw = localStorage.getItem('calc_history');
  return raw? JSON.parse(raw):[];
}
function saveHistory(hist){
  localStorage.setItem('calc_history', JSON.stringify(hist));
}
function addHistory(entry){
  const hist = loadHistory(); hist.unshift(entry); if(hist.length>200) hist.pop(); saveHistory(hist); renderHistory(); }
function renderHistory(){
  const hist = loadHistory(); historyListEl.innerHTML='';
  hist.forEach(h=>{ const d=document.createElement('div'); d.className='item'; d.innerHTML=`<div><b>${h.type}</b> ${h.expr}</div><div style="color:#9aa4b2;font-size:12px">${h.result}</div>`; historyListEl.appendChild(d); });
}

// 按鈕插入
document.querySelectorAll('[data-insert]').forEach(b=>{
  b.addEventListener('click',()=>{ exprEl.value += b.getAttribute('data-insert'); exprEl.focus(); });
});

document.getElementById('clear').addEventListener('click',()=>{ exprEl.value=''; resultEl.textContent='結果顯示'; });
document.getElementById('copy').addEventListener('click',()=>{ navigator.clipboard?.writeText(resultEl.textContent||''); });

function evaluateExpression(input){
  try{
    // 若包含等號，保留給求解
    if(input.includes('=')) throw new Error('包含等號，請使用求解功能');
    const val = math.evaluate(input);
    return {ok:true, value: val};
  }catch(err){
    return {ok:false, error: err.toString()};
  }
}

document.getElementById('eval').addEventListener('click',()=>{
  const inpt = exprEl.value.trim();
  if(!inpt) return;
  const res = evaluateExpression(inpt);
  if(res.ok){ resultEl.textContent = String(res.value); addHistory({type:'eval', expr:inpt, result: String(res.value), ts: Date.now()}); }
  else{ resultEl.textContent = res.error; addHistory({type:'error', expr:inpt, result: res.error, ts: Date.now()}); }
});

// 單變數方程式求根（以 x 為變數）
function solveForX(equation){
  // 支援形式 left = right
  try{
    const parts = equation.split('=');
    if(parts.length!==2) return {ok:false,error:'方程式需含有一個等號 (=)'};
    const left = parts[0]; const right = parts[1];
    // 定義 f(x) = left - right
    const expr = `(${left}) - (${right})`;
    const node = math.parse(expr);
    const compiled = node.compile();

    // 嘗試在若干區間內找根
    const tries = [-100,-10,-1,0,1,2,5,10,100];
    for(let i=0;i<tries.length-1;i++){
      const a=tries[i], b=tries[i+1];
      let fa = compiled.evaluate({x:a});
      let fb = compiled.evaluate({x:b});
      if(isNaN(fa)||isNaN(fb)) continue;
      if(fa===0) return {ok:true,root:a};
      if(fb===0) return {ok:true,root:b};
      if(fa*fb<0){
        // 二分法
        let lo=a, hi=b, m, fm;
        for(let iter=0;iter<80;iter++){
          m=(lo+hi)/2; fm = compiled.evaluate({x:m});
          if(Math.abs(fm) < 1e-12) break;
          if(fa*fm<=0) { hi = m; fb = fm; }
          else { lo = m; fa = fm; }
        }
        return {ok:true,root:m};
      }
    }
    // 若沒找到，嘗試牛頓法
    let x = 1;
    for(let k=0;k<100;k++){
      const fx = compiled.evaluate({x});
      const h = 1e-6;
      const fpx = (compiled.evaluate({x:x+h}) - fx)/h;
      if(fpx===0) break;
      const nx = x - fx/fpx;
      if(Math.abs(nx-x) < 1e-10) return {ok:true,root:nx};
      x = nx;
    }
    return {ok:false,error:'未找到根（嘗試其他初值或簡化方程）'};
  }catch(err){ return {ok:false,error:err.toString()}; }
}

document.getElementById('solve').addEventListener('click',()=>{
  const inpt = exprEl.value.trim(); if(!inpt) return;
  const res = solveForX(inpt);
  if(res.ok){ resultEl.textContent = 'x ≈ '+Number(res.root).toPrecision(12); addHistory({type:'solve', expr:inpt, result: String(res.root), ts: Date.now()}); }
  else{ resultEl.textContent = res.error; addHistory({type:'solve_error', expr:inpt, result: res.error, ts: Date.now()}); }
});

// 歷史清除與匯出
document.getElementById('clearHistory').addEventListener('click',()=>{ localStorage.removeItem('calc_history'); renderHistory(); });
document.getElementById('exportHistory').addEventListener('click',()=>{
  const data = JSON.stringify(loadHistory(),null,2); const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='calc_history.json'; a.click(); URL.revokeObjectURL(url);
});

// 出題系統
const qTypeEl = document.getElementById('qType');
const qDiffEl = document.getElementById('qDifficulty');
const questionArea = document.getElementById('questionArea');

function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }

function genArithmetic(d){
  let a,b; if(d==='easy'){ a=randInt(1,10); b=randInt(1,10); }
  else if(d==='medium'){ a=randInt(10,50); b=randInt(1,50); }
  else { a=randInt(-200,200); b=randInt(-100,200); }
  const ops=['+','-','*','/']; const op=ops[randInt(0,ops.length-1)];
  const expr = `${a} ${op} ${b}`;
  const ans = math.evaluate(expr);
  return {q:expr, a:ans};
}

function genLinear(d){
  let a,b,c;
  if(d==='easy'){ a=randInt(1,9); b=randInt(0,9); c=randInt(0,20); }
  else if(d==='medium'){ a=randInt(-10,10)||1; b=randInt(-20,20); c=randInt(-30,30); }
  else { a=randInt(-50,50)||1; b=randInt(-50,50); c=randInt(-100,100); }
  // ax + b = c -> ax = c-b -> x = (c-b)/a
  const q = `${a}*x + (${b}) = ${c}`;
  const ans = (c - b)/a;
  return {q, a:ans};
}

function genQuadratic(d){
  let a,b,c;
  if(d==='easy'){ a=randInt(1,5); b=randInt(-10,10); c=randInt(-10,10); }
  else if(d==='medium'){ a=randInt(1,10); b=randInt(-30,30); c=randInt(-30,30); }
  else { a=randInt(1,20); b=randInt(-80,80); c=randInt(-80,80); }
  const q = `${a}*x^2 + (${b})*x + (${c}) = 0`;
  // 解二次方程式
  const D = b*b - 4*a*c;
  let ans;
  if(D<0) ans = '無實根'; else {
    const r1 = (-b + Math.sqrt(D))/(2*a); const r2 = (-b - Math.sqrt(D))/(2*a);
    ans = [r1,r2];
  }
  return {q, a:ans};
}

let currentQuestion = null;

document.getElementById('genQ').addEventListener('click',()=>{
  const type = qTypeEl.value; const diff = qDiffEl.value;
  let gen;
  if(type==='arithmetic') gen = genArithmetic(diff);
  else if(type==='linear') gen = genLinear(diff);
  else gen = genQuadratic(diff);
  currentQuestion = gen;
  renderQuestion(gen);
});

function renderQuestion(qobj){
  questionArea.innerHTML='';
  const p=document.createElement('div'); p.style.marginBottom='8px'; p.textContent = '題目: '+qobj.q; questionArea.appendChild(p);
  const input = document.createElement('input'); input.placeholder='輸入答案（數值或逗號分隔）'; questionArea.appendChild(input);
  const btn = document.createElement('button'); btn.textContent='提交答案'; questionArea.appendChild(btn);
  const feed = document.createElement('div'); feed.style.marginTop='8px'; questionArea.appendChild(feed);
  btn.addEventListener('click',()=>{
    const user = input.value.trim();
    let ok=false, msg='';
    if(Array.isArray(qobj.a)){
      const got = user.split(',').map(s=>Number(s.trim()));
      if(got.length>=2 && Math.abs(got[0]-qobj.a[0])<1e-6 && Math.abs(got[1]-qobj.a[1])<1e-6) ok=true;
    }else if(typeof qobj.a==='number'){
      if(Math.abs(Number(user)-qobj.a)<1e-6) ok=true;
    }else{ // 文字答案
      if(String(user).toLowerCase() === String(qobj.a).toLowerCase()) ok=true;
    }
    if(ok){ msg='答對！'; feed.style.color='#10b981'; } else { msg='答案: '+JSON.stringify(qobj.a); feed.style.color='#ef4444'; }
    feed.textContent = msg; addHistory({type:'quiz', expr:qobj.q, result: ok? 'correct':'wrong', answer: qobj.a, input: user, ts: Date.now()});
  });
}

// 測驗模式（簡易）
document.getElementById('startQuiz').addEventListener('click',()=>{
  const type = qTypeEl.value; const diff = qDiffEl.value; const n=5; let score=0; let idx=0;
  function next(){
    if(idx>=n){ questionArea.innerHTML=`完成！得分 ${score}/${n}`; return; }
    let q;
    if(type==='arithmetic') q = genArithmetic(diff);
    else if(type==='linear') q = genLinear(diff);
    else q = genQuadratic(diff);
    currentQuestion = q; questionArea.innerHTML='';
    const p=document.createElement('div'); p.textContent=`第 ${idx+1} 題： ${q.q}`; questionArea.appendChild(p);
    const input=document.createElement('input'); questionArea.appendChild(input);
    const btn=document.createElement('button'); btn.textContent='提交'; questionArea.appendChild(btn);
    const fb=document.createElement('div'); questionArea.appendChild(fb);
    btn.addEventListener('click',()=>{
      const u=input.value.trim(); let correct=false;
      if(Array.isArray(q.a)){
        const got = u.split(',').map(s=>Number(s.trim())); if(got.length>=2 && Math.abs(got[0]-q.a[0])<1e-6 && Math.abs(got[1]-q.a[1])<1e-6) correct=true;
      }else if(typeof q.a==='number'){
        if(Math.abs(Number(u)-q.a)<1e-6) correct=true;
      }else{ if(String(u).toLowerCase()===String(q.a).toLowerCase()) correct=true; }
      if(correct){ score++; fb.textContent='答對'; fb.style.color='#10b981'; } else { fb.textContent='答案：'+JSON.stringify(q.a); fb.style.color='#ef4444'; }
      addHistory({type:'quiz_auto', expr:q.q, result: correct?'correct':'wrong', answer:q.a, input:u, ts:Date.now()});
      idx++; setTimeout(next,800);
    });
  }
  next();
});

// 初始化
renderHistory();
