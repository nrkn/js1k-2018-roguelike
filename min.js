G=(()=>{let t=t=>Math.random()*t|0,e=0,l=[],r=[t(50),t(50),0,10,"@"],f=(t,e)=>{for(let l=0;l<t.length;l++)if(t[l][3]&&e[0]==t[l][0]&&e[1]==t[l][1])return t[l]},o=()=>{let o=[],h=[r],n=t(50*e)+50,i=t(50*e)+50,a=t(2*e*10)+10,d=t(2*e*5)+5,g=t(5*e)+5,u=(r,o,h)=>{let a=[t(n),t(i),r,o,h];return f(l[e][0],a)&&!f(l[e][1],a)?(l[e][1].push(a),a):u(r,o,h)},w=(t,e)=>{for(let l=t[1]<e[1]?t[1]:e[1];l<=(t[1]<e[1]?e[1]:t[1]);l++)for(let r=t[0]<e[0]?t[0]:e[0];r<=(t[0]<e[0]?e[0]:t[0]);r++)o.push([r,l,3,1,"."])},c=(t,e)=>{w([t[0],t[1]],[t[0],e[1]]),w([t[0],e[1]],[e[0],e[1]])};for(let e=0;e<a;e++){let l=0==e?r:[t(n),t(i)];o.length&&c(l,o[t(o.length)]),w([l[0]-(t(10)+1),l[1]-(t(10)+1)],[l[0]+(t(10)+1),l[1]+(t(10)+1)])}l[e]=[o,h],u(2,1,">");for(let t=0;t<d;t++)u(1,1,"m");for(let t=0;t<g;t++)u(4,1,"!")},h=()=>{a.width=a.width;for(let t=0;t<25;t++)for(let o=0;o<25;o++){let h=r[0]-12+o,n=r[1]-12+t,i=f(l[e][1],[h,n])||f(l[e][0],[h,n]);c.fillText(e>9?"🏆":r[3]<1?"💀":i?i[4]:"#",10*o,10*t)}c.fillText("L "+e+" HP "+r[3],0,250)},n=(h,n)=>{let i=[h[0],h[1]];1==h[2]&&t(5)?r[0]<h[0]?i[0]--:r[0]>h[0]?i[0]++:r[1]<h[1]?i[1]--:r[1]>h[1]&&i[1]++:1==n?i[1]--:2==n?i[0]++:3==n?i[1]++:0==n&&i[0]--;let a=f(l[e][1],i);a&&1==h[2]&&0==a[2]&&t(2)?a[3]--:a&&0==h[2]&&1==a[2]&&t(2)?a[3]--:a&&2==a[2]?(e++,o()):a&&4==a[2]?(r[3]++,a[3]--):f(l[e][0],i)&&!a&&(h[0]=i[0],h[1]=i[1])};b.onkeydown=(f=>{n(r,f.which-37);for(let r=0;r<l[e][1].length;r++)l[e][1][r][3]&&1==l[e][1][r][2]&&n(l[e][1][r],t(4));h()}),o(),h()}),G()