import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',fullyParallel:true,timeout:30000,
 use:{baseURL:'http://127.0.0.1:4173',headless:true,launchOptions:process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']}:{}},
 webServer:{command:'npm run dev',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
 projects:[{name:'desktop',use:{viewport:{width:1440,height:1080}}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true}}]
});
