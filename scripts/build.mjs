import {mkdir, cp, rm, writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true}); await mkdir('dist',{recursive:true});
for(const f of ['index.html','src','data','docs']) await cp(f,`dist/${f}`,{recursive:true});
await writeFile('dist/.nojekyll',''); console.log('Built static dashboard → dist');
