(function() {
    class Color {
      constructor(r, g, b, a) { this.r = r; this.g = g; this.b = b; this.a = a; }
    }
    function vec3(x, y, z) { return { x, y, z }; }
    function vec3Add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
    function vec3Sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
    function vec3Scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
    function vec3Dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
    function vec3Length(a) { return Math.sqrt(a.x*a.x + a.y*a.y + a.z*a.z); }
    function vec3Normalize(a) { let l = vec3Length(a); return l>0 ? vec3Scale(a,1/l):vec3(0,0,0); }
    function drawPixel(img, x, y, color) {
      let i = (y * img.width + x) * 4;
      img.data[i] = color.r;
      img.data[i+1] = color.g;
      img.data[i+2] = color.b;
      img.data[i+3] = color.a;
    }
    function rayIntersectSphere(eye, dir, s) {
      let oc = vec3Sub(eye, s.center);
      let a = vec3Dot(dir, dir);
      let b = 2 * vec3Dot(oc, dir);
      let c = vec3Dot(oc, oc) - s.r * s.r;
      let discriminant = b*b - 4*a*c;
      if (discriminant < 0) return {hit: false};
      let sqrtD = Math.sqrt(discriminant);
      let t0 = (-b - sqrtD) / (2*a);
      let t1 = (-b + sqrtD) / (2*a);
      let t = t0 > 0 ? t0 : t1 > 0 ? t1 : null;
      return t !== null ? {hit:true, t:t} : {hit:false};
    }
    function getSphereNormal(p, s) {
      return vec3Normalize(vec3Sub(p, s.center));
    }
    function blinnPhongLighting(point,normal,viewPos,lightPos,mat){
      let ambient = 0.09, specular = 0.38, shininess = 32;
      let ld = vec3Normalize(vec3Sub(lightPos,point));
      let diffuse = Math.max(vec3Dot(normal,ld),0);
      let vd = vec3Normalize(vec3Sub(viewPos,point));
      let h = vec3Normalize(vec3Add(ld,vd));
      let spec = Math.pow(Math.max(vec3Dot(normal,h),0),shininess)*specular;
      return {
        r: Math.min(mat.r*(ambient+diffuse)+spec,1),
        g: Math.min(mat.g*(ambient+diffuse)+spec,1),
        b: Math.min(mat.b*(ambient+diffuse)+spec,1)
      };
    }
    function rotateAroundX(v, angle) {
      let c=Math.cos(angle), s=Math.sin(angle);
      return {
        x: v.x,
        y: v.y*c - v.z*s,
        z: v.y*s + v.z*c
      };
    }
    function hashStar(ix, iy) {
      let h = (ix*92837111 ^ iy*689287499);
      return Math.abs(Math.sin(h*0.000013))*1091 % 1;
    }
    let spheres = [];
    async function loadSpheres() {
      const response = await fetch('spheres.json');
      spheres = await response.json();
    }
    function getSunEarthScene(t) {
      const tilt = 23 * Math.PI / 180;
      let sun = {
        center: vec3(0.5,0.5,0.0),
        r: 0.09
      };
      let orbitA = 0.28, orbitB = 0.14, yearAngle = t * 0.36;
      if (spheres.length < 3) {
        return {sun, earth: {center: vec3(0.5,0.5,0.0), r: 0.06, rot: t * 1.1, tilt: tilt}};
      }
      let baseEarth = spheres[2];
      let ex = 0.5 + orbitA * Math.cos(yearAngle);
      let ez = 0.0 + orbitB * Math.sin(yearAngle);
      let scale = 0.23;
      let earth = {
        center: vec3(ex, baseEarth.y, ez),
        r: baseEarth.r * scale,
        rot: t * 1.1,
        tilt: tilt
      };
      return {sun, earth};
    }
    function renderSunEarth(context, t) {
      let w = context.canvas.width, h = context.canvas.height;
      let img = context.createImageData(w,h);
      let eye = vec3(0.5,0.5,-0.7);
      let scene = getSunEarthScene(t);
      let sun = scene.sun, earth = scene.earth;
      let lightPos = sun.center;
      let bg = new Color(15,18,25,255);
      for(let y=0; y<h; y++) {
        for(let x=0; x<w; x++) {
          let isStar = hashStar(x,y) > 0.995;
          drawPixel(img, x, y, isStar?new Color(255,255,255,255):bg);
        }
      }
      for(let y=0; y<h; y++) {
        for(let x=0; x<w; x++) {
          let p = vec3(x/(w-1), 1 - y/(h-1), 0);
          let rd = vec3Normalize(vec3Sub(p, eye));
          let sunInt = rayIntersectSphere(eye, rd, sun);
          if(sunInt.hit && sunInt.t > 0)
            drawPixel(img, x, y, new Color(250,230,55,255));
        }
      }
      for(let y=0; y<h; y++) {
        for(let x=0; x<w; x++) {
          let p = vec3(x/(w-1), 1 - y/(h-1), 0);
          let rd = vec3Normalize(vec3Sub(p, eye));
          let earthInt = rayIntersectSphere(eye, rd, earth);
          if(earthInt.hit && earthInt.t > 0) {
            let sunInt = rayIntersectSphere(eye, rd, sun);
            if(sunInt.hit && sunInt.t > 0 && sunInt.t < earthInt.t)
              continue;
            let pt = vec3Add(eye, vec3Scale(rd, earthInt.t));
            let n = getSphereNormal(pt, earth);
            let rel = vec3Sub(pt, earth.center);
            let tilted = rotateAroundX(rel, -earth.tilt);
            let theta = Math.atan2(tilted.z, tilted.x) + earth.rot;
            let phi = Math.asin(tilted.y / earth.r);
            let isSnow = Math.abs(phi) > 0.86;
            let continent = Math.cos(3*theta)*Math.cos(2*phi);
            let brown = Math.cos(5*theta-Math.cos(phi+0.5));
            let isGreen = continent > 0.36 && Math.abs(phi) < 0.7;
            let isBrown = brown > 0.38 && Math.abs(phi) < 0.65;
            let mat = isSnow ? {r:0.94,g:0.95,b:0.96}
              : isGreen ? {r:0.17,g:0.69,b:0.14}
              : isBrown ? {r:0.57,g:0.44,b:0.28}
              : {r:0.13,g:0.38,b:0.95};
            let color = blinnPhongLighting(pt, n, eye, lightPos, mat);
            drawPixel(img, x, y, new Color(
              Math.round(color.r * 255),
              Math.round(color.g * 255),
              Math.round(color.b * 255),
              255
            ));
          }
        }
      }
      context.putImageData(img, 0, 0);
    }
    let animationFrameId;
    async function main() {
      await loadSpheres();
      let canvas = document.getElementById('viewport');
      let ctx = canvas.getContext('2d');
      function animate(t) { 
        renderSunEarth(ctx, 0.7*t/1000.0); 
        animationFrameId = requestAnimationFrame(animate); 
      }
      animate(0);
    }
    function stop() {
      if(animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    }
    window.part3Main = main;
    window.part3Stop = stop;
  })();
  