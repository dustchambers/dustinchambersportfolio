const {JSDOM}=require('./test-runtime/node_modules/jsdom');
const fs=require('node:fs'), assert=require('node:assert/strict');
const script=fs.readFileSync('gallery9.js','utf8');
const css=fs.readFileSync('gallery9.css','utf8');
function fixture(images,edit=true){
 const dom=new JSDOM('<style>'+css+'</style><div id="gallery" class="gallery"></div>',{url:'https://test.local/?id=test'+(edit?'&gedit':''),runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window; w.GALLERY_CONFIG={id:'test',images}; w.confirm=()=>true;
 w.fetch=async()=>({ok:true,json:async()=>({ok:true})});
 w.HTMLElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:1400,height:600,right:1400,bottom:600};};
 const hooks='window.test={captureSnapshot,applyUndoSnapshot,createImageItem,addUploadedImageToGallery,toggleEditor,autoSave,moveResize,moveDrag};';
 w.eval(script.replace(/\}\)\(\);\s*$/,hooks+'})();'));
 const item=id=>Array.from(w.document.querySelectorAll('.g9-item')).find(x=>x.querySelector('img')?.dataset.imageId===id);
 const mouse=(el,type,x,y,shift=false)=>el.dispatchEvent(new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0,shiftKey:shift}));
 const key=(k,opts={})=>w.document.dispatchEvent(new w.KeyboardEvent('keydown',{bubbles:true,key:k,...opts}));
 return {w,item,mouse,key,close:()=>w.close()};
}
const image=(id,c,r,cols=6,rows=4,fit='contain')=>({id,src:'https://test.local/'+id,cols,rows,colStart:c,rowStart:r,fit});
{
 const f=fixture([image('a',1,1),image('b',7,1),image('c',1,5)]),{w,item,key,mouse}=f;
 const initial=JSON.stringify(w.test.captureSnapshot());
 assert.match(w.document.querySelector('.save-indicator').textContent,/Site layout loaded/);
 item('a').querySelector('.photo-fit').click(); assert.equal(item('a').querySelector('img').style.objectFit,'cover');
 assert.match(w.document.querySelector('.save-indicator').textContent,/Draft saved in this browser/);
 key('z',{metaKey:true});assert.equal(item('a').querySelector('img').style.objectFit,'contain');
 key('z',{metaKey:true,shiftKey:true});assert.equal(item('a').querySelector('img').style.objectFit,'cover');
 item('a').querySelector('img').style.objectPosition='12% 80%';
 const before=item('a').style.gridRow;
 Array.from(item('a').querySelectorAll('button')).find(b=>b.textContent==='Reset crop').click();
 assert.equal(item('a').querySelector('img').style.objectPosition,'50% 50%');assert.equal(item('a').style.gridRow,before);
 mouse(item('a'),'mousedown',40,40);mouse(w,'mouseup',40,40);
 assert.match(w.document.querySelector('#selection-count').textContent,/1 selected/);
 key('ArrowRight');assert.equal(item('a').style.gridColumn,'2 / span 6');
 key('z',{metaKey:true});assert.equal(item('a').style.gridColumn,'1 / span 6');
 key('z',{metaKey:true,shiftKey:true});assert.equal(item('a').style.gridColumn,'2 / span 6');
 // Resizing right with Shift pushes a neighboring tile down instead of outside column 18.
 mouse(item('a').querySelector('.item-resize-r'),'mousedown',400,100,true);
 mouse(w,'mousemove',600,100,true);
 assert.equal(item('b').style.gridColumn,'7 / span 6');
 assert(parseInt(item('b').style.gridRow)>1);
 assert(item('b').classList.contains('g9-pushed'));
 mouse(w,'mousemove',600,100,false);assert.equal(item('b').style.gridRow,'1 / span 4');
 mouse(w,'mouseup',600,100,false);
 w.test.applyUndoSnapshot(JSON.parse(initial));
 // Shift from initial mousedown must drag/push, never adjust crop.
 mouse(item('a'),'mousedown',40,40,true);mouse(w,'mousemove',160,160,true);
 assert(w.document.querySelector('.drop-indicator'));
 assert.match(w.document.querySelector('#move-preview').textContent,/Pushing/);
 mouse(w,'mousemove',160,160,false);assert.equal(item('c').style.gridRow,'5 / span 4');
 mouse(w,'mouseup',160,160,false);
 assert.equal(item('a').querySelector('img').style.objectPosition,'');
 w.test.toggleEditor(); assert.equal(w.document.querySelectorAll('.photo-controls').length,0);
 w.test.toggleEditor();assert.equal(w.document.querySelectorAll('.photo-controls').length,3);
 assert.equal(item('a').querySelectorAll('.item-resize-handle').length,8);
 f.close();
}
{
 const f=fixture([image('custom',1,1,6,4)]);
 const i=f.item('custom'),img=i.querySelector('img');
 Object.defineProperties(img,{naturalWidth:{value:2000},naturalHeight:{value:3000}});
 img.dispatchEvent(new f.w.Event('load'));
 assert.equal(i.style.gridRow,'1 / span 4','saved custom geometry is preserved');f.close();
}
{
 const f=fixture([image('a',1,1)]);
 const i=f.w.test.addUploadedImageToGallery({id:'portrait',src:'https://test.local/portrait'}),img=i.querySelector('img');
 Object.defineProperties(img,{naturalWidth:{value:2000},naturalHeight:{value:3000}});
 img.dispatchEvent(new f.w.Event('load'));
 assert.equal(img.style.objectFit,'contain');
 assert.match(i.style.gridRow,/span 6/); assert.match(i.style.gridColumn,/span 4/);f.close();
}
{
 const config=JSON.parse(fs.readFileSync('tools/fixtures/commercial2.json','utf8'));
 const f=fixture(config.images,false);
 assert.equal(f.w.document.querySelectorAll('.g9-item').length,32);
 assert.equal(f.w.document.querySelectorAll('.photo-controls').length,0);
 assert.deepEqual(Array.from(f.w.document.querySelectorAll('.g9-item')).map(i=>i.querySelector('img').dataset.imageId),config.images.map(i=>i.id));
 for(const input of config.images){const i=f.item(input.id);assert.equal(i.style.gridColumn,input.colStart+' / span '+input.cols);assert.equal(i.style.gridRow,input.rowStart+' / span '+input.rows);}
 f.close();
}
{
 const config=JSON.parse(fs.readFileSync('tools/fixtures/commercial2.json','utf8'));
 const f=fixture(config.images,false), runner=f.item('OH6A7724.jpg');
 // Reproduce editor bring-to-front: runner becomes the last DOM node.
 f.w.document.getElementById('gallery').appendChild(runner);
 runner.click();
 assert.equal(f.w.document.querySelector('.lightbox-counter').textContent,'8 / 32');
 assert(f.w.document.querySelector('#lightbox-img').src.includes('OH6A7724.jpg'));
 f.key('ArrowRight');
 assert(f.w.document.querySelector('#lightbox-img').src.includes('OH6A9237.jpg'));
 f.close();
}
console.log('Passed: fit/reset, persistence, undo/redo, selection/nudge, Shift drag/resize and release, portrait upload, editor reentry, unchanged 32-photo view, visual lightbox order after DOM reorder.');
