if(!self.define){let e,s={};const i=(i,n)=>(i=new URL(i+".js",n).href,s[i]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=i,e.onload=s,document.head.appendChild(e)}else e=i,importScripts(i),s()})).then((()=>{let e=s[i];if(!e)throw new Error(`Module ${i} didn’t register its module`);return e})));self.define=(n,r)=>{const t=e||("document"in self?document.currentScript.src:"")||location.href;if(s[t])return;let o={};const l=e=>i(e,t),u={module:{uri:t},exports:o,require:l};s[t]=Promise.all(n.map((e=>u[e]||l(e)))).then((e=>(r(...e),o)))}}define(["./workbox-3e911b1d"],(function(e){"use strict";self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"assets/index-1330605d.js",revision:null},{url:"assets/index-9f341b42.css",revision:null},{url:"index.html",revision:"34b439bb6121922bd9cb9b57fa6f5a6b"},{url:"registerSW.js",revision:"402b66900e731ca748771b6fc5e7a068"},{url:"manifest.webmanifest",revision:"448e28df77a1049b39fe7326a48a4fe9"}],{}),e.cleanupOutdatedCaches(),e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL("index.html")))}));
