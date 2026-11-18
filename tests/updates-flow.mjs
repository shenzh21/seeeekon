import { chromium } from 'playwright'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import assert from 'node:assert/strict'
const gradle = await readFile('android/app/build.gradle','utf8')
const currentCode = Number(/versionCode\s+(\d+)/.exec(gradle)[1])
const currentName = /versionName\s+"([^"]+)"/.exec(gradle)[1]
const root = path.resolve('dist')
const server = http.createServer(async (req,res) => {
  const file = path.resolve(root,'.'+(req.url === '/' ? '/index.html' : req.url.split('?')[0]))
  if (!file.startsWith(root+path.sep)) return res.writeHead(403).end()
  try {
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html')
    res.end(await readFile(file))
  } catch { res.writeHead(404).end() }
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const browser = await chromium.launch({channel:'msedge',headless:true})
const context = await browser.newContext({viewport:{width:390,height:844},locale:'zh-CN'})
const page = await context.newPage()
const repo='https://github.com/shenzh21/seeeekon'
const manifest=(code,name)=>({schema:1,appId:'app.liubai.chat',versionCode:code,versionName:name,releaseUrl:`${repo}/releases/tag/v${name}`,downloadUrl:`${repo}/releases/download/v${name}/seeeekon-${name}.apk`,sha256:'a'.repeat(64),notes:['这是模拟新版本，用于验证提醒。']})
let response=manifest(currentCode+1,'9.9-test'), status=200, requests=0
const opened=[]
await context.route('https://shenzh21.github.io/seeeekon/latest.json',async route=>{
  requests++
  assert.equal(route.request().headers().authorization,undefined)
  assert.equal(route.request().headers().cookie,undefined)
  await route.fulfill({status,json:response,headers:{'access-control-allow-origin':'*'}})
})
await page.exposeFunction('captureOpen',url=>opened.push(url))
await page.addInitScript(()=>{
  window.androidBridge={}
  const listeners=new Map()
  window.Capacitor={
    PluginHeaders:['KeyVault','CapgoInAppBrowser'].map(name=>({name,methods:[...['get','request','cancel','open','removeListener'].map(name=>({name,rtype:'promise'})),{name:'addListener',rtype:'callback'}]})),
    nativeCallback:(plugin,method,options,fn)=>{const id=String(Math.random());listeners.set(id,fn);return id},
    nativePromise:async(plugin,method,options)=>{
      if(method==='get')return {connected:true}
      if(method==='removeListener'){listeners.delete(options.callbackId);return}
      if(method==='open')return window.captureOpen(options.url)
      if(method==='request')setTimeout(()=>{
        const emit=data=>{for(const fn of listeners.values())fn({id:options.id,...data})}
        emit({type:'headers',status:200,contentType:'application/json'})
        emit({type:'chunk',data:btoa(JSON.stringify({balance_infos:[{currency:'CNY',total_balance:'5'}]}))})
        emit({type:'end'})
      },0)
    },
  }
})
const about=async()=>{
  await page.getByRole('button',{name:'打开边栏',exact:true}).click()
  await page.getByRole('button',{name:'设置',exact:true}).last().click()
  await page.getByRole('tab',{name:'关于软件'}).click()
}
const manual=()=>page.getByRole('button',{name:'检查更新',exact:true}).click()
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByRole('dialog',{name:'发现新版本 9.9-test'}).waitFor()
  await page.getByRole('button',{name:'稍后再说',exact:true}).click()
  assert.match(await page.evaluate(()=>localStorage.getItem('chat-demo:update-deferred')),new RegExp(`^${currentCode+1}:`))
  const count=requests
  await page.reload()
  await page.locator('.welcome-mark').waitFor()
  assert.equal(requests,count,'Reload is throttled')
  await about()
  await manual()
  await page.getByText('新版本 9.9-test',{exact:true}).waitFor()
  await page.getByRole('button',{name:'前往更新',exact:true}).click()
  await page.getByRole('button',{name:'GitHub 项目 ↗',exact:true}).click()
  await page.getByRole('button',{name:'下载主页 ↗',exact:true}).click()
  assert.deepEqual(opened,[`${repo}/releases/tag/v9.9-test`,repo,'https://shenzh21.github.io/seeeekon/'])
  response=manifest(currentCode,currentName)
  await manual()
  await page.getByText('已是最新版本。',{exact:true}).waitFor()
  await page.screenshot({path:'docs/android-update-preview.png'})
  response=manifest(currentCode-1,'1.4-preview')
  await manual()
  await page.getByText('已是最新版本。',{exact:true}).waitFor()
  response={...manifest(currentCode+1,'9.9-test'),downloadUrl:'https://example.com/untrusted.apk'}
  await manual()
  await page.getByText('暂时无法检查更新，请稍后重试，或打开下载主页。',{exact:true}).waitFor()
  assert.equal(await page.getByText('已是最新版本。',{exact:true}).count(),0)
  status=503
  await manual()
  await page.getByText('暂时无法检查更新，请稍后重试，或打开下载主页。',{exact:true}).waitFor()
  status=200;response=manifest(currentCode+1,'9.9-test')
  await page.evaluate(()=>localStorage.removeItem('chat-demo:update-checked-at'))
  await page.reload()
  await page.locator('.welcome-mark').waitFor()
  await page.waitForFunction(()=>localStorage.getItem('chat-demo:update-checked-at')!==null)
  await about()
  assert.equal(await page.getByRole('dialog',{name:'发现新版本 9.9-test'}).count(),0,'Deferred prompt survives restart')
  console.log('PASS: startup update, persistent throttle/defer, manual override, current/older/error/invalid URL, native browser links; mock bridge only')
} finally { await browser.close();server.close() }
