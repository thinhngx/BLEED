// BLEED WebGL2 engine. VS / FS_BLUR / FS_MAIN and the render() pass order are
// ported verbatim from the reference. The only additions are `uInk` and
// `uOpacity` (fontPicker ink color/opacity), which are identity for the
// reference default (#FFFFFF, 100%).

import {
  bleedGrainModeIndex,
  type BleedMaterial,
} from "./bleed-params";

const VS = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv=vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position=vec4(p,0.,1.); }`;

const FS_BLUR = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D src; uniform vec2 texel, dir; uniform float sigma;
void main(){
  float s=max(sigma,0.0001), stride=max(1.0,s/16.0), sum=0., wsum=0.;
  for(int i=-72;i<=72;i++){
    float t=float(i)*stride;
    if(abs(t)>s*2.8) continue;
    float w=exp(-0.5*t*t/(s*s));
    sum+=w*texture(src,uv+dir*texel*t).r; wsum+=w;
  }
  o=vec4(sum/wsum,0.,0.,1.);
}`;

const FS_MAIN = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D field, glyph;
uniform vec2 texel;
uniform float uThr,uCore,uDome,uAA,uEmb,uEmbS;
uniform float uLightAng,uLightAmt,uAmb,uNorm,uRim;
uniform float uWarpAmt,uWarpScale;
uniform float uMode,uGrain,uGScale,uGBias,uDither,uSeed;
uniform float uDis,uDisAng,uDisSoft;
uniform float uInvert,uAlphaOut;
uniform vec3 uInk; uniform float uOpacity;

float hash(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*0.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
float bayer8(vec2 c){ vec2 p=floor(mod(c,8.0)); int x=int(p.x),y=int(p.y),v=0;
  for(int b=2;b>=0;b--){ int xb=(x>>b)&1,yb=(y>>b)&1; v=v*4+((yb^xb)*2+xb); }
  return (float(v)+0.5)/64.0; }
float noiseAt(vec2 c){
  if(uMode<0.5)      return hash(c+uSeed*17.0);
  else if(uMode<1.5) return vnoise(c*0.5+uSeed*7.0);
  else if(uMode<2.5) return bayer8(c);
  return fract(hash(c+uSeed)*0.6+vnoise((c+uSeed)*0.33)*0.4+bayer8(c)*0.3); }
float F(vec2 q){ return texture(field,q).r; }

void main(){
  vec2 q=uv;
  if(uWarpAmt>0.0){
    float w1=fbm(uv*uWarpScale*3.0+uSeed*3.1)-0.5;
    float w2=fbm(uv*uWarpScale*3.0+vec2(5.2,1.3)+uSeed*3.1)-0.5;
    q+=vec2(w1,w2)*uWarpAmt;
  }
  float d=F(q);
  float mask=smoothstep(uThr-uAA*0.5-texel.y, uThr+uAA*0.5+texel.y, d);
  float hgt=clamp((d-uThr)/max(uCore,0.001),0.0,1.0);
  float dome=pow(sqrt(max(1.0-(1.0-hgt)*(1.0-hgt),0.0)), uDome);
  float gx=(F(q+vec2(texel.x,0.))-F(q-vec2(texel.x,0.)))/max(uCore,0.001);
  float gy=(F(q+vec2(0.,texel.y))-F(q-vec2(0.,texel.y)))/max(uCore,0.001);
  float ex=0., ey=0.;
  if(uEmb>0.0){
    vec2 e=texel*uEmbS;
    float l=0.,r=0.,u_=0.,dn=0.;
    for(int k=-1;k<=1;k++){
      float f=float(k)*0.6;
      l +=texture(glyph,q+vec2(-e.x,e.y*f)).r;
      r +=texture(glyph,q+vec2( e.x,e.y*f)).r;
      u_+=texture(glyph,q+vec2(e.x*f,-e.y)).r;
      dn+=texture(glyph,q+vec2(e.x*f, e.y)).r;
    }
    ex=(r-l)/3.0; ey=(dn-u_)/3.0;
  }
  vec3 n=normalize(vec3(-gx*uNorm*40.0-ex*uEmb*3.0,
                        -gy*uNorm*40.0-ey*uEmb*3.0, 1.0));
  float a=radians(uLightAng);
  vec3 L=normalize(vec3(cos(a),sin(a),0.85));
  float lam=clamp(dot(n,L),0.0,1.0);
  float rim=pow(1.0-dome,3.0)*uRim;
  float lit=uAmb+(1.0-uAmb)*mix(1.0,lam,uLightAmt);
  lit=clamp(lit*mix(0.55,1.0,dome)+rim,0.0,1.2);
  float v=lit*mask;
  if(uDis>0.0){
    float da=radians(uDisAng);
    float t=dot(uv-0.5,vec2(cos(da),sin(da)))+0.5;
    float ramp=smoothstep(0.0,max(uDisSoft,0.001),t);
    ramp=mix(1.0,ramp*mix(1.0,0.3+fbm(uv*6.0+uSeed)*1.2,0.6),uDis);
    v*=ramp;
  }
  v=clamp(v,0.0,1.0);
  vec2 c=floor(gl_FragCoord.xy/max(uGScale,0.05));
  float g=noiseAt(c);
  float gAmt=uGrain*mix(1.0,1.0-dome*0.9,uGBias);
  float grainy=clamp(v*(1.0-gAmt*(g-0.45)*1.8),0.0,1.0);
  float ink=mix(grainy, step(g,grainy), clamp(uDither,0.0,1.0));
  ink*=step(0.004,v);
  if(uInvert>0.5) ink=1.0-ink;

  if(uAlphaOut>0.5){
    float al = uInvert>0.5 ? 1.0-ink : ink;
    vec3 rgb = uInvert>0.5 ? vec3(0.0) : uInk*al;
    o=vec4(rgb,al)*uOpacity;
  } else {
    o=vec4(vec3(ink),1.0);
  }
}`;

export type BleedRenderInput = Readonly<{
  /** Backing pixels per scene pixel (BLEED `S`). */
  pixelScale: number;
  ink: readonly [number, number, number];
  material: BleedMaterial;
  opacity: number;
  seed: number;
  /** Source size in backing pixels that drives blur sigma (BLEED `usedPx`). */
  usedPx: number;
}>;

export type BleedGlEngine = Readonly<{
  canvas: OffscreenCanvas;
  dispose: () => void;
  render: (coverage: OffscreenCanvas, input: BleedRenderInput) => void;
}>;

export class BleedWebGlUnavailableError extends Error {
  constructor() {
    super("BLEED requires WebGL2.");
    this.name = "BleedWebGlUnavailableError";
  }
}

export function createBleedGlEngine(
  canvas: OffscreenCanvas = new OffscreenCanvas(1, 1),
): BleedGlEngine {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new BleedWebGlUnavailableError();
  const hasF16 = !!gl.getExtension("EXT_color_buffer_float");

  const sh = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
    }
    return shader;
  };
  const prog = (fragment: string) => {
    const program = gl.createProgram()!;
    gl.attachShader(program, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(program, sh(gl.FRAGMENT_SHADER, fragment));
    gl.bindAttribLocation(program, 0, "p");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
    }
    return program;
  };
  const pBlur = prog(FS_BLUR);
  const pMain = prog(FS_MAIN);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const mkTex = () => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  };
  const texCov = mkTex();
  let texA = mkTex();
  let texB = mkTex();
  const fbA = gl.createFramebuffer();
  const fbB = gl.createFramebuffer();
  let RW = 0;
  let RH = 0;
  const sizeTargets = (w: number, h: number) => {
    RW = w;
    RH = h;
    const ifmt = hasF16 ? gl.R16F : gl.R8;
    // Immutable storage is re-created whenever the backing size changes.
    gl.deleteTexture(texA);
    gl.deleteTexture(texB);
    texA = mkTex();
    texB = mkTex();
    for (const [texture, framebuffer] of [[texA, fbA], [texB, fbB]] as const) {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, ifmt, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };
  const blurUniforms = new Map<string, WebGLUniformLocation | null>();
  const mainUniforms = new Map<string, WebGLUniformLocation | null>();
  const Ub = (name: string) => {
    if (!blurUniforms.has(name)) blurUniforms.set(name, gl.getUniformLocation(pBlur, name));
    return blurUniforms.get(name)!;
  };
  const U = (name: string) => {
    if (!mainUniforms.has(name)) mainUniforms.set(name, gl.getUniformLocation(pMain, name));
    return mainUniforms.get(name)!;
  };
  const setUniforms = (
    ints: readonly (readonly [string, number])[],
    floats: readonly (readonly [string, number])[],
    texel: readonly [number, number],
    ink: readonly [number, number, number],
  ) => {
    for (const [name, value] of ints) gl.uniform1i(U(name), value);
    for (const [name, value] of floats) gl.uniform1f(U(name), value);
    gl.uniform2f(U("texel"), texel[0], texel[1]);
    gl.uniform3f(U("uInk"), ink[0], ink[1], ink[2]);
  };

  const render = (coverage: OffscreenCanvas, input: BleedRenderInput) => {
    const w = coverage.width;
    const h = coverage.height;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    if (RW !== w || RH !== h) sizeTargets(w, h);
    // upload(): luminance coverage, unpack alignment 1.
    gl.bindTexture(gl.TEXTURE_2D, texCov);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, coverage);

    const P = input.material;
    const S = input.pixelScale;
    const sigma = Math.max(0.75, P.inflate * input.usedPx);
    gl.bindVertexArray(vao);
    const tx = 1 / w;
    const ty = 1 / h;
    gl.useProgram(pBlur);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texCov);
    gl.uniform1i(Ub("src"), 0);
    gl.uniform2f(Ub("texel"), tx, ty);
    gl.uniform1f(Ub("sigma"), sigma);
    gl.uniform2f(Ub("dir"), 1, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.uniform2f(Ub("dir"), 0, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pMain);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texCov);
    const ints: readonly (readonly [string, number])[] = [["field", 0], ["glyph", 1]];
    const floats: readonly (readonly [string, number])[] = [
      ["uThr", P.threshold],
      ["uCore", P.core],
      ["uDome", P.dome],
      ["uAA", P.aa],
      ["uEmb", P.emboss],
      ["uEmbS", P.embossSoft * S],
      ["uLightAng", P.lightAng],
      ["uLightAmt", P.lightAmt],
      ["uAmb", P.ambient],
      ["uNorm", P.normAmt],
      ["uRim", P.rim],
      ["uWarpAmt", P.warpAmt],
      ["uWarpScale", P.warpScale],
      ["uMode", bleedGrainModeIndex[P.grainMode]],
      ["uGrain", P.grainAmt],
      ["uGScale", P.grainScale * S],
      ["uGBias", P.gBias],
      ["uDither", P.dither],
      ["uSeed", input.seed],
      ["uDis", P.dissolve],
      ["uDisAng", P.dissolveAng],
      ["uDisSoft", P.dissolveSoft],
      ["uInvert", P.invert ? 1 : 0],
      // Toolcraft always renders a transparent foreground; the runtime owns the
      // background surface (BLEED's opaque preview == alpha output over black).
      ["uAlphaOut", 1],
      ["uOpacity", input.opacity],
    ];
    setUniforms(ints, floats, [tx, ty], input.ink);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const dispose = () => {
    gl.deleteProgram(pBlur);
    gl.deleteProgram(pMain);
    gl.deleteBuffer(vb);
    gl.deleteVertexArray(vao);
    for (const texture of [texCov, texA, texB]) gl.deleteTexture(texture);
    gl.deleteFramebuffer(fbA);
    gl.deleteFramebuffer(fbB);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  };

  return Object.freeze({ canvas, dispose, render });
}
