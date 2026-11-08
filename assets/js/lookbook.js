/* Ælen Paris — lookbook : magazine en WebGL (feuilles qui se courbent, ouverture automatique, achat depuis les photos) */
(function(){
 var mag=document.getElementById("hero-video"),stage=mag.querySelector(".mag-stage"),cv=document.getElementById("glc"),label=document.getElementById("magLabel");
 if(!mag||!cv)return;
 var BASE="assets/img/lookbook/";
 var ORDER=[["trench-chocolat","p1"],["trench-beige","p2"],["veste-croco-beige","p3"],["veste-foulard-marron","p4"],["pull-raye-beige","p5"],["pull-raye-rouge","p6"]];
 var PL=(typeof PRODUCTS!=="undefined"?PRODUCTS:[]);
 /* pages : 0 couverture, 1..6 une pièce chacune (achetable), 7 page de fin */
 var DEFS=[{t:"cover",key:"cover"}];
 ORDER.forEach(function(o,i){var pr=PL.find(function(x){return x.id===o[0]});DEFS.push({t:"prod",key:o[1],id:o[0],n:"0"+(i+1),name:pr?pr.name:o[0],meta:pr?(pr.category+" · "+pr.color):""})});
 DEFS.push({t:"end",key:"end"});
 var mny=function(v){return v.toFixed(2).replace(".",",").replace(",00","")+" €"};
 var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
 var ease=function(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2};
 var NP=DEFS.length; /* 8 */
 var TOPY=0,OY=0,mobile=false,N=0,W=0,H=0,LW=720,LH=1080,TW=matchMedia('(max-width:860px)').matches?720:900,TH=TW*1.5,smax=0;
 var gl=cv.getContext("webgl",{antialias:true,alpha:true,premultipliedAlpha:false});
 var imgs={},imgState={};
 function loadImg(k){if(imgs[k]||imgState[k])return;imgState[k]=1;var i=new Image();i.decoding="async";i.onload=function(){imgs[k]=i;pageTex.forEach(function(t,p){if(t&&t.wait===k){t.wait=null;fill(p)}});dirty=true};i.src=BASE+k+".jpg"}
 /* texture de page dessinée au canvas 2D */
 var pageTex=[],pcan=[];
 function spaced(ctx,t,x,y,sp,align){var w=0,i;for(i=0;i<t.length;i++)w+=ctx.measureText(t[i]).width+sp;w-=sp;var cx=align==="center"?x-w/2:(align==="right"?x-w:x);for(i=0;i<t.length;i++){ctx.fillText(t[i],cx,y);cx+=ctx.measureText(t[i]).width+sp}return w}
 function drawPage(p){
  var c=document.createElement("canvas");c.width=TW;c.height=TH;var x=c.getContext("2d");x.scale(TW/LW,TH/LH);
  var d=DEFS[p],cover=d.t==='cover',key=d.key;
  x.fillStyle="#1a140e";x.fillRect(0,0,LW,LH);
  var im=imgs[key];if(!im){x.fillStyle="#2a2018";x.fillRect(0,0,LW,LH);return {c:c,wait:key}}
  var ir=im.width/im.height,pr=LW/LH,sw,sh,sx,sy;if(ir>pr){sh=im.height;sw=sh*pr;sx=(im.width-sw)/2;sy=0}else{sw=im.width;sh=sw/pr;sx=0;sy=(im.height-sh)*.18}
  x.drawImage(im,sx,sy,sw,sh,0,0,LW,LH);
  var g=x.createLinearGradient(0,0,0,LH);
  if(cover){g.addColorStop(0,"rgba(20,12,4,.5)");g.addColorStop(.3,"rgba(20,12,4,0)");g.addColorStop(.55,"rgba(20,12,4,0)");g.addColorStop(1,"rgba(20,12,4,.68)")}
  else{g.addColorStop(0,"rgba(20,12,4,.3)");g.addColorStop(.14,"rgba(20,12,4,0)");g.addColorStop(.6,"rgba(20,12,4,0)");g.addColorStop(1,"rgba(20,12,4,.55)")}
  x.fillStyle=g;x.fillRect(0,0,LW,LH);
  x.fillStyle="#fff";x.shadowColor="rgba(0,0,0,.5)";x.shadowBlur=14;
  var D='"Playfair Display",Georgia,serif',B='"Lato","Helvetica Neue",Arial,sans-serif';
  if(cover){
   x.textBaseline="alphabetic";x.font="400 15px "+B;spaced(x,"N° 01",40,52,3,"left");spaced(x,"AUTOMNE · HIVER 2026",LW-40,52,3,"right");
   x.font="600 214px "+D;x.textAlign="center";x.fillText("ÆLEN",LW/2,262);x.textAlign="left";
   x.font="400 26px "+B;spaced(x,"PARIS",LW/2,320,22,"center");
   x.font="500 50px "+D;x.fillText("L'allure parisienne,",46,LH-150);x.font="italic 500 50px "+D;x.fillText("pièce après pièce.",46,LH-92);
   x.font="400 15px "+B;spaced(x,"LE LOOKBOOK · SIX PIÈCES",48,LH-46,3,"left");
   for(var i=0;i<14;i++){x.fillRect(LW-130+i*7,LH-92,i%3===0?4:2,52)}
  }else if(d.t==="end"){
   x.textBaseline="alphabetic";x.font="400 13px "+B;spaced(x,"ÆLEN PARIS",40,46,3,"left");
   x.font="italic 500 44px "+D;x.fillText("La collection",46,LH-190);
   x.font="500 66px "+D;x.fillText("à portée de main",46,LH-120);
   x.shadowBlur=0;x.strokeStyle="#fff";x.lineWidth=1.5;x.strokeRect(46,LH-82,300,50);x.font="400 14px "+B;x.fillStyle="#fff";spaced(x,"DÉCOUVRIR LA COLLECTION",64,LH-52,2.4,"left");
  }else{
   x.textBaseline="alphabetic";x.font="400 13px "+B;spaced(x,"ÆLEN PARIS",40,46,3,"left");spaced(x,"LOOKBOOK · "+d.n,LW-40,46,3,"right");
   x.font="italic 500 44px "+D;x.fillText(d.n,46,LH-176);
   x.font="500 72px "+D;x.fillText(d.name,46,LH-108);
   x.font="400 17px "+B;spaced(x,d.meta.toUpperCase(),48,LH-72,3,"left");
   x.shadowBlur=0;x.strokeStyle="#fff";x.lineWidth=1.5;x.strokeRect(46,LH-52,190,38);x.font="400 14px "+B;x.fillStyle="#fff";spaced(x,"ACHETER  →",66,LH-27,2.6,"left");
  }
  return {c:c,wait:null};
 }
 function fill(p){var d=drawPage(p);pcan[p]=d;if(!gl)return;var t=pageTex[p];if(!t||!t.tex){t={tex:gl.createTexture(),wait:d.wait};pageTex[p]=t}t.wait=d.wait;gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,d.c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);dirty=true}
 function drop(p){var kk=DEFS[p].key;delete imgs[kk];delete imgState[kk];var t=pageTex[p];if(t&&t.tex){gl.deleteTexture(t.tex)}pageTex[p]=null;pcan[p]=null}
 var blank=null;
 function need(p){if(p<0||p>=NP)return;if(pageTex[p])return;loadImg(DEFS[p].key);fill(p)}
 /* WebGL */
 var prog,loc={},buf,paperTex;
 function sh(t,src){var s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.error('shader',gl.getShaderInfoLog(s));return s}
 function initGL(){
  var vs="attribute vec3 p;attribute vec2 u;attribute float b;uniform vec2 sc;uniform vec2 off;uniform float cam;uniform vec3 uk;varying vec2 vu;varying float vb;void main(){vu=(u-0.5)/uk.x+0.5+uk.yz;vb=b;float w=1.0-p.z/cam;gl_Position=vec4((p.x+off.x)*sc.x,(p.y+off.y)*sc.y,-p.z*0.001,w);}";
  var fs="precision mediump float;uniform sampler2D tx;uniform float fl;uniform vec3 tint;varying vec2 vu;varying float vb;void main(){vec4 c=texture2D(tx,vu);vec3 r=mix(c.rgb,tint,fl);gl_FragColor=vec4(r*vb,1.0);}";
  prog=gl.createProgram();gl.attachShader(prog,sh(gl.VERTEX_SHADER,vs));gl.attachShader(prog,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(prog);gl.useProgram(prog);
  ["sc","off","cam","tx","fl","tint","uk"].forEach(function(n){loc[n]=gl.getUniformLocation(prog,n)});
  loc.p=gl.getAttribLocation(prog,"p");loc.u=gl.getAttribLocation(prog,"u");loc.b=gl.getAttribLocation(prog,"b");
  buf=gl.createBuffer();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.clearColor(.059,.047,.035,1);
  paperTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,paperTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([246,240,228,255]));
 }
 var COLS=36;
 /* maillage d'une feuille : angle de tangente a(s) = PI*ease(progress local) */
 function leafMesh(t,dir){ /* retourne positions (x,y,z), uv, luminosité ; dir=1 vers la gauche */
  var out=[],xs=0,zs=0,L=W,n=COLS,prev=0,i;
  var lag=.55,tt=t; /* le bord extérieur traîne derrière le dos */
  var pts=[];
  for(i=0;i<=n;i++){var s=i/n;var lc=clamp(tt*(1+lag)-lag*(1-s),0,1);var a=Math.PI*lc;
   if(i>0){var ds=L/n;xs+=Math.cos(a)*ds;zs+=Math.sin(a)*ds}
   pts.push({x:xs,z:zs+.8,a:a,s:s})}
  return pts;
 }
 function quadStrip(pts,y0,y1,front,tex,brightFn,vertsOut){ /* triangle strip : 2 sommets par colonne */
  for(var i=0;i<pts.length;i++){var q=pts[i];var u=front?q.s:1-q.s;var b=brightFn(q);
   vertsOut.push(q.x,y0,q.z,u,0,b, q.x,y1,q.z,u,1,b)}
 }
 function draw(verts,tex,flat,kb){gl.uniform3f(loc.uk,kb?kb[0]:1,kb?kb[1]:0,kb?kb[2]:0);
  gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(loc.p);gl.enableVertexAttribArray(loc.u);gl.enableVertexAttribArray(loc.b);
  gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(loc.u,2,gl.FLOAT,false,24,12);gl.vertexAttribPointer(loc.b,1,gl.FLOAT,false,24,20);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex||paperTex);gl.uniform1i(loc.tx,0);gl.uniform1f(loc.fl,tex?0:1);gl.uniform3f(loc.tint,.96,.94,.89);
  gl.drawArrays(gl.TRIANGLE_STRIP,0,verts.length/6);
 }
 function texOf(p){var t=pageTex[p];return t&&t.tex?t.tex:null}
 var cw=0,ch=0,dpr=1,dirty=true,S=0;
 var kbAmt=0,kbT=0,restSince=null,lastT=0,lastS=-1;
 function kbFor(p){if(kbAmt<.002||p<0)return null;var t=kbT,a=kbAmt,h=p*2.399;return [1+a*(.035+.03*(.5-.5*Math.cos(t*.45))),a*.014*Math.sin(t*.3+h),a*.01*Math.cos(t*.27+h*1.7)]}
 function kbUpdate(now){var dt=Math.min((now-lastT)/1000,.1);lastT=now;var moving=Math.abs(S-lastS)>.0005||(auto!==null);lastS=S;
  if(moving||Math.abs(S-Math.round(S))>.035){restSince=null;kbAmt=Math.max(0,kbAmt-dt*4)}
  else{if(restSince===null)restSince=now;if(now-restSince>700){kbAmt=Math.min(1,kbAmt+dt*1.1);kbT+=dt}}
  if(kbAmt>0.002||moving)dirty=true}
 function resize(){
  var m=matchMedia("(max-width:860px)").matches;
  var r=stage.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);cw=Math.round(r.width*dpr);ch=Math.round(r.height*dpr);cv.width=cw;cv.height=ch;cv.style.width=r.width+"px";cv.style.height=r.height+"px";
  mobile=m;
  /* hauteur de page : prend toute la fenêtre */
  var hh=(document.querySelector('.site-header')||{offsetHeight:76}).offsetHeight,ph=Math.min(r.height*.9,r.height-hh-46),pw=ph*(TW/TH);if(pw*(m?1:2)>r.width*(m?1:.98)){pw=r.width*(m?1:.98)/(m?1:2);ph=pw*(TH/TW)}
  W=pw;H=ph;TOPY=hh+8;OY=r.height/2-TOPY-H;N=mobile?NP:Math.ceil(NP/2);smax=mobile?N-1:N;
  /* feuilles : desktop front=2i back=2i+1 ; mobile front=i, dos blanc */
  mag.style.height=(smax*(mobile?80:95)+100)+"vh";
  if(gl){gl.viewport(0,0,cw,ch)}
  dirty=true;
 }
 function front(i){return mobile?i:2*i}
 function back(i){return mobile?-1:2*i+1}
 var camD=2.6;
 function render(){
  if(!gl)return;dirty=false;
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  var s=S;if(Math.abs(s-Math.round(s))<.012)s=Math.round(s);var i=clamp(Math.floor(s),0,N),f=s-Math.floor(s);if(s>=N){i=N;f=0}
  var t=ease(f);
  var camPx=W*camD;gl.uniform1f(loc.cam,camPx);
  var spreadW=mobile?W:2*W;
  var sx=2/(cw/dpr),sy=2/(ch/dpr);gl.uniform2f(loc.sc,sx,sy);
  var shift;
  if(mobile)shift=-W/2;else{var t0=ease(clamp(s,0,1)),tl=ease(clamp(s-(N-1),0,1));shift=-(W/2)*(1-t0)+(W/2)*tl;}
  gl.uniform2f(loc.off,shift,OY);
  /* pages au repos */
  var y0=0,y1=H,spine=function(x){return .8+.2*clamp(Math.abs(x)/(W*.14),0,1)};
  function flatPage(p,x0,x1,mirror,shadeFn){ /* page plane entre x0 et x1 */
   var v=[],n=18;for(var k=0;k<=n;k++){var u=k/n,x=x0+(x1-x0)*u;var b=spine(mirror?(x1):(x0)==x0&&!mirror?x:x)*shadeFn(x);v.push(x,y0,0,u,0,b,x,y1,0,u,1,b)}
   draw(v,p>=0?texOf(p):null,p<0)}
  var swing=Math.sin(Math.PI*t);
  var rightP=-2,leftP=-2;
  if(f===0){rightP=i<N?front(i):-2;leftP=(i>=1)?(mobile?-2:back(i-1)):-2}
  else{rightP=(i+1<N)?front(i+1):-2;leftP=(i>=1)?(mobile?-2:back(i-1)):-2}
  var xe=null;var lp=null;
  if(f>0&&i<N&&!(mobile&&t>.985)){lp=leafMesh(t);xe=lp[lp.length-1]}
  var shR=function(x){var b=1;if(lp){var edge=Math.max(xe.x,2);b-=.46*swing*Math.pow(clamp(1-Math.abs(x-xe.x*.55)/(W*.55),0,1),1.4);}return b};
  var shL=function(x){var b=1;if(lp){var edge=-xe.x;b-=.4*swing*Math.pow(clamp(1-Math.abs(x-edge*.5)/(W*.6),0,1),1.4)}return b};
  if(rightP!==-2&&rightP>=0){var v=[],n=22;for(var k=0;k<=n;k++){var u=k/n,x=W*u;v.push(x,y0,0,u,1,spine(x)*shR(x),x,y1,0,u,0,spine(x)*shR(x))}draw(v,texOf(rightP),0,kbFor(rightP))}
  if(!mobile&&leftP>=0){var v2=[],n2=22;for(var k2=0;k2<=n2;k2++){var u2=k2/n2,x2=-W+W*u2;v2.push(x2,y0,0,u2,1,spine(x2)*shL(-x2),x2,y1,0,u2,0,spine(x2)*shL(-x2))}draw(v2,texOf(leftP),0,kbFor(leftP))}
  /* épaisseur : tranche de pages à droite */
  /* la feuille qui tourne */
  if(lp){
   var light=function(a,isFront){var c=Math.cos(a);var ang=isFront?c:-c;var b=.74+.26*clamp(.55+ang*.45,0,1);var bend=Math.abs(Math.sin(a));return clamp(b+.1*(1-bend)*0,.5,1.08)};
   var bf=function(q){var d=light(q.a,true);var sp=.9+.1*Math.cos(q.a);var rim=1-.35*Math.pow(q.s,6)*swing;return d*rim*(q.a<=Math.PI/2?1:1)};
   var vF=[],vB=[];
   for(var j=0;j<lp.length;j++){var q=lp[j];var bF=clamp(.7+.3*Math.cos(q.a*.9)+.1*Math.sin(q.a*2)*(1-q.s*.3),.45,1.08);var bB=clamp(.7+.3*(-Math.cos(q.a))*.9+.1*Math.sin(q.a*2),.45,1.05);
    vF.push(q.x,y0,q.z,q.s,1,bF*spine(q.x),q.x,y1,q.z,q.s,0,bF*spine(q.x));
    vB.push(q.x,y0,q.z,1-q.s,1,bB*spine(q.x),q.x,y1,q.z,1-q.s,0,bB*spine(q.x))}
   var avgA=lp[Math.floor(lp.length/2)].a;
   gl.enable(gl.CULL_FACE);
   /* face avant visible tant que la tangente moyenne < PI/2 ; dos ensuite */
   var showFront=avgA<Math.PI/2;
   gl.disable(gl.CULL_FACE);
   /* dessin : on dessine dos puis face, avec test de profondeur sur z */
   var fp=front(i),bp=back(i);
   /* le triangle strip est à plat sur xz : la face visible dépend de l'orientation, on dessine les deux, le test de profondeur choisit */
   gl.depthMask(true);
   drawLeaf(vF,fp>=0?texOf(fp):null,false);
   drawLeaf(vB,bp>=0?texOf(bp):null,true);
  }
 }
 /* dessin d'une face de feuille avec culling manuel par signe de la normale */
 function drawLeaf(v,tex,isBack){
  gl.enable(gl.CULL_FACE);gl.frontFace(isBack?gl.CCW:gl.CW);gl.cullFace(gl.BACK);
  /* les sommets sont (bas,haut) par colonne ; sens de lecture gauche→droite le long de la feuille */
  draw(v,tex,!tex);gl.disable(gl.CULL_FACE);
 }
 /* progression : défilement de la page */
 function sFromScroll(){var r=mag.getBoundingClientRect(),sc=mag.offsetHeight-stage.offsetHeight;var p=sc>0?clamp(-r.top/sc,0,1):0;return clamp((p-.02)/.96,0,1)*smax}
 function scrollForS(s){var sc=mag.offsetHeight-stage.offsetHeight,top=mag.getBoundingClientRect().top+scrollY;return top+(clamp(s/smax,0,1)*.96+.02)*sc}
 var auto=null,lastAct=performance.now()-1000+1300,selfScroll=0;
 var reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
 function stopAuto(){auto=null}
 function activity(){lastAct=performance.now();stopAuto()}
 ["wheel","touchstart","touchmove","touchend","mousedown","keydown"].forEach(function(e){addEventListener(e,activity,{passive:true})});
 addEventListener("scroll",function(){if(performance.now()-selfScroll>120)activity()},{passive:true});
 /* défilement automatique : reprend après 1 s d'inactivité, à partir de la page en cours */
 function runAuto(){
  /* tout le magazine défile en moins de 5 secondes, sans pause */
  var from=S,to=smax,dur=Math.max((to-from)/smax*4.6,.3),t0=null;
  auto=function(now){if(t0===null)t0=now;var f=clamp((now-t0)/(dur*1000),0,1);setS(from+(to-from)*f);return f<1};
  auto.isAuto=true;
 }
 function goTo(to,dur){to=clamp(to,0,smax);var from=S,t0=null;if(Math.abs(to-from)<.001)return;auto=function(now){if(t0===null)t0=now;var f=clamp((now-t0)/(dur*1000),0,1);setS(from+(to-from)*f);return f<1};auto.isTween=true}
 var tgt=0;function step(d){activity();var base=Math.round(S);tgt=clamp(base+d,0,smax);goTo(tgt,mobile?1.6:2.0)}
 function setS(s){S=s;selfScroll=performance.now();scrollTo({top:scrollForS(s),behavior:"instant"});dirty=true}
 var needIdx=-9;
 function ensure(){var k=Math.floor(S);var ex=auto&&auto.isAuto?6:0,lo=mobile?k-1:2*k-2,hi=(mobile?k+3:2*k+5)+ex;for(var p=0;p<NP;p++){if(p>=lo&&p<=hi)need(p);else if(pageTex[p]&&(p<lo-2||p>hi+2))drop(p)}}
 function loop(now){
  if(auto){var go=auto(now);if(!go)auto=null}
  else{var s=sFromScroll(),dd=s-S;if(Math.abs(dd)>.0004){S=Math.abs(dd)<.002?s:S+dd*.1;dirty=true}}
  var rr=mag.getBoundingClientRect(),inM=rr.top<=1&&rr.bottom>innerHeight*.5;
  if(!auto&&!reduced&&inM&&S<smax-.01&&document.visibilityState==='visible'&&document.body.style.overflow!=='hidden'&&now-lastAct>1000){runAuto()}
  kbUpdate(now);
  ensure();
  if(dirty)render();
  /* en-tête transparent sur le magazine */
  var r=mag.getBoundingClientRect(),inMag=r.top<=1&&r.bottom>innerHeight*.5;document.body.classList.toggle("inmag",inMag);
  var k=Math.round(S);label.textContent=S<.05?"Couverture":(S>=smax-.05?"Dernière page":"Page "+(mobile?Math.min(k+1,NP):Math.min(2*k,NP))+" sur "+NP);
  requestAnimationFrame(loop)}
 if(!gl){stage.classList.add("nogl");return}
 initGL();resize();
 var rs;addEventListener("resize",function(){clearTimeout(rs);rs=setTimeout(function(){resize()},120)});
 var go=function(){resize();S=sFromScroll();dirty=true;requestAnimationFrame(loop);0};
 (document.fonts&&document.fonts.load?Promise.all([document.fonts.load('600 80px "Playfair Display"'),document.fonts.load('italic 500 40px "Playfair Display"'),document.fonts.load('400 14px "Lato"')]).catch(function(){}):Promise.resolve()).then(go);
 /* clic : page droite = suivant, page gauche = précédent */
 function pageAt(cx,cy){var r=cv.getBoundingClientRect(),s=S;var k=Math.round(s),mid=r.width/2,shift;
  if(mobile)shift=-W/2;else{var t0=ease(clamp(s,0,1)),tl=ease(clamp(s-(N-1),0,1));shift=-(W/2)*(1-t0)+(W/2)*tl}
  var px=cx-r.left-mid-shift,hh=r.height,top=TOPY,bot=TOPY+H,py=cy-r.top;if(py<top||py>bot)return -1;
  if(px>=0&&px<=W)return mobile?k:(k<N?2*k:-1);if(!mobile&&px<0&&px>=-W)return k>=1?2*k-1:-1;return -1}
 cv.addEventListener("click",function(e){if(swiped){swiped=false;return}var p=pageAt(e.clientX,e.clientY);stopAuto();
  if(p<0||p>=NP){step(1);return}var d=DEFS[p];
  if(d.t==="prod"&&window.aelenOpenProduct){window.aelenOpenProduct(d.id)}
  else if(d.t==="end"){var c=document.getElementById("collection");if(c)c.scrollIntoView({behavior:"smooth"})}
  else step(1)});
 var tx=0,ty=0,swiped=false;
 cv.addEventListener("touchstart",function(e){tx=e.touches[0].clientX;ty=e.touches[0].clientY;swiped=false},{passive:true});
 cv.addEventListener("touchend",function(e){var t=e.changedTouches[0],dx=t.clientX-tx,dy=t.clientY-ty;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){swiped=true;stopAuto();step(dx<0?1:-1)}},{passive:true});
 addEventListener("keydown",function(e){var t=e.target&&e.target.tagName;if(t==="INPUT"||t==="TEXTAREA"||t==="SELECT"||document.body.style.overflow==="hidden")return;var rr=mag.getBoundingClientRect();if(!(rr.top<=1&&rr.bottom>innerHeight*.5))return;if(e.key==="ArrowRight"){stopAuto();step(1)}else if(e.key==="ArrowLeft"){stopAuto();step(-1)}});
})();


/* collection et fiche produit : mouvement doux quand une photo reste visible 1 s */
(function(){
 if(matchMedia("(prefers-reduced-motion: reduce)").matches||!("IntersectionObserver" in window))return;
 var timers=new Map();
 var io=new IntersectionObserver(function(es){es.forEach(function(e){var c=e.target;
  if(e.isIntersecting&&e.intersectionRatio>=.55){if(!timers.has(c))timers.set(c,setTimeout(function(){c.classList.add("kb")},1000))}
  else{clearTimeout(timers.get(c));timers.delete(c);c.classList.remove("kb")}})},{threshold:[0,.55,1]});
 function scan(){[].forEach.call(document.querySelectorAll("#collection-grid .product-card"),function(c){if(!c._kb){c._kb=1;io.observe(c)}})}
 scan();var gr=document.getElementById("collection-grid");if(gr&&window.MutationObserver)new MutationObserver(scan).observe(gr,{childList:true});
 var mi=document.getElementById("modal-image"),ov=document.getElementById("modal-overlay"),h;
 function arm(){if(!mi)return;mi.classList.remove("kb");clearTimeout(h);if(ov&&ov.hidden)return;h=setTimeout(function(){mi.classList.add("kb")},1000)}
 if(mi&&window.MutationObserver){new MutationObserver(arm).observe(mi,{attributes:true,attributeFilter:["src"]});if(ov)new MutationObserver(arm).observe(ov,{attributes:true,attributeFilter:["hidden"]})}
})();
