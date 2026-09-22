import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('login and registration refresh navigation identity; logout clears it',async()=>{
 for(const mode of ['login','register']){
  let submit,logout,shown=0;
  const node=()=>({value:'test',classList:{add(){},remove(){}},focus(){}});
  const c=vm.createContext({loginMode:mode,loginError:{},loginEmail:node(),loginPassword:node(),loginName:node(),loginButton:node(),logoutButton:{...node(),addEventListener:(e,f)=>logout=f},loginForm:{addEventListener:(e,f)=>submit=f},
   fetch:async()=>({ok:true}),loadAuthState:async()=>({authRequired:true,user:{id:'test'}}),renderProfile(){},configureApiUsageAdmin:s=>c.currentAuthState=s,loadCurrentUserProfile:async()=>{},hideLogin(){},showLogin(){shown++;},
   currentAuthState:{authRequired:true,user:null},currentUserProfile:{},activeChatBrowserSession:null,pendingGuestAction:null,
   isGuest:()=>!c.currentAuthState.user,publicPages:new Set(['home','central-servicos']),window:{location:{assign(){}}},
   pageMeta:{home:{},'central-servicos':{}},document:{body:{dataset:{}},dispatchEvent(){},querySelector(){return null;}},pageTitle:{},pageEyebrow:{},pageBlocks:[],operationsPages:null,navGroups:[],navLinks:[],applyAuditRouteDefaults(){},setMobileMenu(){},requestAnimationFrame(){},CustomEvent:class{},
  });
  for(const name of ['loadDashboard','loadAudits','loadAuditHistory','loadPropertyModule','loadConsultations','loadSources','loadAgentSettings','loadAssistantSources'])c[name]=async()=>{};
  vm.runInContext(source.slice(source.indexOf('function setActivePage('),source.indexOf('function finishAppBoot(')),c);
  vm.runInContext(source.slice(source.indexOf('loginForm.addEventListener("submit"'),source.indexOf('sourceForm.addEventListener("submit"')),c);
  vm.runInContext(source.slice(source.indexOf('logoutButton.addEventListener("click"'),source.indexOf('newQueryButton?.addEventListener')),c);
  await submit({preventDefault(){}});
  vm.runInContext('setActivePage("central-servicos");setActivePage("home")',c);
  assert.equal(shown,0,mode+' must retain login when navigating back');
  assert.equal(c.currentAuthState.user.id,'test');
  await logout();
  assert.equal(c.currentAuthState.user,null);
  assert.equal(c.currentUserProfile,null);
  vm.runInContext('setActivePage("central-servicos")',c);
  assert.equal(shown,0,'logout leaves public navigation available');
 }
});
