import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(execFileSync('python',['-c','import json; from backend.catalog import catalog; print(json.dumps(catalog()))'],{cwd:root,encoding:'utf8'}));
const actions=['View','Create','Edit','Delete','Upload','Approve','Close'];
catalog.permissions=Object.fromEntries(Object.keys(catalog.modules).map(m=>[m,Object.fromEntries(actions.map(a=>[a,true]))]));
catalog.roles=['Admin','Viewer'];
const summary={alerts:[],activity:[],conflicts:[],counts:{},materials:{},total_materials:0,compliance_rate:0,open_ncr:0,overdue_capa:0,training_rate:0,windows:{30:0,60:0,90:0},cts:['cts-1','cts-2','cts-3'].map(id=>({id,total:0,compliant:0,issues:0,updated:null}))};

async function boot(overrides={}){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'backend/templates/index.html'),'utf8'),{url:'http://localhost/#/dashboard',runScripts:'outside-only'});
  const {window:w}=dom;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.fetch=async url=>{
    const u=new URL(url,'http://localhost');
    let data;
    if(overrides[u.pathname]) data=await overrides[u.pathname](u);
    else if(u.pathname==='/api/auth/me')data={user:{id:1,name:'QA Admin',email:'qa@example.test',role:'Admin'},csrf:'test'};
    else if(u.pathname==='/api/catalog')data=catalog;
    else if(u.pathname==='/api/overview')data=summary;
    else if(u.pathname==='/api/records')data={items:[],total:0,page:1,size:20};
    else if(u.pathname==='/api/records/1')data={id:1,module:'materials',version:1,updated_at:'2026-09-15T09:00:00',display_status:'Pending',data:{material_code:'TEST-1',material_name:'Test material'},evidence:[],history:[],related:[],aliases:['TEST-1'],conflicts:[]};
    else if(u.pathname==='/api/imports')data={files:[],conflicts:[]};
    else if(u.pathname==='/api/xrf-trend')data={items:[],coverage:[],basis:'Source data'};
    else if(u.pathname==='/api/users')data=[];
    else if(u.pathname==='/api/settings/permissions')data={Viewer:catalog.permissions};
    else if(u.pathname.startsWith('/api/settings/'))data={};
    else throw Error('Unexpected test request: '+url);
    return {ok:true,status:200,json:async()=>structuredClone(data)};
  };
  const ui=fs.readFileSync(path.join(root,'static/ui.js'),'utf8').replaceAll('export function ','function ');
  const app=fs.readFileSync(path.join(root,'static/app.js'),'utf8').replace(/^import[^\n]*\n/,'');
  const code=`(async()=>{${ui}\n${app}\nglobalThis.testApp={render,rowTable,openModal,confirmAction,recordForm};})()`;
  await new vm.Script(code,{filename:'application-ui.js'}).runInContext(dom.getInternalVMContext());
  return {dom,w,async route(route){w.history.replaceState(null,'','/#/'+route);await w.testApp.render();return w.document.querySelector('#content');}};
}

test('Dashboard renders with no alerts/activity; sidebar has all six groups',async()=>{
  const {dom,w}=await boot();
  try{
    assert.equal(w.document.querySelector('#content .alert.error'),null);
    assert.match(w.document.querySelector('#content').textContent,/Không có mục cần xử lý/);
    assert.equal(w.document.querySelectorAll('[data-group]').length,6);
    assert.equal(w.document.querySelector('#topbar-title').textContent,'Tổng quan Product Safety');
  }finally{dom.window.close();}
});

test('Every module renders and binds its empty table controls',async()=>{
  const app=await boot();
  try{for(const module of Object.keys(catalog.modules)){
    const page=await app.route(module);
    assert.equal(page.querySelector('.alert.error'),null,module+': '+page.textContent);
    assert.ok(page.querySelector('#filters'),module);
    assert.equal(typeof page.querySelector('#export').onclick,'function',module);
    assert.equal(app.w.document.querySelector('.nav-link.active')?.getAttribute('href'),'#/'+module);
  }}finally{app.dom.window.close();}
});

test('Group, record, imports, settings and unknown routes render without missing helpers',async()=>{
  const app=await boot();
  try{for(const route of [...catalog.groups.map(g=>'group/'+g.id),'record/1','imports','users','roles','notifications','retention','system','xrf-trend','unknown-route']){
    const page=await app.route(route);
    assert.equal(page.querySelector('.alert.error'),null,route+': '+page.textContent);
  }}finally{app.dom.window.close();}
});

test('Record form, close button and confirmation dialog work',async()=>{
  const {dom,w}=await boot();
  try{
    w.testApp.recordForm('materials');
    assert.equal(w.document.querySelector('#modal').open,true);
    assert.ok(w.document.querySelector('#record-form'));
    w.document.querySelector('[data-close]').click();
    assert.equal(w.document.querySelector('#modal').open,false);
    let called=false;
    w.testApp.confirmAction('Confirm',async()=>{called=true;});
    const button=w.document.querySelector('#accept-confirm');
    await button.onclick({target:button});
    assert.ok(called);
    assert.equal(w.document.querySelector('#modal').open,false);
  }finally{dom.window.close();}
});

test('Failure keeps navigation available and offers retry',async()=>{
  const app=await boot({'/api/overview':async()=>{throw Error('Test network error');}});
  try{
    assert.match(app.w.document.querySelector('#content').textContent,/Test network error/);
    assert.equal(typeof app.w.document.querySelector('#retry-page').onclick,'function');
    assert.equal(app.w.document.querySelectorAll('[data-group]').length,6);
    const page=await app.route('materials');
    assert.equal(page.querySelector('.alert.error'),null);
  }finally{app.dom.window.close();}
});

test('Slow old request cannot overwrite the current page',async()=>{
  const app=await boot();
  try{
    const originalFetch=app.w.fetch;
    let release;
    app.w.fetch=async url=>url.startsWith('/api/overview')?await new Promise(resolve=>{release=()=>resolve({ok:true,status:200,json:async()=>summary});}):originalFetch(url);
    const slow=app.route('dashboard');
    await app.route('materials');
    release();await slow;
    assert.ok(app.w.document.querySelector('#filters'));
    assert.equal(app.w.document.querySelector('#topbar-title').textContent,catalog.modules.materials.title);
  }finally{app.dom.window.close();}
});

test('Empty-state text is escaped',async()=>{
  const ui=fs.readFileSync(path.join(root,'static/ui.js'),'utf8');
  const {empty}=await import('data:text/javascript;base64,'+Buffer.from(ui).toString('base64'));
  assert.match(empty('<img src=x onerror=alert(1)>'),/&lt;img/);
  assert.ok(!empty('<script>x</script>').includes('<script>'));
});
